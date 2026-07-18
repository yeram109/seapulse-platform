// js/closedSeason.js — 삼치 금어기 알림 로직 (명절 카드 대체)
//
// 명절은 어획·가격에 실질 영향이 적고 PRD에도 없다. 반면 금어기는 조업이 금지돼
// 어획량이 사실상 0이 되므로 어업인(조업)·물류(재고) 양쪽에 직접적이다.
// 금어기는 양력 고정(매년 5/1~5/31)이라 연도별 날짜 테이블이 필요 없다 —
// 오늘의 월-일만으로 판정한다. (데이터 파이프라인은 건드리지 않는다.)

const CLOSED = { startMD: [5, 1], endMD: [5, 31] }; // 삼치 금어기
const LEAD_WINDOW = 30;  // 시작 D-30부터 '임박' 단계로 강조
const DAY_MS = 86400000;

const at = (year, [m, d]) => new Date(year, m - 1, d);
const daysBetween = (a, b) => Math.ceil((a - b) / DAY_MS);

/**
 * 오늘 기준 금어기 카드 상태. 항상 값을 반환한다(카드는 늘 노출).
 *  - during : 금어기 기간 중 (해제 D-day)          → danger
 *  - before : 시작 D-30 이내로 임박               → warn
 *  - off    : 그 외 비금어기 (다음 금어기까지 안내) → info
 * @param {Date} [today]
 * @returns {{phase:'during'|'before'|'off', days:number, badgeText:string, badgeKind:string, alertKind:string, iconName:string}}
 */
export function closedSeasonStatus(today = new Date()) {
  const y = today.getFullYear();
  const start = at(y, CLOSED.startMD);
  const end = at(y, CLOSED.endMD);
  end.setHours(23, 59, 59, 999); // 5/31 종일까지 금어기

  // 1) 금어기 중
  if (today >= start && today <= end) {
    const days = daysBetween(end, today); // 해제까지
    return { phase: 'during', days, badgeText: `금어기 중 · 해제 D-${days}`, badgeKind: 'danger', alertKind: 'danger', iconName: 'warning' };
  }

  // 2) 올해 금어기 시작 임박 (D-30 이내)
  const dStart = daysBetween(start, today);
  if (dStart >= 1 && dStart <= LEAD_WINDOW) {
    return { phase: 'before', days: dStart, badgeText: `금어기 D-${dStart}`, badgeKind: 'warn', alertKind: 'warn', iconName: 'warning' };
  }

  // 3) 비금어기 — 다음 금어기(올해 것이 지났으면 내년 5/1)까지 안내
  const nextStart = today > end ? at(y + 1, CLOSED.startMD) : start;
  const days = daysBetween(nextStart, today);
  return { phase: 'off', days, badgeText: '매년 5/1~5/31', badgeKind: 'neutral', alertKind: 'info', iconName: 'calendar' };
}

/** 역할별 금어기 안내 문구. 어획량 0 → 어업인(조업)·물류(재고) 모두 영향. */
export function closedSeasonMessage(st, role) {
  const fisher = role === 'fisher';
  if (st.phase === 'during') {
    return fisher
      ? `삼치는 현재 금어기입니다 (5/1~5/31, 조업 금지). 해제까지 ${st.days}일 남았습니다.`
      : `삼치 금어기 기간입니다 (5/1~5/31). 신규 입하가 없어 재고 소진·가격 상승에 유의하세요.`;
  }
  if (st.phase === 'before') {
    return fisher
      ? `삼치 금어기(5/1~5/31)가 ${st.days}일 앞으로 다가왔습니다. 조업 일정을 미리 계획하세요.`
      : `삼치 금어기(5/1~5/31)가 ${st.days}일 앞입니다. 금어기 전 재고 확보를 검토하세요.`;
  }
  return fisher
    ? `삼치 금어기(매년 5/1~5/31)엔 조업이 금지돼 어획량이 사실상 0이 됩니다. 다음 금어기까지 ${st.days}일 남았습니다.`
    : `삼치 금어기(매년 5/1~5/31)엔 신규 입하가 없어 재고·가격에 영향을 줍니다. 다음 금어기까지 ${st.days}일 남았습니다.`;
}
