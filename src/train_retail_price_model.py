"""소매(노량진) 가격 예측 모델 (월별, 경남 전체 합산 + 산지 특징).

도매가격 모델과 완전히 독립: 도매 모델의 "예측치"가 아니라 그 달의
"실측 도매가 평균"(wholesale_price)을 특징으로 사용한다.

입력: data/processed/merged_gyeongnam_monthly.csv
출력: models/retail_price_model.pkl, outputs/price_predictions.csv (price_type=retail 행 추가)
"""
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from common import (
    MODEL_VERSION,
    PRICE_UNCERTAIN_THRESHOLD,
    RF_PARAMS_RETAIL,
    SPECIES_ID,
    TRAIN_END,
)
from evaluate import (
    check_bounds,
    clip_to_bounds,
    compute_metrics,
    record_metrics,
    tree_confidence_interval,
    uncertain_flag,
)

MONTHLY = "data/processed/merged_gyeongnam_monthly.csv"
MODEL_OUT = "models/retail_price_model.pkl"
PRED_OUT = "outputs/price_predictions.csv"

FEATURES = ["water_temp", "month", "wholesale_price", "dominant_origin_id", "origin_count"]
TARGET = "노량진_kg당가격"

TRAIN_END_MONTH = TRAIN_END[:7]  # "2024-12"
TEST_START_MONTH = "2025-01"


def main():
    df = pd.read_csv(MONTHLY)

    train = df[df["year_month"] <= TRAIN_END_MONTH].dropna(subset=FEATURES)
    test = df[df["year_month"] >= TEST_START_MONTH].copy()

    test_na = test[FEATURES].isna().sum()
    test_na = test_na[test_na > 0]
    if len(test_na) > 0:
        print(f"[경고] 검증셋에 결측 특징 존재, 해당 행 제외:\n{test_na}")
        test = test.dropna(subset=FEATURES)

    print(f"[분할] train={len(train)}행 (~{TRAIN_END_MONTH}), test={len(test)}행 ({TEST_START_MONTH}~)")

    X_train, y_train = train[FEATURES], train[TARGET]
    X_test, y_test = test[FEATURES], test[TARGET]

    model = RandomForestRegressor(**RF_PARAMS_RETAIL)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    lower, upper = tree_confidence_interval(model, X_test)
    y_pred = clip_to_bounds(y_pred, lower, upper)
    mae, rmse = compute_metrics(y_test, y_pred)
    print(f"[성능] retail_price_model MAE={mae:.2f}원/kg, RMSE={rmse:.2f}원/kg")

    ratio = (upper - lower) / pd.Series(y_pred).replace(0, pd.NA)
    print(f"[interval_width_ratio] median={ratio.median():.2f}, mean={ratio.mean():.2f}, "
          f"p25={ratio.quantile(.25):.2f}, p75={ratio.quantile(.75):.2f}")

    flag = uncertain_flag(y_pred, lower, upper, threshold=PRICE_UNCERTAIN_THRESHOLD)
    print(f"[price_uncertain(retail)] threshold={PRICE_UNCERTAIN_THRESHOLD} -> uncertain 비율 {flag.mean()*100:.1f}%")

    existing = pd.read_csv(PRED_OUT)
    next_feature_id = int(existing["feature_id"].max()) + 1 if len(existing) > 0 else 1

    target_date = pd.to_datetime(test["year_month"] + "-01").dt.strftime("%Y-%m-%d")

    retail_preds = pd.DataFrame(
        {
            "catch_prediction_id": pd.NA,
            "species_id": SPECIES_ID,
            "feature_id": range(next_feature_id, next_feature_id + len(test)),
            "target_date": target_date.values,
            "predicted_price": y_pred,
            "lower_bound": lower,
            "upper_bound": upper,
            "mae": mae,
            "model_version": MODEL_VERSION,
            "price_type": "retail",
            "price_uncertain": flag,
        }
    )

    check_bounds(retail_preds, "predicted_price")

    record_metrics(
        "retail_price",
        mae=mae,
        rmse=rmse,
        n_train=len(train),
        n_test=len(test),
        uncertain_ratio=flag.mean(),
        threshold=PRICE_UNCERTAIN_THRESHOLD,
    )

    combined = pd.concat([existing, retail_preds], ignore_index=True)
    assert combined["price_type"].isin(["wholesale", "retail"]).all(), "price_type에 예상 밖 값 존재"

    combined.to_csv(PRED_OUT, index=False, encoding="utf-8-sig")
    joblib.dump(model, MODEL_OUT)
    print(f"[저장] {MODEL_OUT}")
    print(f"[저장] {PRED_OUT} (wholesale {len(existing)}행 + retail {len(retail_preds)}행 = {len(combined)}행)")
    print(retail_preds.head())


if __name__ == "__main__":
    main()
