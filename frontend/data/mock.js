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
   scenarios + warehouse_view / fisher_view — 4개 구현 시나리오
   ※ scenario_type(내부코드) 대신 상황설명(공급과잉 등)만 노출
--------------------------------------------------------- */
export const scenarios = {
  'logistics-oversupply': {
    role: 'logistics', title: '재고 배치 추천',
    type: '공급과잉', typeKind: 'warn',
    volume: '평년이상', price: '하락',
    confidence: 82, mae: '±1.2톤',
    headline: '냉동 여유 공간 20톤 확보 권장',
    desc: '전형적 공급과잉입니다. 넉넉한 공간을 준비하고, 초과 시 외부 창고 임시 계약을 미리 검토하세요.',
  },
  'logistics-offseason': {
    role: 'logistics', title: '재고 배치 추천',
    type: '비수기', typeKind: 'neutral',
    volume: '평년이하', price: '보합',
    confidence: 74, mae: '±0.8톤',
    headline: '최소 공간만 준비하세요',
    desc: '전형적 비수기입니다. 특별 대응은 필요 없습니다.',
  },
  'fisher-pricedrop': {
    role: 'fisher', title: '판매 타이밍 추천',
    type: '가격하락', typeKind: 'danger',
    volume: '평년이상', price: '하락',
    confidence: 79, mae: '±380원',
    headline: '⚠️ 지금 판매를 권장해요',
    desc: '빠른 처분을 권장합니다. 물량이 평년보다 많고(+18%) 수온 상승으로 추가 하락 여지가 있어요. 삼치는 신선도 유지가 짧아 대기 시 손실 위험이 큽니다.',
  },
  'fisher-scarcity': {
    role: 'fisher', title: '판매 타이밍 추천',
    type: '희소성', typeKind: 'ok',
    volume: '평년이하', price: '상승',
    confidence: 71, mae: '±420원',
    headline: '대기 후 판매가 유리해요',
    desc: '희소성 프리미엄 구간입니다. 하루이틀 대기하면 더 유리할 수 있어요.',
  },
};
// 홈에서 역할별로 전환 가능한 두 시나리오
export const scenarioPairs = {
  logistics: [
    { key: 'logistics-oversupply', label: '공급과잉' },
    { key: 'logistics-offseason',  label: '비수기' },
  ],
  fisher: [
    { key: 'fisher-pricedrop', label: '가격하락' },
    { key: 'fisher-scarcity',  label: '희소성' },
  ],
};

/* ---------------------------------------------------------
   홈 KPI (역할별 2×2)
--------------------------------------------------------- */
export const kpis = {
  logistics: [
    { label: '다음 주 예측 어획량', value: '8.5톤',   sub: '전주 대비 +12%', subOk: true },
    { label: '신뢰구간',           value: '7~10톤',  sub: '80% 신뢰수준' },
    { label: '현재 가동률',        value: '72%',     sub: '여유 8.4톤' },
    { label: '통영 물량 비중',     value: '43.7%',   sub: '경남 1위' },
  ],
  fisher: [
    { label: '내일 예상 가격', value: '4,050원/kg', sub: '신뢰 3,700~4,400', badge: '위판가' },
    { label: '전일 대비',      value: '−3.2%',      sub: '하락 추세', valueKind: 'danger' },
    { label: '이번 주 물량',   value: '평년이상',    sub: '+18% 공급과잉' },
    { label: '통영 평균 단가', value: '5,269원/kg', sub: '2023~2025' },
  ],
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
