"""프로젝트 공통 상수 (항구-region_id 매핑, 모델 버전 등)."""
from datetime import date

import pandas as pd

# region_id는 백엔드 DB(seapulse_final.db)의 region 테이블 번호를 그대로 따른다.
# DB가 이미 위판/날씨 데이터를 이 번호로 적재해뒀으므로, 우리 쪽이 DB 기준에 맞춘다.
REGION_MAP = {
    "통영": 1,
    "삼천포": 2,
    "거제도": 3,
    "남해": 4,
    "고성": 5,
    "마산": 6,
    "의창": 7,
    "진해": 8,
}

REGION_IDS = list(REGION_MAP.values())

# raw_ocean_weather_5regions_daily.csv는 5개 항구(거제도·남해·마산·삼천포·통영)만
# 관측소가 있음. 나머지 3개 항구는 지리적으로 가장 가까운 관측소 값을 대신 사용.
# (DB의 대체_매핑: 고성<-통영, 의창<-마산, 진해<-마산과 동일한 로직)
WEATHER_REGION_BY_ID = {
    1: "통영",  # 통영
    2: "삼천포",  # 삼천포
    3: "거제도",  # 거제도
    4: "남해",  # 남해
    5: "통영",  # 고성 -> 통영
    6: "마산",  # 마산
    7: "마산",  # 의창 -> 마산
    8: "마산",  # 진해 -> 마산
}

SPECIES_ID = 1  # 삼치
MODEL_VERSION = f"rf_v1_{date.today().strftime('%Y%m%d')}"
# 기획서 6.8절: 검증용(2023~2024 학습/2025 검증)과 배포용(2023~2025 전체 재학습) 모델을
# 구분해서 저장. model_version 문자열로 어느 쪽인지 구분.
MODEL_VERSION_VAL = f"{MODEL_VERSION}_val"
MODEL_VERSION_FINAL = f"{MODEL_VERSION}_final"

TRAIN_END = "2024-12-31"
TEST_START = "2025-01-01"

# min_samples_leaf: 리프 노드가 학습 표본 극단값 하나에 그대로 좌우되는 것을 막기 위한
# 최소 규제. 특히 retail은 학습 표본이 23행뿐이라 min_samples_leaf/max_depth를
# 더 강하게 줘서 트리가 개별 관측치를 암기하지 않도록 함.
RF_PARAMS_CATCH = dict(n_estimators=100, random_state=42, min_samples_leaf=3)
RF_PARAMS_WHOLESALE = dict(n_estimators=100, random_state=42, min_samples_leaf=3)
RF_PARAMS_RETAIL = dict(n_estimators=300, random_state=42, min_samples_leaf=4, max_depth=4)

# THRESHOLD는 초기값 0.3에서 시작했으나, 실제 검증 데이터의 interval_width_ratio
# 분포를 보니 0.3은 거의 모든 행이 uncertain으로 찍혀 신호가 되지 않았음.
# 각 분포의 약 75th percentile을 기준으로 재조정 (기획서 6.6절) — 상위 ~25~30%만
# "특히 불확실"로 플래그되도록 함.
#   catch: median=2.49, p75=3.23  -> 3.0 (약 31% 플래그)
#   price: median=1.10, p75=1.50  -> 1.5 (전체 25%, wholesale 23%/retail 60%)
CATCH_UNCERTAIN_THRESHOLD = 3.0
PRICE_UNCERTAIN_THRESHOLD = 1.5

# 도매가격 학습에서 제외할 극저물량 기준. 이 미만인 (항구, 주)는 price_per_kg가
# 거래 한두 건에 좌우되는 노이즈에 가까움 (전체 597 학습행 중 84행, 10.4% 해당,
# 특정 계절에 쏠리지 않고 고르게 분포). 검증셋(2025년)은 실서비스 상황을 그대로
# 반영하기 위해 제외하지 않음.
WHOLESALE_MIN_TRAIN_VOLUME_KG = 10


def add_region_dummies(df, col="region_id"):
    """region_id(정수 1~8)를 원-핫 컬럼으로 확장.

    정수 인코딩 그대로 쓰면 RF가 항구 간에 없는 순서 관계(예: region_id<=3)로
    분기를 만들 수 있어, 항구별 특징을 실제로 독립된 범주로 다루기 위함.
    REGION_IDS로 카테고리를 고정해 학습/검증 분할에서 컬럼이 항상 동일하게 생성됨.
    """
    cat = pd.Categorical(df[col], categories=REGION_IDS)
    dummies = pd.get_dummies(cat, prefix="region").astype(int)
    dummies.index = df.index
    region_cols = [f"region_{r}" for r in REGION_IDS]
    return pd.concat([df, dummies], axis=1), region_cols
