"""응답/요청 스키마. seapulse_final.db 실제 스키마 기준(2026-07-16)."""
from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Role(str, Enum):
    logistics = "logistics"  # 물류담당자
    fisher = "fisher"  # 어업인


class PredictionQuery(BaseModel):
    """role=logistics일 때 warehouse_capacity_ton 필수 검증은 여기서 하지 않는다 --
    이 모델은 main.py 안에서 수동으로 생성되므로 FastAPI의 요청 검증 파이프라인을
    타지 않아, model_validator를 걸어도 400이 아니라 처리 안 된 예외로 샌다.
    검증은 main.py의 엔드포인트에서 명시적으로 한다."""

    region_id: int
    week_start: date
    role: Role
    warehouse_capacity_ton: Optional[float] = Field(
        default=None, description="role=logistics 일 때만 필수 (톤)"
    )


class Region(BaseModel):
    """항구 목록. weeks는 배포용(_final) 예측이 존재하는 주차 -- 프론트가 주차 선택
    UI를 그릴 때 이 목록만 고를 수 있게 한다. 비어 있으면 예측이 없는 항구."""

    region_id: int
    name: str
    weeks: list[date]


class ValueWithBounds(BaseModel):
    """mae는 모델 전체의 평균절대오차(어획량 kg, 가격 원/kg). 행마다 다른 값이
    아니라 모델 단위 상수라, 예측값이 아니라 '이 모델의 오차 수준' 표시용이다."""

    value: float
    lower_bound: float
    upper_bound: float
    uncertain: bool
    mae: float


class ScenarioResult(BaseModel):
    """scenario_type("평년이상_보합")을 프론트가 다시 파싱하지 않도록 여기서
    volume_level/price_level로 쪼개서 준다. headline은 warehouse_view의
    recommended_space("충분한공간") 또는 fisher_view의 timing_type("분산판매")."""

    role: Role
    text: str
    headline: str
    scenario_type: str
    volume_level: str
    price_level: str


class PredictionResponse(BaseModel):
    region_id: int
    week_start: date
    model_version_catch: str
    model_version_price: str
    predicted_catch: ValueWithBounds
    predicted_price: ValueWithBounds
    scenario: ScenarioResult


class ErrorCode(str, Enum):
    INVALID_REGION = "INVALID_REGION"
    OUT_OF_FORECAST_RANGE = "OUT_OF_FORECAST_RANGE"
    NO_DEPLOYED_PREDICTION = "NO_DEPLOYED_PREDICTION"
    MISSING_WAREHOUSE_CAPACITY = "MISSING_WAREHOUSE_CAPACITY"


class ErrorResponse(BaseModel):
    error: ErrorCode
    message: str
    valid_range: Optional[list[date]] = None
