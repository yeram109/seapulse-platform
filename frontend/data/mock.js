// data/mock.js — 더미(mock) 데이터
// ※ 여기 수치는 명세서의 실제 값만 사용한다 (지어내지 않음).
//   ERD 필드 이름을 최대한 그대로 써서, 나중에 진짜 DB로 바꾸기 쉽게 한다.

/* ---------------------------------------------------------
   region — 경남 8개 위판 지역
   · 5곳(통영·마산·삼천포·남해·거제도)은 실제 금액비중·단가 데이터 보유
   · 3곳(의창·진해·고성)은 지역은 있으나 예측 데이터 추후 제공 (pending)
--------------------------------------------------------- */
export const regions = [
  { name: '통영',   share: 43.7, price: 5269, note: '경남 1위' },
  { name: '마산',   share: 28.8, price: 4572, note: '' },
  { name: '삼천포', share: 25.6, price: 4774, note: '' },
  { name: '남해',   share: 1.0,  price: 3363, note: '' },
  { name: '거제도', share: 0.8,  price: 2181, note: '' },
  { name: '의창',   share: null, price: null, pending: true },
  { name: '진해',   share: null, price: null, pending: true },
  { name: '고성',   share: null, price: null, pending: true },
];

// 지역 한 줄 메타 텍스트 (데이터 있으면 비중·단가, 없으면 준비 중)
export function regionMeta(name) {
  const r = regions.find((x) => x.name === name);
  if (!r) return '';
  return r.pending
    ? '데이터 준비 중 · 추후 제공'
    : `금액 ${r.share}% · ${r.price.toLocaleString()}원/kg`;
}

/* ---------------------------------------------------------
   weather_raw / predictions — 통영 부이 주간 (2025 vs 전년 동주)
   type: 실측 = 이번 주, 예측 = 이후
--------------------------------------------------------- */
export const weeklyWeather = [
  { week: 28, range: '7/7–7/13',  type: '실측', temp: 24.7, tempDiff: +3.7, wind: 8.8, windDiff: +4.5, status: '고수온·강풍',    kind: 'warn' },
  { week: 29, range: '7/14–7/20', type: '예측', temp: 24.5, tempDiff: +2.6, wind: 5.2, windDiff: +0.4, status: '조업 양호',      kind: 'ok'   },
  { week: 30, range: '7/21–7/27', type: '예측', temp: 27.6, tempDiff: +3.0, wind: 4.5, windDiff: +1.4, status: '고수온 경보',    kind: 'warn' },
  { week: 31, range: '7/28–8/3',  type: '예측', temp: 28.6, tempDiff: +2.8, wind: 4.7, windDiff: -0.4, status: '어획량 감소 예상', kind: 'warn' },
];
export const weatherInsight =
  '4주 평균 수온이 전년 대비 +3.0°C 높습니다. 수온은 가격과 강한 음의 상관(r=−0.61, p=0.0012)을 보이므로 하락 압력이 예상됩니다.';

/* ---------------------------------------------------------
   시나리오 / 물류·어업인 KPI — 제거됨 (2026-07-16)

   물류·어업인 홈의 시나리오 카드와 KPI는 이제 백엔드 GET /predictions 응답으로
   그린다 (js/api.js). 여기 있던 더미 시나리오 4개는 실제 DB에 존재하지 않는
   조합("평년이상_하락" 등 '하락' 시나리오)을 가정하고 있었고, MAE 도 실제 모델
   값(어획량 ±9.9톤 / 가격 ±1,740원)과 크게 달라서 남겨두면 오해를 준다.
   신뢰도 %는 백엔드에 없는 값이라 uncertain 배지로 대체했다.
--------------------------------------------------------- */

/* ---------------------------------------------------------
   홈 KPI — 관리자만 (물류/어업인은 API 응답으로 대체)
--------------------------------------------------------- */
export const kpis = {
  admin: [
    { label: '전체 사용자',    value: '128명',      sub: '물류42·어민81·관리5' },
    { label: '승인 대기',      value: '3명',        sub: '관리자 신청', valueKind: 'warn' },
    { label: '데이터 최신일',  value: '2025-12-10', sub: '동기화 완료' },
    { label: '모델 MAE',       value: '±1,240원',   sub: '어획량 ±1.2톤 · v1.3' },
  ],
};

/* ---------------------------------------------------------
   User — 역할별 프로필 (로그인/설정에서 사용)
--------------------------------------------------------- */
export const users = {
  logistics: { name: '박창고', email: 'park@toy.coop',     roleKey: 'logistics', roleLabel: '물류 담당자', region: '경남 통영', org: '통영수협 냉동창고' },
  fisher:    { name: '김어부', email: 'kim@fisher.kr',     roleKey: 'fisher',    roleLabel: '어업인',     region: '경남 통영', org: '' },
  admin:     { name: 'admin',  email: 'admin@sea-pulse.kr', roleKey: 'admin',     roleLabel: '관리자',     region: '시스템 운영', org: '' },
};

// 역할 메타 (아이콘 이름·설명·배지 종류)
export const roleMeta = {
  logistics: { icon: 'box',    label: '물류 담당자', desc: '창고 공간 배치 · 입고량 예측',  badge: 'brand' },
  fisher:    { icon: 'fish',   label: '어업인',     desc: '판매 타이밍 · 가격 전망',       badge: 'ok'    },
  admin:     { icon: 'shield', label: '관리자',     desc: '사용자 · 데이터 · 모델 관리',   badge: 'admin' },
};

/* ---------------------------------------------------------
   관리자 홈 — 승인 대기 · 데이터 파이프라인
--------------------------------------------------------- */
export const pendingUsers = [
  { name: '최관리', email: 'choi@sea-pulse.kr', roleKey: 'admin' },
  { name: '정어민', email: 'jung@fisher.kr',    roleKey: 'fisher' },
  { name: '한물류', email: 'han@toy.coop',      roleKey: 'logistics' },
];

export const dataPipeline = [
  { name: '위판 (수협)',    count: '57,066건', status: '정상',        kind: 'ok'   },
  { name: '해양 날씨 (부이)', count: '1,181일',  status: '정상',        kind: 'ok'   },
  { name: '어획량 (KOSIS)', count: '29개월',   status: '정상',        kind: 'ok'   },
  { name: '노량진 소매',    count: '57행',     status: '2026 미수집', kind: 'warn' },
];

/* ---------------------------------------------------------
   탈퇴 사유
--------------------------------------------------------- */
export const withdrawReasons = [
  '예측 정확도가 기대와 달라요',
  '앱을 잘 사용하지 않아요',
  '원하는 지역·어종이 없어요',
  '기타',
];

/* ---------------------------------------------------------
   리포트 항목
--------------------------------------------------------- */
export const reportItems = [
  { icon: 'chart',    label: '예측 요약 (어획량·가격)', on: true },
  { icon: 'waves',    label: '해양 날씨 분석',          on: true },
  { icon: 'trend',    label: '시나리오 추천 근거',      on: true },
  { icon: 'calendar', label: '명절·계절 효과',          on: false },
];
