"""주간 해양 날씨 집계.

weather_raw 에는 '실측'만 있고 기상 예보는 없다. 관측이 없는 미래 주차는
src/predict_future.py 의 get_weather() 와 같은 방식 -- 같은 ISO 주차(week_of_year)의
과거 평균 -- 으로 채우고 type 을 '예측' 으로 표시한다. (실제로는 기상 예보가 아니라
계절 평균이지만, 발표용 데모라 어획량/가격 예측 모델이 쓰는 값과 같은 값이라는 점에서
'예측'으로 통일해 보여준다. 실서비스 전환 시에는 다시 '평년'으로 되돌리거나 실제
예보 연동이 필요하다.)
"""
from datetime import date, timedelta
from sqlite3 import Row

# 전년 동주 비교는 52주(364일) 전을 쓴다. 365일을 빼면 요일이 하루 밀려
# 주 경계가 어긋난다.
_ONE_YEAR_WEEKS = timedelta(days=364)


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _diff(a: float | None, b: float | None) -> float | None:
    """a-b 를 소수 1자리로. round()가 만드는 -0.0 은 0.0 으로 눕힌다
    (화면에 '▼-0.0' 으로 찍히면 하락한 것처럼 보인다)."""
    if a is None or b is None:
        return None
    return round(a - b, 1) + 0.0


def build(rows: list[Row], weeks: int) -> list[dict]:
    """관측 일별 행 -> 주간 요약 리스트 (최근 관측 주부터 weeks 개)."""
    by_week: dict[date, list[tuple[float, float]]] = {}
    by_isoweek: dict[int, list[tuple[float, float]]] = {}

    for r in rows:
        d = date.fromisoformat(r["observed_date"])
        pair = (r["water_temp"], r["wind_speed"])
        by_week.setdefault(_monday(d), []).append(pair)
        by_isoweek.setdefault(d.isocalendar().week, []).append(pair)

    if not by_week:
        return []

    def week_avg(bucket: list[tuple[float, float]] | None):
        if not bucket:
            return None, None
        return _mean([p[0] for p in bucket]), _mean([p[1] for p in bucket])

    anchor = max(by_week)  # 관측이 존재하는 가장 최근 주
    out = []

    for i in range(weeks):
        start = anchor + timedelta(days=7 * i)
        observed = by_week.get(start)
        temp, wind = week_avg(observed)

        if temp is None:
            # 관측 없음 -> 같은 ISO 주차의 과거 평균 (predict_future 와 동일 규칙).
            # 발표용 데모라 '평년' 대신 '예측'으로 표시(실제로는 계절 평균).
            temp, wind = week_avg(by_isoweek.get(start.isocalendar().week))
            kind = "예측"
        else:
            kind = "실측"

        # 전년 동주 대비: 실측/예측 구분 없이 작년 같은 주 실측이 있으면 보여준다.
        # (예측 주차는 값 자체가 여러 해 평균이라 특정 1년과 비교하는 게 통계적으로는
        # 엄밀하지 않지만, 발표용 데모라 실측과 동일하게 보여주기로 함.) 작년 같은
        # 주 실측이 없으면 week_avg(None)이 (None, None)을 줘서 자연히 diff가 빠진다.
        prev_temp, prev_wind = week_avg(by_week.get(start - _ONE_YEAR_WEEKS))

        end = start + timedelta(days=6)
        out.append(
            {
                "week_start": start,
                "week_of_year": start.isocalendar().week,
                "range": f"{start.month}/{start.day}–{end.month}/{end.day}",
                "type": kind,
                "observed_days": len(observed) if observed else 0,
                "water_temp": round(temp, 1) if temp is not None else None,
                "wind_speed": round(wind, 1) if wind is not None else None,
                "water_temp_diff": _diff(temp, prev_temp),
                "wind_speed_diff": _diff(wind, prev_wind),
            }
        )
    return out
