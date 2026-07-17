import os
import sqlite3
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import queries, weather
from .db import get_conn
from .schemas import (
    ErrorCode,
    PipelineSource,
    PredictionResponse,
    PredictionQuery,
    Region,
    Role,
    ScenarioResult,
    ValueWithBounds,
    WeatherWeek,
)

app = FastAPI(title="Fisheries Prediction API")

# 프론트(frontend/server.js)는 3000번, 이 API는 8000번이라 브라우저가 다른 출처로
# 본다. 허용 목록을 열어주지 않으면 fetch 응답을 프론트가 읽지 못한다.
ALLOWED_ORIGINS = os.environ.get(
    "SEAPULSE_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# generate_scenarios.py의 insert_scenario()가 배치 기본값(500톤)으로 이미 붙여둔
# 문구와 정확히 같아야 함 -- 이 suffix가 저장된 recommendation_text 끝에 있으면
# "500톤 기준 판정"이므로 떼어내고 실제 warehouse_capacity_ton으로 다시 판정한다.
WAREHOUSE_OVERFLOW_SUFFIX = " ⚠️ 총 용량 초과, 외부 창고 검토 필요"
CAPACITY_BUFFER_RATIO = 1.2
OVERSUPPLY_PREFIX = "평년이상_"  # scenario_type == "{물량수준}_{가격수준}"


def _strip_baked_warning(text: str) -> str:
    if text.endswith(WAREHOUSE_OVERFLOW_SUFFIX):
        return text[: -len(WAREHOUSE_OVERFLOW_SUFFIX)]
    return text


def _split_scenario_type(scenario_type: str) -> tuple[str, str]:
    """"평년이상_보합" -> ("평년이상", "보합"). 물량수준 자체에는 "_"가 없으므로
    첫 "_"에서만 자른다. 형식이 어긋나면 통째로 물량수준 취급하고 가격은 빈 값."""
    volume, sep, price = scenario_type.partition("_")
    return (volume, price) if sep else (scenario_type, "")


# 삼치 금어기(양력 고정 5/1~5/31). 이 기간은 조업이 금지돼 어획량이 사실상 0인데,
# 모델 피처는 month뿐이라 이를 반영하지 못하고 5월에도 유의미한 어획량을 예측한다
# (예: 통영 15.6톤). 실제와 배치되는 값이므로 이 주차는 어획량을 0으로 클램프한다.
# 판정은 week_start의 월 기준(간단) — 5월에 걸친 경계 주는 다루지 않는다.
CLOSED_SEASON_MONTH = 5


def _is_closed_season(week_start: date) -> bool:
    return week_start.month == CLOSED_SEASON_MONTH


def _closed_season_scenario(role: Role, price_level: str) -> ScenarioResult:
    """금어기 주차 전용 시나리오. 어획량이 0이라 일반 물량수준 추천(분산판매 등)은
    무의미하므로 조업 금지 안내로 대체한다. 가격수준은 실제 예측을 유지한다 —
    조업은 멈춰도 재고/냉동 물량 거래가는 유효하기 때문."""
    if role == Role.logistics:
        headline = "재고 소진 관리"
        text = "삼치 금어기(5/1~5/31)로 신규 입하가 없습니다. 기존 재고 소진과 가격 상승에 대비하세요."
    else:
        headline = "조업 금지"
        text = "삼치 금어기(5/1~5/31)로 조업이 금지됩니다. 해제 후 조업을 계획하세요."
    return ScenarioResult(
        role=role,
        text=text,
        headline=headline,
        scenario_type="금어기",
        volume_level="금어기",
        price_level=price_level,
    )


@app.get("/regions", response_model=list[Region])
def get_regions(conn: sqlite3.Connection = Depends(get_conn)):
    """항구 목록 + 배포용 예측이 있는 주차 + 금액비중/평균단가. 프론트가 region_id
    매핑과 주차 선택지, 지역 통계를 하드코딩하지 않도록 서버가 알려준다."""
    weeks_by_region = queries.get_forecast_weeks_by_region(conn)
    stats = queries.get_region_stats(conn)
    return [
        Region(
            region_id=row["region_id"],
            name=row["region_name"],
            weeks=weeks_by_region.get(row["region_id"], []),
            share=stats.get(row["region_id"], {}).get("share"),
            price=stats.get(row["region_id"], {}).get("price"),
        )
        for row in queries.get_regions(conn)
    ]


@app.get("/weather", response_model=list[WeatherWeek])
def get_weather(
    region_id: int = Query(...),
    weeks: int = Query(default=4, ge=1, le=12),
    conn: sqlite3.Connection = Depends(get_conn),
):
    """최근 관측 주부터 weeks 개의 주간 해양 날씨. 관측이 없는 주는 예측값(=계절 평균)."""
    if not queries.region_exists(conn, region_id):
        return JSONResponse(
            status_code=400,
            content={"error": ErrorCode.INVALID_REGION, "message": "존재하지 않는 region_id 입니다."},
        )
    return weather.build(queries.get_weather_rows(conn, region_id), weeks)


@app.get("/admin/pipeline", response_model=list[PipelineSource])
def get_admin_pipeline(conn: sqlite3.Connection = Depends(get_conn)):
    """관리자 홈의 데이터 파이프라인 카드. 원본별 실제 적재 건수와 최신일."""
    s = queries.get_pipeline_stats(conn)
    return [
        PipelineSource(name="위판 (수협)", count=s["wipan"]["n"], latest=s["wipan"]["latest"]),
        PipelineSource(name="해양 날씨 (부이)", count=s["weather"]["n"], latest=s["weather"]["latest"]),
        PipelineSource(name="노량진 소매", count=s["retail"]["n"], latest=s["retail"]["latest"]),
    ]


@app.get(
    "/predictions",
    response_model=PredictionResponse,
    responses={400: {"description": "잘못된 요청 / 예측 범위 밖"}, 404: {"description": "배포용 예측 없음"}},
)
def get_prediction(
    region_id: int = Query(...),
    week_start: str = Query(..., description="YYYY-MM-DD"),
    role: Role = Query(...),
    warehouse_capacity_ton: float | None = Query(default=None),
    conn: sqlite3.Connection = Depends(get_conn),
):
    if role == Role.logistics and warehouse_capacity_ton is None:
        return JSONResponse(
            status_code=400,
            content={
                "error": ErrorCode.MISSING_WAREHOUSE_CAPACITY,
                "message": "role=logistics 요청에는 warehouse_capacity_ton이 필수입니다.",
            },
        )

    query = PredictionQuery(
        region_id=region_id,
        week_start=week_start,
        role=role,
        warehouse_capacity_ton=warehouse_capacity_ton,
    )
    week_start_str = query.week_start.isoformat()

    if not queries.region_exists(conn, query.region_id):
        return JSONResponse(
            status_code=400,
            content={"error": ErrorCode.INVALID_REGION, "message": "존재하지 않는 region_id 입니다."},
        )

    catch_row = queries.get_catch_prediction(conn, query.region_id, week_start_str)

    if catch_row is None:
        if queries.has_val_only_prediction(conn, query.region_id, week_start_str):
            return JSONResponse(
                status_code=404,
                content={
                    "error": ErrorCode.NO_DEPLOYED_PREDICTION,
                    "message": "해당 주차는 검증(_val)용 데이터만 존재하며 배포된 예측이 없습니다.",
                },
            )

        min_week, max_week = queries.get_valid_forecast_range(conn, query.region_id)
        if min_week is None:
            return JSONResponse(
                status_code=400,
                content={
                    "error": ErrorCode.INVALID_REGION,
                    "message": "해당 region_id의 배포용 예측 데이터가 없습니다.",
                },
            )

        return JSONResponse(
            status_code=400,
            content={
                "error": ErrorCode.OUT_OF_FORECAST_RANGE,
                "message": "요청한 week_start가 예측 가능 범위를 벗어났습니다.",
                "valid_range": [min_week, max_week],
            },
        )

    price_row = queries.get_price_prediction(conn, catch_row["catch_prediction_id"])
    if price_row is None:
        raise HTTPException(
            status_code=500,
            detail="catch_predictions는 있으나 price_predictions가 없습니다 (데이터 정합성 문제).",
        )

    scenario_row = queries.get_scenario(conn, catch_row["catch_prediction_id"])
    if scenario_row is None:
        raise HTTPException(status_code=500, detail="scenarios에 해당 catch_prediction_id가 없습니다.")

    volume_level, price_level = _split_scenario_type(scenario_row["scenario_type"])

    closed = _is_closed_season(query.week_start)

    if closed:
        # 금어기: 어획량 0으로 클램프하고 조업 관련 추천 대신 전용 안내로 대체.
        scenario = _closed_season_scenario(role, price_level)
    elif role == Role.logistics:
        view_row = queries.get_warehouse_view(conn, scenario_row["scenario_id"])
        base_text = _strip_baked_warning(view_row["recommendation_text"] if view_row else "")

        required_space_ton = catch_row["predicted_catch"] * CAPACITY_BUFFER_RATIO / 1000
        is_oversupply = scenario_row["scenario_type"].startswith(OVERSUPPLY_PREFIX)
        if is_oversupply and required_space_ton > query.warehouse_capacity_ton:
            text = base_text + WAREHOUSE_OVERFLOW_SUFFIX
        else:
            text = base_text

        headline = view_row["recommended_space"] if view_row else ""
        scenario = ScenarioResult(
            role=role,
            text=text,
            headline=headline,
            scenario_type=scenario_row["scenario_type"],
            volume_level=volume_level,
            price_level=price_level,
        )
    else:
        view_row = queries.get_fisher_view(conn, scenario_row["scenario_id"])
        text = view_row["recommendation_text"] if view_row else ""
        headline = view_row["timing_type"] if view_row else ""
        scenario = ScenarioResult(
            role=role,
            text=text,
            headline=headline,
            scenario_type=scenario_row["scenario_type"],
            volume_level=volume_level,
            price_level=price_level,
        )

    # 금어기 주차는 어획량을 0으로 클램프(위판가는 유지 — 재고 거래가는 유효).
    predicted_catch = (
        ValueWithBounds(value=0.0, lower_bound=0.0, upper_bound=0.0, uncertain=False, mae=catch_row["mae"])
        if closed
        else ValueWithBounds(
            value=catch_row["predicted_catch"],
            lower_bound=catch_row["lower_bound"],
            upper_bound=catch_row["upper_bound"],
            uncertain=bool(catch_row["catch_uncertain"]),
            mae=catch_row["mae"],
        )
    )

    return PredictionResponse(
        region_id=query.region_id,
        week_start=query.week_start,
        model_version_catch=catch_row["model_version"],
        model_version_price=price_row["model_version"],
        predicted_catch=predicted_catch,
        predicted_price=ValueWithBounds(
            value=price_row["predicted_price"],
            lower_bound=price_row["lower_bound"],
            upper_bound=price_row["upper_bound"],
            uncertain=bool(price_row["price_uncertain"]),
            mae=price_row["mae"],
        ),
        scenario=scenario,
    )
