// js/adminData.js — 관리자 화면용 프론트 목업 + 승인 상태(세션 내 변경).
// ※ 여기는 UI 데모용 사용자/승인 데이터일 뿐, 어획·가격 예측 데이터 파이프라인이 아니다.
//   승인 누르면 대기→활성으로 옮겨 카운트가 실시간으로 바뀌도록 상태를 프론트에서 관리한다.

// 승인 대기 (가입 신청 시각 포함) — 데모 영상용으로 남겨둠
const initialPending = [
  { name: '최관리', email: 'choi@sea-pulse.kr', roleKey: 'admin',     region: '본사',   requestedAt: '07-18 09:14' },
  { name: '정어민', email: 'jung@fisher.kr',    roleKey: 'fisher',    region: '남해',   requestedAt: '07-18 15:02' },
  { name: '한물류', email: 'han@toy.coop',      roleKey: 'logistics', region: '거제도', requestedAt: '07-19 08:30' },
];

// 현재(활성) 사용자 — 가입 시각 포함
export const activeUsers = [
  { name: '김어부', email: 'kim@fisher.kr',    roleKey: 'fisher',    region: '통영',   joinedAt: '2026-05-02' },
  { name: '박창고', email: 'park@toy.coop',    roleKey: 'logistics', region: '통영',   joinedAt: '2026-04-18' },
  { name: '이선주', email: 'lee@fisher.kr',    roleKey: 'fisher',    region: '거제도', joinedAt: '2026-06-11' },
  { name: '조냉동', email: 'cho@toy.coop',     roleKey: 'logistics', region: '마산',   joinedAt: '2026-06-20' },
  { name: '윤관리', email: 'yoon@sea-pulse.kr', roleKey: 'admin',    region: '본사',   joinedAt: '2026-03-30' },
  { name: '서어민', email: 'seo@fisher.kr',    roleKey: 'fisher',    region: '삼천포', joinedAt: '2026-07-01' },
];

// 데이터 소스 상세 (파이프라인 현황)
export const dataSources = [
  { name: '위판 실적 (수협)',  count: '57,066건', status: '정상',        kind: 'ok',   source: '통영·마산·삼천포·남해·거제도 위판장', lastSync: '2026-07-19 04:00' },
  { name: '해양 기상 (부이)',  count: '1,181일',  status: '정상',        kind: 'ok',   source: '통영 해양기상부이',                  lastSync: '2026-07-19 05:10' },
  { name: '어획량 (KOSIS)',   count: '29개월',   status: '정상',        kind: 'ok',   source: '국가통계포털 월별 어획량',           lastSync: '2026-07-15 02:00' },
  { name: '노량진 소매가',     count: '57행',     status: '2026 미수집', kind: 'warn', source: '노량진수산시장 소매 시세',           lastSync: '2025-12-31 23:00' },
];

/* ---------- 승인 상태 (세션 내 변경) ---------- */
const pending = initialPending.map((u) => ({ ...u }));
export const approvalLog = []; // { name, roleKey, region, approvedAt } — 최신순

function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function getPending() { return pending; }
export function pendingCount() { return pending.length; }
export function totalUsers() { return activeUsers.length + approvalLog.length; }

// 역할별 인원(활성 + 이번 세션 승인)
export function roleCount(roleKey) {
  return activeUsers.filter((u) => u.roleKey === roleKey).length
       + approvalLog.filter((u) => u.roleKey === roleKey).length;
}

// 활성 사용자 = 기존 + 이번 세션에 승인한 사용자(최신 가입으로 위에 노출)
export function allActiveUsers() {
  const approved = approvalLog.map((a) => ({ ...a, joinedAt: '방금 승인', justApproved: true }));
  return [...approved, ...activeUsers];
}

// 승인 처리: 대기 목록에서 제거 → 승인 이력에 시각과 함께 추가
export function approveUser(email) {
  const i = pending.findIndex((u) => u.email === email);
  if (i < 0) return null;
  const [u] = pending.splice(i, 1);
  const entry = { ...u, approvedAt: nowStamp() };
  approvalLog.unshift(entry);
  return entry;
}
