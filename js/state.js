// js/state.js — 앱 상태 (로그인한 사용자 = session)
// 핵심: 화면에 고정으로 박아두지 않고, 가입/로그인 때 만든 session 을 화면들이 함께 본다.
//  · nickname  : 가입 때 입력 → 프로필 수정에서 바꾸면 전체 반영
//  · regions   : "지역 추가"로 늘어남 (처음엔 가입 때 고른 1곳만)
//  · species   : 어종 (기본 삼치)
//  · saved     : 저장한 예측 (처음엔 비어 있음, 내가 저장해야 생김)

// 로그인 데모용 기본 페르소나 (가입 안 하고 로그인만 했을 때 채워줌)
const personas = {
  logistics: { name: '박창고', nickname: '박창고', email: 'park@toy.coop',     org: '통영수협 냉동창고' },
  fisher:    { name: '김어부', nickname: '김어부', email: 'kim@fisher.kr',     org: '' },
  admin:     { name: 'admin',  nickname: 'admin',  email: 'admin@sea-pulse.kr', org: '' },
};

export const state = {
  role: 'logistics',           // 현재 역할
  session: null,               // 로그인/가입 시 채워지는 사용자 객체
  scenarioKey: { logistics: 'logistics-oversupply', fisher: 'fisher-pricedrop' },

  // 알림 설정 (13/14) — 초기값: 앞 3개 ON
  notifications: [
    { id: 'price',     icon: 'bell',      label: '가격 급변 알림', sub: '±5% 변동',      on: true  },
    { id: 'weather',   icon: 'waves',     label: '악천후 알림',    sub: '파고3m·풍속10',  on: true  },
    { id: 'closedSeason', icon: 'calendar', label: '금어기 알림',    sub: '삼치 5월',       on: true  },
    { id: 'restock',   icon: 'box',       label: '입고 예측',      sub: '주간 갱신',      on: false },
    { id: 'marketing', icon: 'megaphone', label: '공지·마케팅',    sub: '서비스 소식',    on: false },
  ],
};

// 가입/로그인 → session 생성. overrides 로 가입폼 입력값을 덮어쓴다.
export function startSession(roleKey, overrides = {}) {
  const p = personas[roleKey];
  const region = overrides.region || '통영';
  state.role = roleKey;
  state.session = {
    roleKey,
    name:     overrides.name     || p.name,
    nickname: overrides.nickname || p.nickname,
    email:    overrides.email    || p.email,
    org:      overrides.org != null ? overrides.org : p.org,
    region,                         // 현재 활동 지역
    regions: [region],              // 추가된 지역들 (처음엔 가입 때 고른 1곳)
    species: ['삼치'],              // 어종 (기본 삼치)
    saved: [],                      // 저장한 예측 (비어 있음)
  };
  return state.session;
}

// 세션이 없으면(딥링크 등) 기본 세션을 만들어 둔다.
export function ensureSession() {
  if (!state.session) startSession(state.role);
  return state.session;
}

// 켜져 있는 알림 개수 (설정 "N개 켜짐" 표시용)
export function notiOnCount() {
  return state.notifications.filter((n) => n.on).length;
}
