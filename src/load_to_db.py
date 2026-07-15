"""outputs/*.csv 예측 결과를 백엔드 DB(seapulse_final.db)에 적재.

- 검증용 모델 결과(outputs/catch_predictions.csv, price_predictions.csv의
  price_type=wholesale 행)와 배포용 모델의 미래 예측(outputs/catch_predictions_future.csv,
  price_predictions_future.csv)을 모두 적재한다. model_version의 _val/_final 접미사로
  두 종류가 구분된다.
- 소매(retail) 예측은 실서비스에서 사용하지 않기로 한 결정에 따라 DB에 적재하지 않는다.
- feature_set에 실제 특징값을 먼저 넣어 진짜 feature_id를 발급받고, catch_predictions/
  price_predictions가 그 feature_id를 FK로 참조하게 한다. 같은 (region_id, week_start)의
  catch/price 예측은 같은 feature_set 행을 공유한다(특징이 동일하므로 중복 생성하지 않음).
- catch_uncertain/price_uncertain은 우리 쪽 공식(신뢰구간 폭/예측값 > threshold)으로 이미
  계산된 값을 그대로 저장한다 — DB 쪽 노트북의 2×MAE 공식은 쓰지 않는다.
- 재실행해도 중복 적재되지 않도록, 적재 전 feature_set/catch_predictions/price_predictions를
  비운다(다른 테이블은 건드리지 않음).

입력: data/seapulse_final.db, data/processed/merged_byport_weekly.csv,
      data/processed/feature_set_future.csv,
      outputs/catch_predictions.csv, outputs/catch_predictions_future.csv,
      outputs/price_predictions.csv, outputs/price_predictions_future.csv
출력: data/seapulse_final.db (feature_set/catch_predictions/price_predictions 채움)
"""
import sqlite3

import pandas as pd

from common import SPECIES_ID

DB_PATH = "data/seapulse_final.db"
WEEKLY = "data/processed/merged_byport_weekly.csv"
FEATURE_FUTURE = "data/processed/feature_set_future.csv"
CATCH_VAL = "outputs/catch_predictions.csv"
CATCH_FUTURE = "outputs/catch_predictions_future.csv"
PRICE_VAL = "outputs/price_predictions.csv"
PRICE_FUTURE = "outputs/price_predictions_future.csv"

FEATURE_COLS = [
    "lag_weight_1w",
    "lag_weight_2w",
    "lag_weight_3w",
    "rolling_weight_4w",
    "rolling_weight_12w",
    "lag_price_1w",
    "rolling_price_4w",
    "season_peak",
    "water_temp",
    "wind_speed",
    "week_of_year",
]


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def clear_prediction_tables(conn):
    """재실행 시 중복 적재를 막기 위해 예측 관련 테이블을 비움 (FK 역순).

    scenarios/warehouse_view/fisher_view/predictions_log는 팀원이 스키마 검증용으로
    남긴 더미 테스트 행(catch_predictions/price_predictions을 참조)까지 함께 지운다 —
    이 DB는 로컬로 복사해온 사본이라 원본에는 영향 없음.
    """
    cur = conn.cursor()
    for t in ("predictions_log", "warehouse_view", "fisher_view", "reports", "scenarios"):
        cur.execute(f"DELETE FROM {t}")
    cur.execute("DELETE FROM price_predictions")
    cur.execute("DELETE FROM catch_predictions")
    cur.execute("DELETE FROM feature_set")
    conn.commit()
    print("[초기화] scenarios 계열 더미 테스트 행 + feature_set/catch_predictions/price_predictions 비움")


def get_or_create_feature_id(cur, feature_cache, region_id, week_start, feat):
    """같은 (region_id, week_start)에 대한 feature_set 행을 재사용한다."""
    key = (region_id, week_start)
    if key in feature_cache:
        return feature_cache[key]

    cur.execute(
        "INSERT INTO feature_set (species_id, region_id, base_date, lag_feature, rolling_feature, "
        "week_of_year, water_temp_feature, wind_speed_feature, lag_weight_1w, lag_weight_2w, "
        "lag_weight_3w, rolling_weight_4w, rolling_weight_12w, lag_price_1w, rolling_price_4w, season_peak) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            SPECIES_ID,
            region_id,
            week_start,
            feat["lag_weight_1w"],  # lag_feature: 기존 범용 컬럼엔 대표값(1주 전 물량)을 넣음
            feat["rolling_weight_4w"],  # rolling_feature: 대표값(4주 이동평균)
            int(feat["week_of_year"]),
            feat["water_temp"],
            feat["wind_speed"],
            feat["lag_weight_1w"],
            feat["lag_weight_2w"],
            feat["lag_weight_3w"],
            feat["rolling_weight_4w"],
            feat["rolling_weight_12w"],
            feat["lag_price_1w"],
            feat["rolling_price_4w"],
            int(feat["season_peak"]),
        ),
    )
    feature_id = cur.lastrowid
    feature_cache[key] = feature_id
    return feature_id


def load_catch(conn, path, feature_lookup, feature_cache):
    """catch_predictions.csv(또는 future)를 적재하고, 행 순서대로 실제 catch_prediction_id 리스트를 반환."""
    df = pd.read_csv(path)
    cur = conn.cursor()
    real_ids = []
    for _, row in df.iterrows():
        key = (int(row["region_id"]), row["week_start"])
        feat = feature_lookup.get(key)
        if feat is None:
            raise KeyError(f"{path}: (region_id, week_start)={key}에 대한 특징값을 찾을 수 없음")
        feature_id = get_or_create_feature_id(cur, feature_cache, key[0], key[1], feat)

        cur.execute(
            "INSERT INTO catch_predictions (species_id, region_id, feature_id, week_start, "
            "predicted_catch, lower_bound, upper_bound, mae, model_version, catch_uncertain) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                int(row["species_id"]),
                key[0],
                feature_id,
                key[1],
                float(row["predicted_catch"]),
                float(row["lower_bound"]),
                float(row["upper_bound"]),
                float(row["mae"]),
                row["model_version"],
                int(row["catch_uncertain"]),
            ),
        )
        real_ids.append(cur.lastrowid)
    conn.commit()
    print(f"[적재] {path} -> catch_predictions {len(real_ids)}행")
    return real_ids


def load_price(conn, path, catch_real_ids, catch_region_week, feature_lookup, feature_cache):
    """price_predictions.csv(또는 future)의 price_type=wholesale 행만 적재.

    catch_real_ids: load_catch()가 반환한, 같은 파일 쌍의 행 순서별 실제 catch_prediction_id.
    catch_region_week: 같은 인덱스의 (region_id, week_start) — feature_set 공유에 사용.
    """
    df = pd.read_csv(path)
    df = df[df["price_type"] == "wholesale"].reset_index(drop=True)
    if len(df) != len(catch_real_ids):
        raise ValueError(
            f"{path}: 도매 행 수({len(df)})가 catch_predictions 행 수({len(catch_real_ids)})와 다름 "
            "— catch_prediction_id 위치 매핑이 어긋날 수 있음"
        )

    cur = conn.cursor()
    for i, row in df.iterrows():
        region_id, week_start = catch_region_week[i]
        feat = feature_lookup.get((region_id, week_start))
        feature_id = get_or_create_feature_id(cur, feature_cache, region_id, week_start, feat)

        cur.execute(
            "INSERT INTO price_predictions (catch_prediction_id, target_date, predicted_price, "
            "lower_bound, upper_bound, mae, model_version, feature_id, price_type, price_uncertain) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                catch_real_ids[i],
                row["target_date"],
                float(row["predicted_price"]),
                float(row["lower_bound"]),
                float(row["upper_bound"]),
                float(row["mae"]),
                row["model_version"],
                feature_id,
                "wholesale",
                int(row["price_uncertain"]),
            ),
        )
    conn.commit()
    print(f"[적재] {path} -> price_predictions {len(df)}행 (retail 제외)")


def build_feature_lookup():
    """(region_id, week_start) -> 특징 dict. 검증기간(실측)과 미래(예측 체이닝) 둘 다 포함."""
    weekly = pd.read_csv(WEEKLY)
    lookup = {}
    for _, row in weekly.iterrows():
        key = (int(row["region_id"]), row["week_start"])
        lookup[key] = {col: row[col] for col in FEATURE_COLS}

    future = pd.read_csv(FEATURE_FUTURE)
    for _, row in future.iterrows():
        key = (int(row["region_id"]), row["week_start"])
        lookup[key] = {col: row[col] for col in FEATURE_COLS}
    return lookup


def catch_region_week_pairs(path):
    df = pd.read_csv(path)
    return list(zip(df["region_id"].astype(int), df["week_start"]))


def main():
    conn = connect()
    clear_prediction_tables(conn)

    feature_lookup = build_feature_lookup()
    feature_cache = {}

    catch_val_ids = load_catch(conn, CATCH_VAL, feature_lookup, feature_cache)
    catch_future_ids = load_catch(conn, CATCH_FUTURE, feature_lookup, feature_cache)

    load_price(
        conn, PRICE_VAL, catch_val_ids, catch_region_week_pairs(CATCH_VAL), feature_lookup, feature_cache
    )
    load_price(
        conn, PRICE_FUTURE, catch_future_ids, catch_region_week_pairs(CATCH_FUTURE), feature_lookup, feature_cache
    )

    cur = conn.cursor()
    for t in ("feature_set", "catch_predictions", "price_predictions"):
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(f"[확인] {t}: {cur.fetchone()[0]}건")

    cur.execute("PRAGMA foreign_key_check")
    fk_errors = cur.fetchall()
    print(f"[{'PASS' if not fk_errors else 'FAIL'}] FK 무결성: {'이상없음' if not fk_errors else fk_errors}")

    conn.close()


if __name__ == "__main__":
    main()
