"""세 모델(어획량/도매/소매) 공용 평가 유틸: MAE/RMSE, 신뢰구간, 불확실성 플래그."""
import os

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

from common import MODEL_VERSION, PRICE_UNCERTAIN_THRESHOLD as UNCERTAIN_THRESHOLD

METRICS_OUT = "outputs/model_metrics.csv"


def compute_metrics(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = mean_squared_error(y_true, y_pred) ** 0.5
    return mae, rmse


def tree_confidence_interval(model, X):
    """개별 트리 예측값의 5~95 퍼센타일을 신뢰구간으로 사용."""
    X_arr = X.values if hasattr(X, "values") else X
    tree_preds = np.array([tree.predict(X_arr) for tree in model.estimators_])
    lower = np.percentile(tree_preds, 5, axis=0)
    upper = np.percentile(tree_preds, 95, axis=0)
    return lower, upper


def uncertain_flag(y_pred, lower, upper, threshold=UNCERTAIN_THRESHOLD):
    y_pred = np.asarray(y_pred, dtype=float)
    y_pred_safe = np.where(y_pred == 0, np.nan, y_pred)
    interval_width_ratio = (upper - lower) / y_pred_safe
    return (np.nan_to_num(interval_width_ratio, nan=0.0) > threshold).astype(int)


def clip_to_bounds(y_pred, lower, upper):
    """앙상블 평균 예측치가 개별 트리 5~95 퍼센타일 구간을 벗어나는 드문 경우를 구간 안으로 clip."""
    return np.clip(y_pred, lower, upper)


def check_bounds(df, pred_col, lower_col="lower_bound", upper_col="upper_bound"):
    """lower <= pred <= upper가 모든 행에서 성립하는지 확인하고 위반 건수를 반환."""
    violations = ~((df[lower_col] <= df[pred_col]) & (df[pred_col] <= df[upper_col]))
    n_violations = int(violations.sum())
    if n_violations > 0:
        print(f"[검증 실패] {pred_col}: lower<=pred<=upper 위반 {n_violations}건")
    else:
        print(f"[검증 통과] {pred_col}: 모든 행에서 lower<=pred<=upper 성립")
    return n_violations


def record_metrics(model_name, mae, rmse, n_train, n_test, uncertain_ratio, threshold, path=METRICS_OUT):
    """모델별 성능 요약을 outputs/model_metrics.csv에 기록(같은 model_name 행은 갱신)."""
    row = pd.DataFrame(
        [
            {
                "model": model_name,
                "mae": mae,
                "rmse": rmse,
                "n_train": n_train,
                "n_test": n_test,
                "uncertain_ratio": uncertain_ratio,
                "uncertain_threshold": threshold,
                "model_version": MODEL_VERSION,
            }
        ]
    )
    if os.path.exists(path):
        existing = pd.read_csv(path)
        existing = existing[existing["model"] != model_name]
        combined = pd.concat([existing, row], ignore_index=True)
    else:
        combined = row

    order = ["catch", "wholesale_price", "retail_price"]
    combined["_order"] = combined["model"].apply(lambda m: order.index(m) if m in order else len(order))
    combined = combined.sort_values("_order").drop(columns="_order").reset_index(drop=True)

    combined.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"[저장] {path}에 '{model_name}' 성능 기록")
    return combined
