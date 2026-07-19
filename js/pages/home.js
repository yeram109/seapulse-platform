// pages/home.js — 05·06·07 홈 (물류 / 어업인 / 관리자)

import { navigate, isStale } from '../router.js';
import { state, ensureSession } from '../state.js';
import { kpis, weeklyWeather, scenarioPairs } from '../../data/mock.js';
import {
  logoBar, tabBar, roleBadge, badge, weatherCardCompact,
  kpiGrid, scenarioCard, predictionChart, wire,
} from '../components.js';
import { icon } from '../icons.js';
import { closedSeasonStatus, closedSeasonMessage } from '../closedSeason.js';
import { predWeeks } from '../weeks.js';
import { regionIdOf, fetchWeather, fetchPrediction } from '../api.js';

// 오늘 기준 주차 라벨(전주·이번주·다음주·다다음주)에 예측값을 얹어 차트 포인트 생성.
// 앞 2주(전주·이번주)=실측, 뒤 2주(다음주·다다음주)=예측(+신뢰구간 밴드). 값은 UI 목업.
function buildPredPoints(values, bands) {
  return predWeeks().map((w, i) => {
    const p = { ...w, value: values[i], type: i <= 1 ? '실측' : '예측' };
    if (bands[i]) { p.lo = bands[i][0]; p.hi = bands[i][1]; }
    return p;
  });
}

/* ---- 백엔드 연동 (있으면 실제값으로 교체, 없으면 mock 유지) ---- */
// API WeatherWeek → weatherCardCompact 가 쓰는 형태로 매핑
function mapWeather(a) {
  return {
    week: a.week_of_year, range: a.range, type: a.type,
    temp: a.water_temp ?? '—', tempDiff: a.water_temp_diff ?? 0,
    wind: a.wind_speed ?? '—', windDiff: a.wind_speed_diff ?? 0,
  };
}
// API는 상태 문구를 안 주므로 수온·풍속에서 간단히 도출
function weatherStatus(a) {
  if (a.wind_speed != null && a.wind_speed >= 9) return { text: '강풍 주의', kind: 'warn' };
  if (a.water_temp != null && a.water_temp >= 27) return { text: '고수온 주의', kind: 'warn' };
  return { text: '조업 양호', kind: 'ok' };
}

// mock으로 먼저 그린 화면을, API가 살아있으면 실제 예측/날씨로 덮어쓴다.
// 실패(서버 꺼짐·CORS·범위밖)하면 조용히 mock 상태를 유지한다.
async function upgradeHome(root, token, role, isFisher, mockPoints) {
  const s = state.session;
  let regionId;
  try { regionId = await regionIdOf(s.region); } catch { return; }   // API 미연결 → mock 유지
  if (isStale(token) || regionId == null) return;
  const capacityTon = s.warehouseCapacityTon ?? 500;

  // 주간 날씨(2주) 교체 — 예측과 독립이라 실패해도 예측은 계속 시도
  fetchWeather(regionId, 2).then((ws) => {
    if (isStale(token) || !Array.isArray(ws) || ws.length < 2) return;
    const g = root.querySelector('#wGrid');
    if (!g) return;
    const s0 = weatherStatus(ws[0]), s1 = weatherStatus(ws[1]);
    g.innerHTML =
      weatherCardCompact(mapWeather(ws[0]), { label: '이번 주', statusText: s0.text, statusKind: s0.kind, active: true }) +
      weatherCardCompact(mapWeather(ws[1]), { label: '다음 주', statusText: s1.text, statusKind: s1.kind });
  }).catch(() => {});

  // 4주 예측 → 차트 교체. 배포 예측이 있는 주만 실제값, 나머지는 mock 포인트 유지.
  const weeks = predWeeks();
  const preds = await Promise.all(weeks.map((w) =>
    fetchPrediction({ regionId, weekStart: w.weekStart, role, capacityTon }).catch(() => null)));
  if (isStale(token) || !preds.some(Boolean)) return;   // 한 주도 없으면 mock 유지

  const pick = isFisher ? (p) => p.predicted_price : (p) => p.predicted_catch;
  const conv = isFisher ? (v) => v : (v) => v / 1000;   // 가격 원 그대로 / 어획량 kg→톤
  const fmt  = isFisher ? (v) => Math.round(v).toLocaleString() : (v) => v.toFixed(1);
  const points = weeks.map((w, i) => {
    const base = { ...mockPoints[i] };
    const pr = preds[i];
    if (pr) {
      const b = pick(pr);
      base.value = conv(b.value);
      if (base.type === '예측') { base.lo = conv(b.lower_bound); base.hi = conv(b.upper_bound); }
      base.uncertain = b.uncertain;
    }
    return base;
  });
  const el = root.querySelector('#predChart');
  if (el) el.innerHTML = predictionChart(points, { fmt });
}

/* ============================ 05 / 06 물류·어업인 홈 ============================ */
export function renderRoleHome(role) {
  return async function (root, token) {
    state.role = role;
    const s = ensureSession();
    const isFisher = role === 'fisher';

    // 지역 칩 = 내가 추가한 지역들만 (처음엔 가입 때 고른 1곳)
    const chips = s.regions
      .map((name) => `<span class="chip ${name === s.region ? 'is-active' : ''}" data-region="${name}">${name}</span>`)
      .join('');

    // 날씨: 이번 주(실측) + 다음 주(예측) 2단. 이번 주 상태는 역할별로 다름.
    const thisWeek = isFisher ? { text: '강풍 · 출항 주의', kind: 'warn' } : { text: '고수온 주의', kind: 'warn' };
    const weatherGrid = `
      <div class="wc-grid" id="wGrid">
        ${weatherCardCompact(weeklyWeather[0], { label: '이번 주', statusText: thisWeek.text, statusKind: thisWeek.kind, active: true })}
        ${weatherCardCompact(weeklyWeather[1], { label: '다음 주', statusText: '조업 양호', statusKind: 'ok' })}
      </div>`;

    // 금어기 알림 (어업인만) — 명절 대신 삼치 금어기(5/1~5/31)로 교체
    const cs = closedSeasonStatus();
    const closedSeasonCard = isFisher ? `
      <div class="alert alert--${cs.alertKind}">
        <div class="alert__head"><span class="alert__title">${icon(cs.iconName, 16)} 삼치 금어기 알림</span>${badge(cs.badgeText, cs.badgeKind)}</div>
        <div class="alert__body">${closedSeasonMessage(cs, role)}</div>
      </div>` : '';

    const chartLabel = isFisher ? 'kg당 가격 추이' : '어획량 추이';

    // 4주 예측 시계열 — 주차·기간 라벨은 오늘(new Date()) 기준으로 자동 계산되고,
    // 예측 수치(value/lo/hi)는 UI 목업(데이터 파이프라인 확정 전까지). 값만 바꿔도 차트가 따라감.
    const predSeries = isFisher
      ? { unit: '원/kg', fmt: (v) => v.toLocaleString(),
          points: buildPredPoints([4350, 4180, 4050, 3920], [null, null, [3700, 4400], [3520, 4340]]) }
      : { unit: '톤', fmt: (v) => v.toFixed(1),
          points: buildPredPoints([7.6, 8.0, 8.5, 7.9], [null, null, [7.0, 10.0], [6.5, 9.3]]) };

    const pair = scenarioPairs[role];
    const curKey = state.scenarioKey[role];
    const scnToggle = `
      <div class="scn-toggle">
        ${pair.map((p) => `<button class="${p.key === curKey ? 'is-active' : ''}" data-scnkey="${p.key}">${p.label}</button>`).join('')}
      </div>`;

    root.innerHTML = `
      <section class="screen screen--tab">
        ${logoBar()}

        <div class="role-row">
          ${roleBadge(role)}
          <span class="role-row__meta">${s.species.join('·')} · 경남 ${s.region}</span>
          <span class="role-row__name">${s.nickname} 님</span>
        </div>

        <div class="addbox-wrap">
          <div class="addbox" data-action="add-region">${icon('pin', 16)} 경남지역 추가 <b>+</b></div>
          <div class="addbox" data-action="add-species">${icon('fish', 16)} 어종 추가 <b>+</b></div>
        </div>

        <div class="chips">
          <span class="chips__arrow">‹</span>
          ${chips}
          <span class="chips__arrow">›</span>
        </div>

        <div class="section-head">
          <div>
            <div class="section-title">주간 해양 날씨</div>
            <div class="section-sub">통영 부이 · 전년 동주 대비</div>
          </div>
          <span class="section-link" data-nav="/weather">자세히 ›</span>
        </div>
        ${weatherGrid}

        ${closedSeasonCard}

        <div class="section-head">
          <div>
            <div class="section-title">${isFisher ? '가격 예측' : '어획량 예측'}</div>
            <div class="section-sub">${chartLabel} · 단위 ${predSeries.unit} · 전주~다다음주 4주</div>
          </div>
        </div>
        <div id="predChart">${predictionChart(predSeries.points, { fmt: predSeries.fmt })}</div>

        ${kpiGrid(kpis[role])}

        <div class="section-title">추천</div>
        ${scnToggle}
        <div id="scnCard">${scenarioCard(curKey)}</div>
      </section>
      ${tabBar('home')}
    `;

    // 지역 칩 클릭 → 활성 지역 변경
    root.querySelectorAll('[data-region]').forEach((el) =>
      el.addEventListener('click', () => { s.region = el.dataset.region; navigate('/home/' + role); }));

    // 시나리오 토글
    root.querySelectorAll('[data-scnkey]').forEach((el) =>
      el.addEventListener('click', () => { state.scenarioKey[role] = el.dataset.scnkey; navigate('/home/' + role); }));

    wire(root);

    // 백엔드가 살아있으면 예측 차트·날씨를 실제값으로 교체 (없으면 mock 유지)
    upgradeHome(root, token, role, isFisher, predSeries.points).catch(() => {});
  };
}

export const renderHomeLogistics = renderRoleHome('logistics');
export const renderHomeFisher = renderRoleHome('fisher');

