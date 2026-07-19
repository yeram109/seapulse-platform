// js/weeks.js — 오늘 기준 예측 주차 라벨 계산 (UI 전용, 데이터 미변경)
//
// 예측 화면의 전주·이번주·다음주·다다음주는 특정 날짜에 고정되면 안 되고
// 오늘(new Date())을 기준으로 매번 굴러가야 한다. 여기서는 주차 '라벨'만 만든다 —
// 예측 수치(값)는 data 계층/목업에서 그대로 받아 쓴다.

const DAY_MS = 86400000;
const fmtMD = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

/** ISO 8601 주차 번호 (월요일 시작, 그 주의 목요일이 속한 해 기준) */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;               // 월=0 … 일=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);            // 그 주의 목요일로 이동
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); // 1/4 = 무조건 1주차
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d - firstThu) / (7 * DAY_MS));
}

/**
 * 오늘 기준 4주 라벨: 전주 · 이번주 · 다음주 · 다다음주 (각 주 월~일).
 * @param {Date} [today]
 * @returns {Array<{label:string, week:number, range:string, now:boolean}>}
 */
export function predWeeks(today = new Date()) {
  const dow = (today.getDay() + 6) % 7;                 // 월=0
  const monThis = new Date(today);
  monThis.setDate(today.getDate() - dow);               // 이번 주 월요일
  monThis.setHours(0, 0, 0, 0);

  const labels = ['전주', '이번주', '다음주', '다다음주'];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return [-1, 0, 1, 2].map((off, i) => {
    const mon = new Date(monThis);
    mon.setDate(monThis.getDate() + off * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    // weekStart: 예측 API 조회용 월요일 날짜(YYYY-MM-DD)
    return { label: labels[i], week: isoWeek(mon), range: `${fmtMD(mon)}–${fmtMD(sun)}`, now: off === 0, weekStart: iso(mon) };
  });
}
