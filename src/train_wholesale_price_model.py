"""도매(위판) 가격 예측 모델 (주별, 항구별 패널 데이터 + 어획량 예측치).

기획서 6.8절: 검증용 모델(2023~2024 학습/2025 검증)과 배포용 모델(2023~2025 전체
재학습)을 구분해서 저장한다. 배포용은 별도 MAE를 산출하지 않고 검증용 결과를
참고치로 사용한다.

입력: data/processed/merged_byport_weekly.csv, data/processed/catch_predictions_full.csv,
      data/processed/catch_predictions_full_final.csv
출력: models/wholesale_price_model_val.pkl, models/wholesale_price_model_final.pkl,
      outputs/price_predictions.csv (price_type=wholesale, 검증용 모델 결과)
"""
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from common import (
    MODEL_VERSION_VAL,
    PRICE_UNCERTAIN_THRESHOLD,
    RF_PARAMS_WHOLESALE,
    SPECIES_ID,
    TEST_START,
    TRAIN_END,
    WHOLESALE_MIN_TRAIN_VOLUME_KG,
    add_region_dummies,
)
from evaluate import (
    check_bounds,
    clip_to_bounds,
    compute_metrics,
    record_metrics,
    tree_confidence_interval,
    uncertain_flag,
)

WEEKLY = "data/processed/merged_byport_weekly.csv"
CATCH_FULL = "data/processed/catch_predictions_full.csv"
CATCH_FULL_FINAL = "data/processed/catch_predictions_full_final.csv"
CATCH_OFFICIAL = "outputs/catch_predictions.csv"
MODEL_OUT_VAL = "models/wholesale_price_model_val.pkl"
MODEL_OUT_FINAL = "models/wholesale_price_model_final.pkl"
PRED_OUT = "outputs/price_predictions.csv"

BASE_FEATURES = [
    "month",
    "week_of_year_sin",
    "week_of_year_cos",
    "season_peak",
    "water_temp",
    "wind_speed",
    "predicted_catch",
]
TARGET = "price_per_kg"


def main():
    weekly = pd.read_csv(WEEKLY, parse_dates=["week_start"])
    catch_full = pd.read_csv(CATCH_FULL, parse_dates=["week_start"])

    df = weekly.merge(
        catch_full[["region_id", "week_start", "predicted_catch"]],
        on=["region_id", "week_start"],
        how="left",
    )
    df, region_cols = add_region_dummies(df)
    FEATURES = BASE_FEATURES + region_cols

    train = df[df["week_start"] <= TRAIN_END].dropna(subset=FEATURES)
    test = df[df["week_start"] >= TEST_START].copy()

    n_before = len(train)
    train = train[train["total_weight"] >= WHOLESALE_MIN_TRAIN_VOLUME_KG]
    print(
        f"[극저물량 제외] total_weight<{WHOLESALE_MIN_TRAIN_VOLUME_KG}kg인 학습행 "
        f"{n_before - len(train)}건 제외 ({n_before}행 -> {len(train)}행). 검증셋은 그대로 유지."
    )

    test_na = test[FEATURES].isna().sum()
    test_na = test_na[test_na > 0]
    if len(test_na) > 0:
        print(f"[경고] 검증셋에 결측 특징 존재, 해당 행 제외:\n{test_na}")
        test = test.dropna(subset=FEATURES)

    print(f"[분할] train={len(train)}행 (~{TRAIN_END}), test={len(test)}행 ({TEST_START}~)")

    X_train, y_train = train[FEATURES], train[TARGET]
    X_test, y_test = test[FEATURES], test[TARGET]

    # price_per_kg = 총금액/총중량이라 그 주 총중량이 극히 적은 행(예: 1~2kg)은
    # 우연한 거래 한두 건에 좌우되는 노이즈에 가깝다. 물량이 큰(신뢰할 수 있는)
    # 관측치에 더 큰 학습 가중치를 줘서 이런 저물량 노이즈의 영향을 줄인다.
    # log1p로 완만하게 줘서 초대형 항구·성수기 행이 학습을 통째로 지배하지 않게 한다.
    sample_weight = np.log1p(train["total_weight"])

    print("[검증용 모델] 2023~2024 학습 / 2025 검증")
    model = RandomForestRegressor(**RF_PARAMS_WHOLESALE)
    model.fit(X_train, y_train, sample_weight=sample_weight)

    y_pred = model.predict(X_test)
    lower, upper = tree_confidence_interval(model, X_test)
    y_pred = clip_to_bounds(y_pred, lower, upper)
    mae, rmse = compute_metrics(y_test, y_pred)
    print(f"[성능] wholesale_price_model MAE={mae:.2f}원/kg, RMSE={rmse:.2f}원/kg")

    ratio = (upper - lower) / pd.Series(y_pred).replace(0, pd.NA)
    print(f"[interval_width_ratio] median={ratio.median():.2f}, mean={ratio.mean():.2f}, "
          f"p25={ratio.quantile(.25):.2f}, p75={ratio.quantile(.75):.2f}")

    flag = uncertain_flag(y_pred, lower, upper, threshold=PRICE_UNCERTAIN_THRESHOLD)
    print(f"[price_uncertain(wholesale)] threshold={PRICE_UNCERTAIN_THRESHOLD} -> uncertain 비율 {flag.mean()*100:.1f}%")

    # catch_prediction_id 연결: outputs/catch_predictions.csv(검증기간 공식 산출물)의
    # (region_id, week_start) 행 위치(1부터)를 FK로 사용
    catch_official = pd.read_csv(CATCH_OFFICIAL, parse_dates=["week_start"])
    catch_official = catch_official.reset_index().rename(columns={"index": "catch_prediction_id"})
    catch_official["catch_prediction_id"] += 1

    test = test.merge(
        catch_official[["region_id", "week_start", "catch_prediction_id"]],
        on=["region_id", "week_start"],
        how="left",
    )
    unmatched = test["catch_prediction_id"].isna().sum()
    if unmatched > 0:
        print(f"[경고] catch_prediction_id 매칭 실패 {unmatched}건 (catch_predictions.csv와 week_start 범위 불일치)")

    preds = pd.DataFrame(
        {
            "catch_prediction_id": test["catch_prediction_id"].values,
            "species_id": SPECIES_ID,
            "feature_id": range(1, len(test) + 1),
            "target_date": test["week_start"].dt.strftime("%Y-%m-%d").values,
            "predicted_price": y_pred,
            "lower_bound": lower,
            "upper_bound": upper,
            "mae": mae,
            "model_version": MODEL_VERSION_VAL,
            "price_type": "wholesale",
            "price_uncertain": flag,
        }
    )

    check_bounds(preds, "predicted_price")

    record_metrics(
        "wholesale_price",
        mae=mae,
        rmse=rmse,
        n_train=len(train),
        n_test=len(test),
        uncertain_ratio=flag.mean(),
        threshold=PRICE_UNCERTAIN_THRESHOLD,
    )

    preds.to_csv(PRED_OUT, index=False, encoding="utf-8-sig")
    joblib.dump(model, MODEL_OUT_VAL)
    print(f"[저장] {MODEL_OUT_VAL}, {PRED_OUT}")
    print(preds.head())

    # 기획서 6.8절: 배포용 모델은 2023~2025 전체 데이터로 재학습.
    # 어획량 배포용 모델(catch_predictions_full_final.csv)의 예측치를 입력으로 사용해
    # 검증용/배포용 체인이 서로 섞이지 않게 한다. held-out 검증셋이 없으므로 별도
    # MAE는 산출하지 않고 위 검증용 모델의 결과를 참고치로 사용한다.
    print("[배포용 모델] 2023~2025 전체 데이터로 재학습 (참고 성능은 검증용 모델과 동일)")
    catch_full_final = pd.read_csv(CATCH_FULL_FINAL, parse_dates=["week_start"])
    df_final = weekly.merge(
        catch_full_final[["region_id", "week_start", "predicted_catch"]],
        on=["region_id", "week_start"],
        how="left",
    )
    df_final, _ = add_region_dummies(df_final)

    train_final = df_final.dropna(subset=FEATURES)
    n_before_final = len(train_final)
    train_final = train_final[train_final["total_weight"] >= WHOLESALE_MIN_TRAIN_VOLUME_KG]
    print(
        f"[극저물량 제외/배포용] total_weight<{WHOLESALE_MIN_TRAIN_VOLUME_KG}kg인 학습행 "
        f"{n_before_final - len(train_final)}건 제외 ({n_before_final}행 -> {len(train_final)}행)"
    )
    sample_weight_final = np.log1p(train_final["total_weight"])

    final_model = RandomForestRegressor(**RF_PARAMS_WHOLESALE)
    final_model.fit(train_final[FEATURES], train_final[TARGET], sample_weight=sample_weight_final)
    joblib.dump(final_model, MODEL_OUT_FINAL)
    print(f"[저장] {MODEL_OUT_FINAL} ({len(train_final)}행 전체 학습)")


if __name__ == "__main__":
    main()
