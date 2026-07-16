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
