"""기획서 6.7절: 미래 예측 Feature 생성 및 추론.

train_*.py(학습+검증)와 달리 이 스크립트는 학습을 하지 않고, 6.8절의 배포용
모델(*_final.pkl)로 아직 관측되지 않은 미래 주차만 추론한다.

6.7절 규칙 (5개 지역 날씨 전환에 맞춰 갱신 — 아래 "갱신" 표시 참고):
- 항구(region_id)별로 개별 생성. 한 항구의 값을 다른 항구 예측에 섞지 않음
- month/week_start/week_of_year는 예측 대상 주에서 파생
- [갱신] water_temp/wind_speed: 원문은 "거제도 대표값을 모든 항구에 동일 적용"이었으나,
  날씨가 5개 지역 관측소로 세분화된 이후에는 항구별 관측지역(WEATHER_REGION_BY_ID)의
  예보를 사용. 예보 파일(FORECAST_WEATHER)이 있으면 그 값을, 없으면 그 관측지역의
  동일 주차(week_of_year) 과거 평균값을 사용
- [갱신] rolling_weight/lag_weight, rolling_price/lag_price: catch/wholesale 모델이 최근성
  특징(직전 실측 없이는 의미가 없고, 체이닝할수록 예측 위에 예측이 쌓여 오차가 누적되는 문제가
  있었음, feat/seasonal-forecast-model 참고)을 더 이상 쓰지 않게 되면서, 이 값들은 모델 입력이
  아니라 feature_set 테이블 기록용으로만 계속 계산한다(과거엔 실제 관측값, 예측 시작 이후엔
  이전 스텝 예측값을 순차 대입 — 감사 추적 목적일 뿐 예측 결과에는 영향 없음). 모델은 이제
  계절(month/week_of_year/season_peak)·날씨·항구만으로 예측하므로, 주차 간 의존성이 없어져
  FUTURE_WEEKS를 늘려도 체이닝발 오차 누적 없이 안전하다.

기획서 6.8절: 배포용 모델은 held-out 검증셋이 없으므로 mae는 outputs/model_metrics.csv의
검증용 모델 결과를 참고치로 그대로 사용한다.

입력: data/processed/merged_byport_weekly.csv, data/raw/raw_ocean_weather_5regions_daily.csv,
      (선택) data/raw/weather_forecast_5regions.csv — 있으면 예보로 사용, 없으면 전부
      과거 동일 주차 평균으로 대체
      models/catch_model_final.pkl, models/wholesale_price_model_final.pkl
출력: outputs/catch_predictions_future.csv, outputs/price_predictions_future.csv (price_type=wholesale)
      data/processed/feature_set_future.csv (각 미래 예측에 실제 사용된 특징값 —
      load_to_db.py가 feature_set 테이블에 적재할 때 사용)
"""
import joblib
import numpy as np
import pandas as pd

from common import (
    CATCH_UNCERTAIN_THRESHOLD,
    MODEL_VERSION_FINAL,
    PRICE_UNCERTAIN_THRESHOLD,
    REGION_IDS,
    SPECIES_ID,
    WEATHER_REGION_BY_ID,
)
from evaluate import check_bounds, clip_to_bounds, tree_confidence_interval, uncertain_flag
from train_catch_model import BASE_FEATURES as CATCH_BASE_FEATURES
from train_wholesale_price_model import BASE_FEATURES as WHOLESALE_BASE_FEATURES

WEEKLY = "data/processed/merged_byport_weekly.csv"
RAW_WEATHER = "data/raw/raw_ocean_weather_5regions_daily.csv"
FORECAST_WEATHER = "data/raw/weather_forecast_5regions.csv"
CATCH_MODEL = "models/catch_model_final.pkl"
WHOLESALE_MODEL = "models/wholesale_price_model_final.pkl"
METRICS = "outputs/model_metrics.csv"
CATCH_OUT = "outputs/catch_predictions_future.csv"
PRICE_OUT = "outputs/price_predictions_future.csv"
FEATURE_OUT = "data/processed/feature_set_future.csv"

FUTURE_WEEKS = 52  # 항구별로 마지막 관측 주 다음부터 몇 주를 예측할지 (체이닝 제거로 장기 확장 안전, feat/seasonal-forecast-model)
REGION_COLS = [f"region_{r}" for r in REGION_IDS]
CATCH_FEATURES = CATCH_BASE_FEATURES + REGION_COLS
WHOLESALE_FEATURES = WHOLESALE_BASE_FEATURES + REGION_COLS


def build_weather_lookup():
    """(weather_region, week_of_year) -> 과거 평균 water_temp/wind_speed."""
    weather = pd.read_csv(RAW_WEATHER)
    weather = weather.rename(columns={"region_name": "weather_region"})
    weather["date"] = pd.to_datetime(weather["date"])
    weather["week_of_year"] = weather["date"].dt.isocalendar().week.astype(int)
    lookup = (
        weather.groupby(["weather_region", "week_of_year"])
        .agg(water_temp=("water_temp", "mean"), wind_speed=("wind_speed", "mean"))
        .to_dict(orient="index")
    )
    overall = weather.groupby("weather_region").agg(
        water_temp=("water_temp", "mean"), wind_speed=("wind_speed", "mean")
    )
    return lookup, overall


def load_forecast():
    try:
        fc = pd.read_csv(FORECAST_WEATHER)
    except FileNotFoundError:
        print(f"[날씨 예보] {FORECAST_WEATHER} 없음 -> 전 구간 과거 동일 주차 평균으로 대체")
        return None
    fc = fc.rename(columns={"region_name": "weather_region"})
    fc["week_start"] = pd.to_datetime(fc["week_start"])
    print(f"[날씨 예보] {FORECAST_WEATHER} 로드 {len(fc)}행")
    return fc


def get_weather(weather_region, week_start, week_of_year, forecast, lookup, overall):
    if forecast is not None:
        row = forecast[
            (forecast["weather_region"] == weather_region) & (forecast["week_start"] == week_start)
        ]
        if len(row) > 0:
            return float(row["water_temp"].iloc[0]), float(row["wind_speed"].iloc[0])
    key = (weather_region, week_of_year)
    if key in lookup:
        return lookup[key]["water_temp"], lookup[key]["wind_speed"]
    return overall.loc[weather_region, "water_temp"], overall.loc[weather_region, "wind_speed"]


def region_onehot(region_id):
    return {col: (1 if col == f"region_{region_id}" else 0) for col in REGION_COLS}


def main():
    weekly = pd.read_csv(WEEKLY, parse_dates=["week_start"])
    catch_model = joblib.load(CATCH_MODEL)
    wholesale_model = joblib.load(WHOLESALE_MODEL)
    weather_lookup, weather_overall = build_weather_lookup()
    forecast = load_forecast()

    metrics = pd.read_csv(METRICS)
    catch_mae = float(metrics.loc[metrics["model"] == "catch", "mae"].iloc[0])
    wholesale_mae = float(metrics.loc[metrics["model"] == "wholesale_price", "mae"].iloc[0])
    print(f"[참고 MAE] catch={catch_mae:.2f}kg, wholesale={wholesale_mae:.2f}원/kg (6.8절: 검증용 모델 결과를 그대로 사용)")

    catch_rows = []
    price_rows = []
    feature_rows = []

    for region_id in REGION_IDS:
        weather_region = WEATHER_REGION_BY_ID[region_id]
        hist = weekly[weekly["region_id"] == region_id].sort_values("week_start")
        if hist.empty:
            print(f"[경고] region_id={region_id} 이력 없음, 건너뜀")
            continue

        weight_series = list(hist["total_weight"])
        price_series = list(hist["price_per_kg"])
        last_week = hist["week_start"].max()
        onehot = region_onehot(region_id)

        for step in range(1, FUTURE_WEEKS + 1):
            week_start = last_week + pd.Timedelta(days=7 * step)
            month = week_start.month
            week_of_year = int(week_start.isocalendar().week)
            season_peak = int(month in (9, 10, 11, 12))
            water_temp, wind_speed = get_weather(
                weather_region, week_start, week_of_year, forecast, weather_lookup, weather_overall
            )

            catch_feat = {
                "month": month,
                "week_of_year_sin": np.sin(2 * np.pi * week_of_year / 52),
                "week_of_year_cos": np.cos(2 * np.pi * week_of_year / 52),
                "season_peak": season_peak,
                "water_temp": water_temp,
                "wind_speed": wind_speed,
                "rolling_weight_4w": np.mean(weight_series[-4:]),
                "rolling_weight_12w": np.mean(weight_series[-12:]),
                "lag_weight_1w": weight_series[-1],
                "lag_weight_2w": weight_series[-2],
                "lag_weight_3w": weight_series[-3],
                **onehot,
            }
            X_catch = pd.DataFrame([catch_feat])[CATCH_FEATURES]
            catch_pred = catch_model.predict(X_catch)[0]
            c_lower, c_upper = tree_confidence_interval(catch_model, X_catch)
            catch_pred = float(clip_to_bounds(catch_pred, c_lower[0], c_upper[0]))
            catch_flag = int(uncertain_flag([catch_pred], c_lower, c_upper, threshold=CATCH_UNCERTAIN_THRESHOLD)[0])

            weight_series.append(catch_pred)

            wholesale_feat = {
                **catch_feat,
                "lag_price_1w": price_series[-1],
                "rolling_price_4w": np.mean(price_series[-4:]),
                "predicted_catch": catch_pred,
            }
            X_wholesale = pd.DataFrame([wholesale_feat])[WHOLESALE_FEATURES]
            price_pred = wholesale_model.predict(X_wholesale)[0]
            p_lower, p_upper = tree_confidence_interval(wholesale_model, X_wholesale)
            price_pred = float(clip_to_bounds(price_pred, p_lower[0], p_upper[0]))
            price_flag = int(uncertain_flag([price_pred], p_lower, p_upper, threshold=PRICE_UNCERTAIN_THRESHOLD)[0])

            price_series.append(price_pred)

            feature_rows.append(
                {
                    "region_id": region_id,
                    "week_start": week_start.strftime("%Y-%m-%d"),
                    "lag_weight_1w": catch_feat["lag_weight_1w"],
                    "lag_weight_2w": catch_feat["lag_weight_2w"],
                    "lag_weight_3w": catch_feat["lag_weight_3w"],
                    "rolling_weight_4w": catch_feat["rolling_weight_4w"],
                    "rolling_weight_12w": catch_feat["rolling_weight_12w"],
                    "lag_price_1w": wholesale_feat["lag_price_1w"],
                    "rolling_price_4w": wholesale_feat["rolling_price_4w"],
                    "season_peak": season_peak,
                    "water_temp": water_temp,
                    "wind_speed": wind_speed,
                    "week_of_year": week_of_year,
                }
            )

            catch_rows.append(
                {
                    "species_id": SPECIES_ID,
                    "region_id": region_id,
                    "feature_id": len(catch_rows) + 1,
                    "week_start": week_start.strftime("%Y-%m-%d"),
                    "predicted_catch": catch_pred,
                    "lower_bound": float(c_lower[0]),
                    "upper_bound": float(c_upper[0]),
                    "mae": catch_mae,
                    "model_version": MODEL_VERSION_FINAL,
                    "catch_uncertain": catch_flag,
                }
            )
            price_rows.append(
                {
                    "catch_prediction_id": len(catch_rows),
                    "species_id": SPECIES_ID,
                    "feature_id": len(price_rows) + 1,
                    "target_date": week_start.strftime("%Y-%m-%d"),
                    "predicted_price": price_pred,
                    "lower_bound": float(p_lower[0]),
                    "upper_bound": float(p_upper[0]),
                    "mae": wholesale_mae,
                    "model_version": MODEL_VERSION_FINAL,
                    "price_type": "wholesale",
                    "price_uncertain": price_flag,
                }
            )

        print(f"[region_id={region_id}] {weather_region} 관측지역 기준 {FUTURE_WEEKS}주 예측 완료 (마지막 관측주 {last_week.date()})")

    catch_df = pd.DataFrame(catch_rows)
    price_df = pd.DataFrame(price_rows)

    check_bounds(catch_df, "predicted_catch")
    check_bounds(price_df, "predicted_price")

    catch_df.to_csv(CATCH_OUT, index=False, encoding="utf-8-sig")
    price_df.to_csv(PRICE_OUT, index=False, encoding="utf-8-sig")
    pd.DataFrame(feature_rows).to_csv(FEATURE_OUT, index=False, encoding="utf-8-sig")
    print(f"[저장] {CATCH_OUT} ({len(catch_df)}행), {PRICE_OUT} ({len(price_df)}행), {FEATURE_OUT} ({len(feature_rows)}행)")
    print(catch_df.head())
    print(price_df.head())


if __name__ == "__main__":
    main()
