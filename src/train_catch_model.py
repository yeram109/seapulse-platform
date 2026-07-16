"""어획량 예측 모델 (주별, 항구별 패널 데이터).

기획서 6.8절: 검증용 모델(2023~2024 학습/2025 검증)과 배포용 모델(2023~2025 전체
재학습, 동일 하이퍼파라미터)을 구분해서 저장한다. 배포용은 held-out 검증 대상이
없으므로 별도 MAE를 산출하지 않고 검증용 결과를 참고치로 사용한다.

입력: data/processed/merged_byport_weekly.csv
출력: models/catch_model_val.pkl, models/catch_model_final.pkl
      outputs/catch_predictions.csv (검증용 모델의 검증기간 공식 산출물, 7.2절 스키마)
      data/processed/catch_predictions_full.csv (검증용 모델의 전 기간 predicted_catch,
      도매가격 검증용 모델이 (region_id, week_start) 기준으로 join해서 쓰는 내부 중간산출물)
      data/processed/catch_predictions_full_final.csv (배포용 모델의 전 기간 predicted_catch,
      도매가격 배포용 모델의 입력 체이닝용)
"""
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from common import (
    CATCH_UNCERTAIN_THRESHOLD,
    MODEL_VERSION_VAL,
    RF_PARAMS_CATCH,
    SPECIES_ID,
    TEST_START,
    TRAIN_END,
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
MODEL_OUT_VAL = "models/catch_model_val.pkl"
MODEL_OUT_FINAL = "models/catch_model_final.pkl"
PRED_OUT = "outputs/catch_predictions.csv"
FULL_PRED_OUT = "data/processed/catch_predictions_full.csv"
FULL_PRED_OUT_FINAL = "data/processed/catch_predictions_full_final.csv"

BASE_FEATURES = [
    "month",
    "week_of_year_sin",
    "week_of_year_cos",
    "season_peak",
    "water_temp",
    "wind_speed",
]
TARGET = "total_weight"


def main():
    df = pd.read_csv(WEEKLY, parse_dates=["week_start"])
    df, region_cols = add_region_dummies(df)
    FEATURES = BASE_FEATURES + region_cols

    train = df[df["week_start"] <= TRAIN_END].dropna(subset=FEATURES)
    test = df[df["week_start"] >= TEST_START].copy()

    test_na = test[FEATURES].isna().sum()
    test_na = test_na[test_na > 0]
    if len(test_na) > 0:
        print(f"[경고] 검증셋에 결측 특징 존재, 해당 행 제외:\n{test_na}")
        test = test.dropna(subset=FEATURES)

    print(f"[분할] train={len(train)}행 (~{TRAIN_END}), test={len(test)}행 ({TEST_START}~)")

    X_train, y_train = train[FEATURES], train[TARGET]
    X_test, y_test = test[FEATURES], test[TARGET]

    print("[검증용 모델] 2023~2024 학습 / 2025 검증")
    model = RandomForestRegressor(**RF_PARAMS_CATCH)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    lower, upper = tree_confidence_interval(model, X_test)
    y_pred = clip_to_bounds(y_pred, lower, upper)
    mae, rmse = compute_metrics(y_test, y_pred)
    print(f"[성능] catch_model MAE={mae:.2f}kg, RMSE={rmse:.2f}kg")

    ratio = (upper - lower) / pd.Series(y_pred).replace(0, pd.NA)
    print(f"[interval_width_ratio] median={ratio.median():.2f}, mean={ratio.mean():.2f}, "
          f"p25={ratio.quantile(.25):.2f}, p75={ratio.quantile(.75):.2f}")

    flag = uncertain_flag(y_pred, lower, upper, threshold=CATCH_UNCERTAIN_THRESHOLD)
    print(f"[catch_uncertain] threshold={CATCH_UNCERTAIN_THRESHOLD} -> uncertain 비율 {flag.mean()*100:.1f}%")

    preds = pd.DataFrame(
        {
            "species_id": SPECIES_ID,
            "region_id": test["region_id"].values,
            "feature_id": range(1, len(test) + 1),
            "week_start": test["week_start"].dt.strftime("%Y-%m-%d").values,
            "predicted_catch": y_pred,
            "lower_bound": lower,
            "upper_bound": upper,
            "mae": mae,
            "model_version": MODEL_VERSION_VAL,
            "catch_uncertain": flag,
        }
    )

    check_bounds(preds, "predicted_catch")

    record_metrics(
        "catch",
        mae=mae,
        rmse=rmse,
        n_train=len(train),
        n_test=len(test),
        uncertain_ratio=flag.mean(),
        threshold=CATCH_UNCERTAIN_THRESHOLD,
    )

    preds.to_csv(PRED_OUT, index=False, encoding="utf-8-sig")
    joblib.dump(model, MODEL_OUT_VAL)
    print(f"[저장] {MODEL_OUT_VAL}, {PRED_OUT}")
    print(preds.head())

    # 도매가격 검증용 모델 체이닝용: 학습+검증 전 기간에 대해 predicted_catch 생성
    full = df.dropna(subset=FEATURES).copy()
    full["predicted_catch"] = model.predict(full[FEATURES])
    full_out = full[["region_id", "week_start", "predicted_catch"]].copy()
    full_out["week_start"] = full_out["week_start"].dt.strftime("%Y-%m-%d")
    full_out.to_csv(FULL_PRED_OUT, index=False, encoding="utf-8-sig")
    print(f"[저장] {FULL_PRED_OUT} ({len(full_out)}행, 도매 검증용 모델 입력용)")

    # 기획서 6.8절: 배포용 모델은 2023~2025 전체 데이터로 동일 하이퍼파라미터 재학습.
    # held-out 검증셋이 없으므로 별도 MAE는 산출하지 않고, 위 검증용 모델의 결과를
    # 참고치로 사용한다 (model_metrics.csv에 별도 행을 만들지 않음).
    print("[배포용 모델] 2023~2025 전체 데이터로 재학습 (참고 성능은 검증용 모델과 동일)")
    final_model = RandomForestRegressor(**RF_PARAMS_CATCH)
    final_model.fit(full[FEATURES], full[TARGET])
    joblib.dump(final_model, MODEL_OUT_FINAL)
    print(f"[저장] {MODEL_OUT_FINAL} ({len(full)}행 전체 학습)")

    full_final_out = full[["region_id", "week_start"]].copy()
    full_final_out["predicted_catch"] = final_model.predict(full[FEATURES])
    full_final_out["week_start"] = full_final_out["week_start"].dt.strftime("%Y-%m-%d")
    full_final_out.to_csv(FULL_PRED_OUT_FINAL, index=False, encoding="utf-8-sig")
    print(f"[저장] {FULL_PRED_OUT_FINAL} ({len(full_final_out)}행, 도매 배포용 모델 입력용)")


if __name__ == "__main__":
    main()
