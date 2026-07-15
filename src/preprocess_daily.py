"""위판(도매) 데이터 전처리: 항구별 일별 집계 -> 항구별 주별 집계 + 특징 생성.

입력: data/raw/raw_wipan_gyeongnam.xlsx, data/raw/raw_ocean_weather_5regions_daily.csv
출력: data/processed/merged_byport_daily.csv, data/processed/merged_byport_weekly.csv
"""
import numpy as np
import pandas as pd

from common import REGION_MAP, WEATHER_REGION_BY_ID

RAW_WIPAN = "data/raw/raw_wipan_gyeongnam.xlsx"
RAW_WEATHER = "data/raw/raw_ocean_weather_5regions_daily.csv"
OUT_DAILY = "data/processed/merged_byport_daily.csv"
OUT_WEEKLY = "data/processed/merged_byport_weekly.csv"

STUDY_START = "2023-01-01"
STUDY_END = "2025-12-31"


def load_wipan():
    sheets = pd.read_excel(RAW_WIPAN, sheet_name=None)
    wipan = pd.concat(sheets.values(), ignore_index=True)
    wipan["date"] = pd.to_datetime(
        dict(year=wipan["연도"], month=wipan["월"], day=wipan["일"])
    )
    for col in ["위판중량", "위판금액"]:
        wipan[col] = pd.to_numeric(wipan[col], errors="coerce")
    return wipan


def load_weather():
    weather = pd.read_csv(RAW_WEATHER)
    weather["date"] = pd.to_datetime(weather["date"])
    weather = weather.rename(columns={"region_name": "weather_region"})
    # raw_ocean_weather_5regions_daily.csv는 2026년 행까지 포함하므로 연구 기간(~2025-12-31)으로 제한
    weather = weather[(weather["date"] >= STUDY_START) & (weather["date"] <= STUDY_END)]
    return weather[["date", "weather_region", "wind_speed", "water_temp"]]


def build_daily_wipan(wipan):
    daily = (
        wipan.groupby(["date", "항구"])
        .agg(
            total_weight=("위판중량", "sum"),
            total_amount=("위판금액", "sum"),
            trade_count=("위판중량", "count"),
        )
        .reset_index()
    )
    daily["price_per_kg"] = daily["total_amount"] / daily["total_weight"]

    daily["region_id"] = daily["항구"].map(REGION_MAP)
    missing = daily[daily["region_id"].isna()]["항구"].unique()
    if len(missing) > 0:
        raise ValueError(f"REGION_MAP에 없는 항구명 발견: {missing}")
    daily["region_id"] = daily["region_id"].astype(int)
    daily["weather_region"] = daily["region_id"].map(WEATHER_REGION_BY_ID)

    return daily


def add_calendar_features(df, date_col="date"):
    df = df.copy()
    df["month"] = df[date_col].dt.month
    df["weekday"] = df[date_col].dt.weekday
    df["season_peak"] = df["month"].isin([9, 10, 11, 12]).astype(int)
    return df


def build_weekly(daily_wipan, weather):
    daily_wipan = daily_wipan.copy()
    daily_wipan["week_start"] = daily_wipan["date"] - pd.to_timedelta(
        daily_wipan["date"].dt.weekday, unit="D"
    )

    weekly_wipan = (
        daily_wipan.groupby(["week_start", "region_id"])
        .agg(
            total_weight=("total_weight", "sum"),
            total_amount=("total_amount", "sum"),
            trade_count=("trade_count", "sum"),
        )
        .reset_index()
    )
    weekly_wipan["price_per_kg"] = (
        weekly_wipan["total_amount"] / weekly_wipan["total_weight"]
    )
    weekly_wipan["weather_region"] = weekly_wipan["region_id"].map(WEATHER_REGION_BY_ID)

    weather = weather.copy()
    weather["week_start"] = weather["date"] - pd.to_timedelta(
        weather["date"].dt.weekday, unit="D"
    )
    weekly_weather = (
        weather.groupby(["week_start", "weather_region"])
        .agg(water_temp=("water_temp", "mean"), wind_speed=("wind_speed", "mean"))
        .reset_index()
    )

    weekly_df = weekly_wipan.merge(
        weekly_weather, on=["week_start", "weather_region"], how="inner"
    )

    weekly_df["month"] = weekly_df["week_start"].dt.month
    weekly_df["season_peak"] = weekly_df["month"].isin([9, 10, 11, 12]).astype(int)
    weekly_df["week_of_year"] = weekly_df["week_start"].dt.isocalendar().week.astype(int)
    # week_of_year를 순환형으로 인코딩 (52주 다음이 1주로 이어지는 연속성을 반영)
    weekly_df["week_of_year_sin"] = np.sin(2 * np.pi * weekly_df["week_of_year"] / 52)
    weekly_df["week_of_year_cos"] = np.cos(2 * np.pi * weekly_df["week_of_year"] / 52)

    weekly_df = weekly_df.sort_values(["region_id", "week_start"]).reset_index(drop=True)

    weekly_df["rolling_weight_4w"] = weekly_df.groupby("region_id")["total_weight"].transform(
        lambda s: s.shift(1).rolling(4).mean()
    )
    weekly_df["rolling_weight_12w"] = weekly_df.groupby("region_id")["total_weight"].transform(
        lambda s: s.shift(1).rolling(12).mean()
    )
    for lag in (1, 2, 3):
        weekly_df[f"lag_weight_{lag}w"] = weekly_df.groupby("region_id")["total_weight"].transform(
            lambda s, lag=lag: s.shift(lag)
        )

    # 도매가격 모델용: 가격 자체의 lag/rolling (가격의 자기상관을 반영)
    weekly_df["lag_price_1w"] = weekly_df.groupby("region_id")["price_per_kg"].transform(
        lambda s: s.shift(1)
    )
    weekly_df["rolling_price_4w"] = weekly_df.groupby("region_id")["price_per_kg"].transform(
        lambda s: s.shift(1).rolling(4).mean()
    )

    return weekly_df


def main():
    wipan = load_wipan()
    weather = load_weather()
    print(f"[wipan] {len(wipan)}건 로드 (2023~2025 시트 합산)")
    print(f"[weather] {len(weather)}행 로드 (5개 관측지역 x 일자, 2023-01-01~2025-12-31 필터 후)")

    daily_wipan = build_daily_wipan(wipan)
    print(f"[daily_wipan] 항구별 일별 집계 {len(daily_wipan)}행")

    merged_daily = daily_wipan.merge(weather, on=["date", "weather_region"], how="inner")
    merged_daily = add_calendar_features(merged_daily)
    merged_daily = merged_daily.sort_values(["region_id", "date"]).reset_index(drop=True)
    merged_daily.to_csv(OUT_DAILY, index=False, encoding="utf-8-sig")
    print(f"[merged_byport_daily] {len(merged_daily)}행 저장 -> {OUT_DAILY}")
    print(merged_daily.head())

    weekly_df = build_weekly(daily_wipan, weather)
    weekly_df.to_csv(OUT_WEEKLY, index=False, encoding="utf-8-sig")
    print(f"[merged_byport_weekly] {len(weekly_df)}행 저장 -> {OUT_WEEKLY}")

    na_counts = weekly_df.isna().sum()
    na_counts = na_counts[na_counts > 0]
    if len(na_counts) > 0:
        print("[결측치] rolling/lag feature 초기 구간에서 발생 (정상):")
        print(na_counts)
    print(weekly_df.head())


if __name__ == "__main__":
    main()
