"""소매(노량진) 데이터 전처리: 월별 재집계 + 도매/날씨 특징 병합.

raw_noryangjin.xlsx는 기획서가 가정한 "노량진 소매가 단일 시계열"이 아니라
위판 데이터와 동일한 거래 구조(산지별 거래건수/총중량/총금액)를 가진다.
따라서 (1) 산지 전체 합산 총금액/총중량으로 월별 목표가격을 계산하고,
(2) 산지(항구) 정보는 dominant_origin_id / origin_count 특징으로 보존한다.

입력: data/raw/raw_noryangjin.xlsx, data/processed/merged_byport_daily.csv
출력: data/processed/merged_gyeongnam_monthly.csv
"""
import pandas as pd

from common import REGION_MAP

RAW_NORYANGJIN = "data/raw/raw_noryangjin.xlsx"
DAILY_WIPAN = "data/processed/merged_byport_daily.csv"
OUT_MONTHLY = "data/processed/merged_gyeongnam_monthly.csv"


def load_noryangjin():
    sheets = pd.read_excel(RAW_NORYANGJIN, sheet_name=None)
    df = pd.concat(sheets.values(), ignore_index=True)
    df["year_month"] = pd.to_datetime(
        dict(year=df["연도"], month=df["월"], day=1)
    ).dt.to_period("M")
    for col in ["총중량", "총금액"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def build_monthly_retail(noryangjin):
    monthly_price = (
        noryangjin.groupby("year_month")
        .agg(total_weight_retail=("총중량", "sum"), total_amount_retail=("총금액", "sum"))
        .reset_index()
    )
    monthly_price["노량진_kg당가격"] = (
        monthly_price["total_amount_retail"] / monthly_price["total_weight_retail"]
    )

    by_origin = (
        noryangjin.groupby(["year_month", "항구"])["총중량"].sum().reset_index()
    )
    dominant = (
        by_origin.loc[by_origin.groupby("year_month")["총중량"].idxmax()]
        [["year_month", "항구"]]
        .rename(columns={"항구": "dominant_origin"})
    )
    origin_count = (
        noryangjin.groupby("year_month")["항구"]
        .nunique()
        .reset_index()
        .rename(columns={"항구": "origin_count"})
    )

    monthly_retail = monthly_price.merge(dominant, on="year_month").merge(
        origin_count, on="year_month"
    )

    monthly_retail["dominant_origin_id"] = monthly_retail["dominant_origin"].map(REGION_MAP)
    unmapped = monthly_retail[monthly_retail["dominant_origin_id"].isna()]["dominant_origin"].unique()
    if len(unmapped) > 0:
        print(f"[경고] REGION_MAP에 없는 산지명 발견 (dominant_origin_id 결측으로 남김): {unmapped}")

    return monthly_retail.drop(columns=["total_weight_retail", "total_amount_retail"])


def build_monthly_wipan_and_weather(daily):
    daily = daily.copy()
    daily["date"] = pd.to_datetime(daily["date"])
    daily["year_month"] = daily["date"].dt.to_period("M")

    monthly_wipan = (
        daily.groupby("year_month")
        .agg(total_weight=("total_weight", "sum"), total_amount=("total_amount", "sum"))
        .reset_index()
    )
    monthly_wipan["wholesale_price"] = (
        monthly_wipan["total_amount"] / monthly_wipan["total_weight"]
    )
    monthly_wipan = monthly_wipan.drop(columns=["total_amount"])

    # 항구마다 날씨 관측지역(weather_region)이 다르므로, (date, weather_region) 기준으로
    # 중복 제거한 뒤 평균을 내야 5개 관측지역이 고르게 반영됨. 그냥 date로만 중복 제거하면
    # 항구 순서에 따라 특정 관측지역(예: 3개 항구가 몰린 마산)이 우연히 뽑히거나
    # 과대표집되는 문제가 생김.
    daily_weather_unique = daily.drop_duplicates(subset=["date", "weather_region"])[
        ["date", "year_month", "weather_region", "water_temp", "wind_speed"]
    ]
    monthly_weather = (
        daily_weather_unique.groupby("year_month")
        .agg(water_temp=("water_temp", "mean"), wind_speed=("wind_speed", "mean"))
        .reset_index()
    )

    return monthly_wipan, monthly_weather


def main():
    noryangjin = load_noryangjin()
    print(f"[noryangjin] {len(noryangjin)}건 로드 (2023~2025 시트 합산)")

    daily = pd.read_csv(DAILY_WIPAN)
    monthly_retail = build_monthly_retail(noryangjin)
    monthly_wipan, monthly_weather = build_monthly_wipan_and_weather(daily)

    merged = (
        monthly_retail.merge(monthly_wipan, on="year_month", how="inner")
        .merge(monthly_weather, on="year_month", how="inner")
    )
    merged["month"] = merged["year_month"].dt.month
    merged = merged.sort_values("year_month").reset_index(drop=True)

    merged.to_csv(OUT_MONTHLY, index=False, encoding="utf-8-sig")
    print(f"[merged_gyeongnam_monthly] {len(merged)}행 저장 -> {OUT_MONTHLY}")

    na_counts = merged.isna().sum()
    na_counts = na_counts[na_counts > 0]
    if len(na_counts) > 0:
        print("[결측치]")
        print(na_counts)
    print(merged.head())


if __name__ == "__main__":
    main()
