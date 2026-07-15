"""배포용(미래) 예측으로 시나리오/창고뷰/어민뷰를 자체 생성.

팀원 노트북(seapulse_v4_uncertain_moved_colab.ipynb)의 시나리오 매핑 로직을 그대로
가져오되, 물량 수준 분류를 항구별로 고친 독립 구현. 팀원 파일을 직접 수정하지
않는다 — 팀원이 나중에 자기 버전을 다시 보내도 이 스크립트는 영향받지 않음.

**물량_수준_분류 수정**: 원본은 전 항구 통합 평균/표준편차(408700/406208, 임시값)
하나로 판정했는데, 항구별 규모가 최대 2,000배 차이나서(통영 평균 38,801kg vs
진해 18.9kg) 이 방식으로는 소형 항구가 영원히 "평년"에서 못 벗어남. 이 스크립트는
`merged_byport_weekly.csv`에서 항구별 평균/표준편차를 직접 계산해서 사용한다.

**가격_수준_분류**: 직전가격을 고정값(4700)이 아니라, feature_set에 저장된 그 예측
행의 실제 lag_price_1w를 사용한다. 임계값은 데이터 기준(전주 대비 변화율 75th
percentile≈0.40, 70th≈0.35)으로 0.35를 사용한다.

**대상 범위**: 배포용 모델의 미래 예측(model_version이 "_final"로 끝나는 행)만
시나리오를 만든다 — 이미 지나간 검증기간(2025년, "_val") 예측에 "지금 파세요"
같은 추천을 만드는 건 의미가 없기 때문.

입력: data/seapulse_final.db (load_to_db.py로 이미 채워진 catch_predictions/
      price_predictions/feature_set), data/processed/merged_byport_weekly.csv
출력: data/seapulse_final.db (scenarios/warehouse_view/fisher_view/predictions_log 채움)
"""
import sqlite3
from datetime import date

import pandas as pd

DB_PATH = "data/seapulse_final.db"
WEEKLY = "data/processed/merged_byport_weekly.csv"

SYSTEM_USER_EMAIL = "system@seapulse.internal"

# 가격 등락 판정 임계값. 데이터 기준(전주 대비 변화율 분포 70~75th percentile≈0.35~0.40)으로
# 재산정한 값 — 팀원 노트북의 임시값(0.291) 대체.
PRICE_CHANGE_THRESHOLD = 0.35

# 실제 물류창고 총용량(톤)은 나중에 인터페이스(앱)에서 사용자 입력으로 받아온다.
# 이 스크립트는 모델/배치 쪽이라 실제 값을 알 수 없으므로, 인터페이스 연동 전까지만
# 쓰는 배치 기본값이다 — DEFAULT_창고총용량은 함수 파라미터의 기본값일 뿐, 하드코딩된
# 진실의 원천이 아니다. 인터페이스가 준비되면 generate_scenarios(창고총용량=실제값)처럼
# 호출부에서 넘기면 된다.
DEFAULT_창고총용량 = 500

# 팀원 노트북의 시나리오 매핑표를 그대로 이식 (창고/어민 추천 문구는 우리 쪽에서 새로
# 정의할 이유가 없는 앱 UX 카피이므로 재사용).
시나리오_매핑표 = {
    ("평년이하", "하락"): {"추천공간": "최소공간", "창고_추천문구": "최소 공간만 준비하는걸 추천합니다.",
                         "시기유형": "즉시판매", "어민_추천문구": "가격 하락 추세이니 서둘러 판매하는걸 추천합니다. 물량 자체가 적어 무리한 조업 확대는 지양하는걸 추천합니다."},
    ("평년이하", "보합"): {"추천공간": "최소공간", "창고_추천문구": "최소 공간만 준비하는걸 추천합니다.",
                         "시기유형": "평소대로", "어민_추천문구": "평소대로 판매하는걸 추천합니다, 특별 대응 불필요해보입니다."},
    ("평년이하", "상승"): {"추천공간": "최소공간", "창고_추천문구": "최소 공간, 신선도 관리 강화",
                         "시기유형": "대기", "어민_추천문구": "가격 상승 추세입니다. 대기 후 판매하면 유리할 수 있어요"},
    ("평년", "하락"): {"추천공간": "표준공간", "창고_추천문구": "평년 수준 공간을 준비하는걸 권장합니다.",
                      "시기유형": "즉시판매", "어민_추천문구": "조기 판매를 권장합니다"},
    ("평년", "보합"): {"추천공간": "표준공간", "창고_추천문구": "표준 운영하는걸 권장합니다.",
                      "시기유형": "평소대로", "어민_추천문구": "평소대로 판매하면될것같습니다."},
    ("평년", "상승"): {"추천공간": "표준공간", "창고_추천문구": "표준 공간을 준비하시는걸 추천합니다.",
                      "시기유형": "대기", "어민_추천문구": "대기 후 판매를 고려해보세요."},
    ("평년이상", "하락"): {"추천공간": "충분한공간", "창고_추천문구": "넉넉한 공간이 필요할것같습니다, 초과 시 외부 창고 검토하시는걸 추천합니다.",
                        "시기유형": "즉시판매", "어민_추천문구": "⚠️ 빠른 처분을 권장합니다. 추가 하락 가능성에 유의하세요"},
    ("평년이상", "보합"): {"추천공간": "충분한공간", "창고_추천문구": "넉넉한 공간을 준비하시는걸 권장드립니다.",
                        "시기유형": "분산판매", "어민_추천문구": "물량이 많은 시기입니다. 분산 판매(한꺼번에 팔지 않기)를 고려해보세요"},
    ("평년이상", "상승"): {"추천공간": "충분한공간", "창고_추천문구": "넉넉한 공간을 준비하시는걸 권장드립니다.",
                        "시기유형": "적극판매", "어민_추천문구": "흔치 않은 좋은 기회입니다. 최대한 확보·판매를 권장합니다"},
}


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def build_region_stats():
    """항구(region_id)별 total_weight 평균/표준편차. 물량_수준_분류의 기준."""
    weekly = pd.read_csv(WEEKLY)
    stats = weekly.groupby("region_id")["total_weight"].agg(["mean", "std"])
    return stats.to_dict(orient="index")


def 물량_수준_분류(region_id, predicted_catch, region_stats):
    s = region_stats[region_id]
    평균, 표준편차 = s["mean"], s["std"]
    if predicted_catch < 평균 - 0.5 * 표준편차:
        return "평년이하"
    if predicted_catch > 평균 + 0.5 * 표준편차:
        return "평년이상"
    return "평년"


def 가격_수준_분류(predicted_price, 직전가격, threshold=PRICE_CHANGE_THRESHOLD):
    if 직전가격 is None or 직전가격 == 0:
        return "보합"
    r = (predicted_price - 직전가격) / 직전가격
    if r < -threshold:
        return "하락"
    if r > threshold:
        return "상승"
    return "보합"


def ensure_system_user(conn):
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM user WHERE email = ?", (SYSTEM_USER_EMAIL,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO user (email, password, created_at, role, nickname, permission) VALUES (?, ?, ?, ?, ?, ?)",
        (SYSTEM_USER_EMAIL, None, date.today().isoformat(), "system", "배치 시나리오 생성", "system"),
    )
    conn.commit()
    return cur.lastrowid


def clear_system_scenarios(conn, user_id):
    """재실행 시 중복 방지: 이 스크립트가 만든 시스템 유저의 시나리오만 지움."""
    cur = conn.cursor()
    cur.execute("SELECT scenario_id FROM scenarios WHERE user_id = ?", (user_id,))
    ids = [r[0] for r in cur.fetchall()]
    if not ids:
        return
    placeholders = ",".join("?" * len(ids))
    for t in ("predictions_log", "warehouse_view", "fisher_view"):
        cur.execute(f"DELETE FROM {t} WHERE scenario_id IN ({placeholders})", ids)
    cur.execute(f"DELETE FROM scenarios WHERE scenario_id IN ({placeholders})", ids)
    conn.commit()
    print(f"[초기화] 기존 시스템 시나리오 {len(ids)}건 삭제")


def insert_scenario(cur, row, region_stats, user_id, 창고총용량):
    """예측 한 건에 대해 scenarios/warehouse_view/fisher_view/predictions_log 행을 삽입."""
    물량수준 = 물량_수준_분류(int(row["region_id"]), row["predicted_catch"], region_stats)
    가격수준 = 가격_수준_분류(row["predicted_price"], row["lag_price_1w"])
    scenario_type = f"{물량수준}_{가격수준}"
    항목 = 시나리오_매핑표[(물량수준, 가격수준)]

    cur.execute(
        "INSERT INTO scenarios (catch_prediction_id, price_prediction_id, user_id, scenario_type) "
        "VALUES (?, ?, ?, ?)",
        (int(row["catch_prediction_id"]), int(row["price_prediction_id"]), user_id, scenario_type),
    )
    scenario_id = cur.lastrowid

    if row["catch_uncertain"]:
        추천공간, 창고문구 = "여유공간", "예측 불확실성이 높아 여유 공간을 넉넉히 확보하는걸 추천합니다."
    else:
        필요공간톤 = (row["predicted_catch"] * 1.2) / 1000
        추천공간, 창고문구 = 항목["추천공간"], 항목["창고_추천문구"]
        if 물량수준 == "평년이상" and 필요공간톤 > 창고총용량:
            창고문구 += " ⚠️ 총 용량 초과, 외부 창고 검토 필요"

    if row["price_uncertain"]:
        시기유형, 어민문구 = "판단유보", "가격 예측 불확실성이 높아 판단을 유보합니다. 시장 상황을 좀 더 지켜보세요"
    else:
        시기유형, 어민문구 = 항목["시기유형"], 항목["어민_추천문구"]

    cur.execute(
        "INSERT INTO warehouse_view (scenario_id, recommended_space, recommendation_text) VALUES (?, ?, ?)",
        (scenario_id, 추천공간, 창고문구),
    )
    cur.execute(
        "INSERT INTO fisher_view (scenario_id, timing_type, recommendation_text) VALUES (?, ?, ?)",
        (scenario_id, 시기유형, 어민문구),
    )
    cur.execute(
        "INSERT INTO predictions_log (scenario_id, saved_at) VALUES (?, datetime('now'))", (scenario_id,)
    )
    return scenario_type


def generate_scenarios(창고총용량=DEFAULT_창고총용량):
    """배포용(미래) 예측 전체에 대해 시나리오를 생성.

    창고총용량: 인터페이스가 준비되면 실제 사용자 입력값을 여기로 넘기면 됨
    (지금은 인터페이스가 없어 DEFAULT_창고총용량으로 배치 실행).
    """
    conn = connect()
    region_stats = build_region_stats()
    user_id = ensure_system_user(conn)
    clear_system_scenarios(conn, user_id)

    query = """
    SELECT cp.catch_prediction_id, cp.region_id, cp.predicted_catch, cp.catch_uncertain,
           pp.price_prediction_id, pp.predicted_price, pp.price_uncertain,
           fs.lag_price_1w
    FROM catch_predictions cp
    JOIN price_predictions pp ON pp.catch_prediction_id = cp.catch_prediction_id
    JOIN feature_set fs ON fs.feature_id = cp.feature_id
    WHERE cp.model_version LIKE '%_final'
    """
    df = pd.read_sql(query, conn)
    print(f"[대상] 배포용(미래) 예측 {len(df)}건에 대해 시나리오 생성 (창고총용량={창고총용량}톤)")

    cur = conn.cursor()
    scenario_types = []
    for _, row in df.iterrows():
        scenario_types.append(insert_scenario(cur, row, region_stats, user_id, 창고총용량))

    conn.commit()
    print(f"[적재] scenarios/warehouse_view/fisher_view/predictions_log {len(scenario_types)}건씩 생성")
    print("[scenario_type 분포]")
    print(pd.Series(scenario_types).value_counts())

    conn.close()


if __name__ == "__main__":
    generate_scenarios()
