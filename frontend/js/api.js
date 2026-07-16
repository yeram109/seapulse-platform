// js/api.js — 백엔드(prediction_api) 호출 계층
// fetch 와 에러 처리를 여기 한 곳에 몰아둔다. 화면(pages/*)은 이 함수만 쓴다.
//
// 실행: 터미널 2개
//   1) uvicorn prediction_api.app.main:app --port 8000    (레포 루트에서)
//   2) node frontend/server.js                            (→ http://localhost:3000)

const BASE = 'http://localhost:8000';

/** 서버가 주는 에러 코드. 화면은 message 문구가 아니라 이 code 로 분기한다. */
export class ApiError extends Error {
  constructor(code, message, validRange) {
    super(message);
    this.code = code;
    this.validRange = validRange; // OUT_OF_FORECAST_RANGE 일 때 [최소주차, 최대주차]
  }
}

async function getJson(path, params = {}) {
  const q = new URLSearchParams(params);
  const url = `${BASE}${path}${q.toString() ? '?' + q : ''}`;

  let res;
  try {
    res = await fetch(url);
  } catch {
    // 네트워크 자체가 실패 = 서버가 안 떠 있거나 CORS 차단
    throw new ApiError('NETWORK', '예측 서버에 연결할 수 없어요. API 서버가 켜져 있는지 확인해주세요.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      body?.error ?? 'UNKNOWN',
      body?.message ?? `요청 실패 (${res.status})`,
      body?.valid_range,
    );
  }
  return res.json();
}

/* ============================ 항구 목록 ============================ */

// 항구 목록은 앱 실행 중 바뀌지 않으므로 한 번만 받아서 캐시한다.
let regionsCache = null;

/** [{ region_id, name, weeks: ['2025-12-08', ...] }, ...] */
export async function fetchRegions() {
  if (!regionsCache) regionsCache = await getJson('/regions');
  return regionsCache;
}

/** 이름('통영') → region_id(1). 서버 목록에 없으면 null. */
export async function regionIdOf(name) {
  const list = await fetchRegions();
  return list.find((r) => r.name === name)?.region_id ?? null;
}

/** 해당 항구에서 고를 수 있는 주차 목록 (예측이 있는 주차만) */
export async function weeksOf(name) {
  const list = await fetchRegions();
  return list.find((r) => r.name === name)?.weeks ?? [];
}

// 아래 두 함수는 main.js 가 시작 시 fetchRegions() 로 캐시를 채운 뒤에만 값이 있다.
// 회원가입 드롭다운·지역 모달처럼 렌더가 동기인 곳에서 쓰려고 sync 로 노출한다.

/** 캐시된 항구 목록 (아직 안 받았으면 빈 배열) */
export function regionsSync() {
  return regionsCache ?? [];
}

/** 지역 한 줄 메타. 거래 실적이 없으면(share가 null) '데이터 준비 중'.
 * share가 0.0%인 항구는 거래는 있으나 비중이 작을 뿐이라 구분해서 값을 보여준다. */
export function regionMetaSync(name) {
  const r = regionsSync().find((x) => x.name === name);
  if (!r) return '';
  if (r.share == null) return '데이터 준비 중 · 추후 제공';
  return `금액 ${r.share}% · ${r.price.toLocaleString()}원/kg`;
}

/* ============================ 주간 날씨 ============================ */

/** 최근 관측 주부터 n주. type: '실측' | '예측'(과거 동일 주차 평균을 예측값으로 표시) */
export async function fetchWeather(regionId, weeks = 4) {
  return getJson('/weather', { region_id: regionId, weeks });
}

/* ============================ 관리자 ============================ */

export async function fetchPipeline() {
  return getJson('/admin/pipeline');
}

/* ============================ 예측 ============================ */

/**
 * 예측 + 역할별 추천 조회.
 * @param {{regionId:number, weekStart:string, role:'logistics'|'fisher', capacityTon?:number}} p
 */
export async function fetchPrediction({ regionId, weekStart, role, capacityTon }) {
  const params = { region_id: regionId, week_start: weekStart, role };

  if (role === 'logistics') {
    // 서버도 400 으로 막지만, 왕복하기 전에 여기서 먼저 걸러 같은 문구를 보여준다.
    if (capacityTon == null) {
      throw new ApiError('MISSING_WAREHOUSE_CAPACITY', '창고 용량(톤)을 먼저 설정해주세요.');
    }
    params.warehouse_capacity_ton = capacityTon;
  }
  return getJson('/predictions', params);
}

/* ============================ 표시용 변환 ============================ */
// API 는 kg / 원 단위의 raw number 를 준다. 화면 문구는 여기서 만든다.

/** 109066.6 → '109.1톤' */
export function toTon(kg, digits = 1) {
  return `${(kg / 1000).toFixed(digits)}톤`;
}

/** 4142.4 → '4,142원/kg' */
export function toWon(won) {
  return `${Math.round(won).toLocaleString()}원/kg`;
}

/** '2025-12-08' → '12/8 주' */
export function weekLabel(iso) {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)} 주`;
}

/* ============================ 날짜 ============================ */

/** 오늘이 속한 ISO 주의 월요일. 'YYYY-MM-DD' */
export function currentWeekStart(d = new Date()) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // 일=0 → 6칸 전, 월=1 → 0칸 전
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** weeks 중 target(YYYY-MM-DD)과 가장 가까운 주차. target이 범위 밖이면 가장 가까운 끝. */
export function closestWeek(weeks, target) {
  if (weeks.includes(target)) return target;
  const t = new Date(target).getTime();
  return weeks.reduce((best, w) =>
    Math.abs(new Date(w) - t) < Math.abs(new Date(best) - t) ? w : best
  );
}
