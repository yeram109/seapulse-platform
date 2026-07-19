// js/closedSeason.js — 삼치 금어기 알림 로직
//
// 금어기는 양력 고정(매년 5/1~5/31)이라 연도별 날짜 테이블이 필요 없다 — 오늘의
// 월-일만으로 판정한다. 명절과 달리 음력 변환이 필요 없고, 조업이 금지돼 어획량이
// 사실상 0이 되므로 어업인(조업)·물류(재고) 양쪽에 영향을 준다.
// (모델은 이를 명시적으로 반영하지 못한다 — predict 클램프는 별도.)

const CLOSED = { startMD: [5, 1], endMD: [5, 31] }; // 삼치 금어기
const LEAD_WINDOW = 30; // 금어기 시작 D-30부터 '임박' 카드를 노출
const DAY_MS = 86400000;

const at = (year, [m, d]) => new Date(year, m - 1, d);

/**
 * 오늘 기준 금어기 카드 상태. 노출 구간(시작 D-30 ~ 금어기 종료일) 밖이면 null(=숨김).
 * @param {Date} [today]
 * @returns {{phase:'before'|'during', days:number, badgeText:string, badgeKind:'warn'|'danger'} | null}
 */
export function closedSeasonStatus(today = new Date()) {
  const y = today.getFullYear();
  const start = at(y, CLOSED.startMD);
  const end = at(y, CLOSED.endMD);
  end.setHours(23, 59, 59, 999); // 5/31 종일까지 금어기

  if (today >= start && today <= end) {
    const days = Math.ceil((end - today) / DAY_MS); // 해제까지 남은 일수
    return { phase: 'during', days, badgeText: `금어기 중 · 해제 D-${days}`, badgeKind: 'danger' };
  }

  const days = Math.ceil((start - today) / DAY_MS); // 시작까지 남은 일수
  if (days >= 1 && days <= LEAD_WINDOW) {
    return { phase: 'before', days, badgeText: `금어기 D-${days}`, badgeKind: 'warn' };
  }

  return null;
}

/** 역할별 금어기 안내 문구. 어획량 0 → 물류(재고)·어업인(조업) 모두 영향. */
export function closedSeasonMessage(st, role) {
  const fisher = role === 'fisher';
  if (st.phase === 'during') {
    return fisher
      ? `삼치는 현재 금어기입니다 (5/1~5/31, 조업 금지). 해제까지 ${st.days}일 남았습니다.`
      : `삼치 금어기 기간입니다 (5/1~5/31). 신규 입하가 없어 재고 소진·가격 상승에 유의하세요.`;
  }
  return fisher
    ? `삼치 금어기(5/1~5/31)가 ${st.days}일 앞으로 다가왔습니다. 조업 일정을 미리 계획하세요.`
    : `삼치 금어기(5/1~5/31)가 ${st.days}일 앞입니다. 금어기 전 재고 확보를 검토하세요.`;
}
