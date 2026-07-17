// js/holiday.js — 명절 알림 로직
//
// 설날·추석은 음력이라 양력 날짜를 산술로 구할 수 없다. 프론트가 "의존성 0"이고
// 예측 지평이 약 52주뿐이라, 음력 변환 라이브러리를 들이는 대신 확정 양력 날짜를
// 테이블로 둔다. 날짜 출처: 관공서 공휴일(확정 달력). 지평이 늘면 아래 배열에 계속 추가.

const HOLIDAYS = [
  { name: '추석', date: '2026-09-25' },
  { name: '설날', date: '2027-02-07' },
];

const BEFORE_WINDOW = 30; // 명절 D-30부터 '직전' 카드를 노출
const AFTER_WINDOW = 10;   // 명절 당일 ~ 직후 열흘까지 '반등' 카드를 노출
const DAY_MS = 86400000;

/** 'YYYY-MM-DD' 자정 기준 epoch(ms). 시각을 버리고 날짜만 비교하려고 정오가 아닌 자정 고정. */
function dayValue(iso) {
  return Date.parse(iso + 'T00:00:00');
}

/** 오늘(로컬)의 'YYYY-MM-DD'. new Date()의 타임존 영향 없이 날짜만 뽑는다. */
function todayIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 오늘 기준으로 노출할 명절 카드 상태. 노출 창(D-30 ~ D+10) 밖이면 null(=카드 숨김).
 * 효과 수치는 모델 출력이 아니라 과거 위판 데이터의 경향 안내다(모델엔 명절 피처가 없음).
 * @param {Date} [today]
 * @returns {{name:string, phase:'before'|'after', dday:number,
 *            badgeText:string, badgeKind:'warn'|'ok', message:string} | null}
 */
export function holidayStatus(today = new Date()) {
  const t = dayValue(todayIso(today));
  for (const h of HOLIDAYS) {
    const dday = Math.round((dayValue(h.date) - t) / DAY_MS);

    if (dday >= 1 && dday <= BEFORE_WINDOW) {
      return {
        name: h.name,
        phase: 'before',
        dday,
        badgeText: `${h.name} D-${dday}`,
        badgeKind: 'warn',
        message: `${h.name} 직전엔 물량이 몰려 가격이 하락하는 경향이 있습니다 (과거 위판 데이터 기준). 판매·입고 시점을 미리 조정하세요.`,
      };
    }

    if (dday <= 0 && dday >= -AFTER_WINDOW) {
      return {
        name: h.name,
        phase: 'after',
        dday,
        badgeText: `${h.name} 반등기`,
        badgeKind: 'ok',
        message: `${h.name} 직후 열흘은 물량이 줄며 가격이 반등하는 경향이 있습니다. 반등기 판매를 고려하세요.`,
      };
    }
  }
  return null;
}
