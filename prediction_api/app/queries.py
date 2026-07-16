"""조회 쿼리 모음. seapulse_final.db 실제 스키마 기준(2026-07-16 확인).

- catch_predictions: species_id, region_id, feature_id, week_start, predicted_catch,
  lower_bound, upper_bound, mae, model_version, catch_uncertain
- price_predictions: catch_prediction_id FK로만 연결 (region_id/week_start 없음),
  target_date, predicted_price, lower_bound, upper_bound, model_version, price_type,
  price_uncertain
- scenarios: catch_prediction_id, price_prediction_id, user_id(NOT NULL), scenario_type
  ("{물량수준}_{가격수준}" 예: "평년이상_하락") — generate_scenarios.py가 시스템 유저로
  일괄 생성, 재실행 시 그 유저 것만 지우고 다시 채움 -> 항상 1개만 존재
- warehouse_view: scenario_id, recommended_space, recommendation_text
- fisher_view: scenario_id, timing_type, recommendation_text

배포용 모델 결과만 쓴다 = model_version이 "final"로 끝나는 행만 ("_val"은 검증용).
"""
from datetime import date
from typing import Optional
from sqlite3 import Connection, Row

# common.py SPECIES_ID와 동일. 다종 지원 시 API 파라미터로 승격 필요.
SPECIES_ID = 1


def region_exists(conn: Connection, region_id: int) -> bool:
    row = conn.execute(
        "SELECT 1 FROM region WHERE region_id = ?", (region_id,)
    ).fetchone()
    return row is not None


def get_regions(conn: Connection) -> list[Row]:
    return conn.execute(
        "SELECT region_id, region_name FROM region ORDER BY region_id"
    ).fetchall()


def get_forecast_weeks_by_region(conn: Connection) -> dict[int, list[str]]:
    """항구별로 배포용 예측이 있는 주차 목록. 주차가 항상 7일 간격이라는 보장이
    없으므로 min/max 범위가 아니라 실제 존재하는 주차를 그대로 나열한다."""
    rows = conn.execute(
        """
        SELECT region_id, week_start
        FROM catch_predictions
        WHERE species_id = ? AND model_version LIKE '%final'
        GROUP BY region_id, week_start
        ORDER BY region_id, week_start
        """,
        (SPECIES_ID,),
    ).fetchall()
    weeks: dict[int, list[str]] = {}
    for row in rows:
        weeks.setdefault(row["region_id"], []).append(row["week_start"])
    return weeks


def get_valid_forecast_range(
    conn: Connection, region_id: int
) -> tuple[Optional[str], Optional[str]]:
    row = conn.execute(
        """
        SELECT MIN(week_start) AS min_week, MAX(week_start) AS max_week
        FROM catch_predictions
        WHERE region_id = ? AND species_id = ? AND model_version LIKE '%final'
        """,
        (region_id, SPECIES_ID),
    ).fetchone()
    return (row["min_week"], row["max_week"]) if row else (None, None)


def has_val_only_prediction(conn: Connection, region_id: int, week_start: str) -> bool:
    row = conn.execute(
        """
        SELECT 1 FROM catch_predictions
        WHERE region_id = ? AND week_start = ? AND species_id = ?
          AND model_version NOT LIKE '%final'
        LIMIT 1
        """,
        (region_id, week_start, SPECIES_ID),
    ).fetchone()
    return row is not None


def get_catch_prediction(conn: Connection, region_id: int, week_start: str) -> Optional[Row]:
    return conn.execute(
        """
        SELECT catch_prediction_id, model_version, predicted_catch,
               lower_bound, upper_bound, catch_uncertain, mae
        FROM catch_predictions
        WHERE region_id = ? AND week_start = ? AND species_id = ?
          AND model_version LIKE '%final'
        ORDER BY catch_prediction_id DESC
        LIMIT 1
        """,
        (region_id, week_start, SPECIES_ID),
    ).fetchone()


def get_price_prediction(conn: Connection, catch_prediction_id: int) -> Optional[Row]:
    return conn.execute(
        """
        SELECT model_version, predicted_price, lower_bound, upper_bound,
               price_uncertain, mae
        FROM price_predictions
        WHERE catch_prediction_id = ?
        ORDER BY price_prediction_id DESC
        LIMIT 1
        """,
        (catch_prediction_id,),
    ).fetchone()


def get_scenario(conn: Connection, catch_prediction_id: int) -> Optional[Row]:
    return conn.execute(
        """
        SELECT scenario_id, scenario_type
        FROM scenarios
        WHERE catch_prediction_id = ?
        ORDER BY scenario_id DESC
        LIMIT 1
        """,
        (catch_prediction_id,),
    ).fetchone()


def get_warehouse_view(conn: Connection, scenario_id: int) -> Optional[Row]:
    return conn.execute(
        """
        SELECT recommended_space, recommendation_text
        FROM warehouse_view
        WHERE scenario_id = ?
        LIMIT 1
        """,
        (scenario_id,),
    ).fetchone()


def get_fisher_view(conn: Connection, scenario_id: int) -> Optional[Row]:
    return conn.execute(
        """
        SELECT timing_type, recommendation_text
        FROM fisher_view
        WHERE scenario_id = ?
        LIMIT 1
        """,
        (scenario_id,),
    ).fetchone()
