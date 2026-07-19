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
import { regionIdOf, fetchWeather, fetchPrediction, regionsSync, toTon, toWon, weatherToCard, weatherStatus } from '../api.js';

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
// 예측 응답들로 KPI 2×2 구성 (mock kpis[role] 대체)
function kpisFromApi(role, preds, region, capacityTon) {
  const [prev, cur, next] = preds;
  const wow = (a, b) => (a && b && b.value ? ((a.value - b.value) / b.value) * 100 : null);
  if (role === 'fisher') {
    const np = next?.predicted_price, w = wow(cur?.predicted_price, prev?.predicted_price);
    return [
      { label: '다음 주 예상 가격', value: np ? toWon(np.value) : '—', badge: '위판가',
        sub: np ? `신뢰 ${Math.round(np.lower_bound).toLocaleString()}~${Math.round(np.upper_bound).toLocaleString()}` : '다음 주 예측 없음' },
      { label: '전주 대비', value: w == null ? '—' : `${w >= 0 ? '+' : ''}${w.toFixed(1)}%`,
        valueKind: w == null ? undefined : (w >= 0 ? 'ok' : 'danger'),
        sub: w == null ? '비교 데이터 없음' : (w > 0 ? '상승 추세' : w < 0 ? '하락 추세' : '보합') },
      { label: '이번 주 물량', value: cur?.scenario.volume_level ?? '—', sub: cur ? `가격 ${cur.scenario.price_level}` : '' },
      { label: `${region?.name ?? ''} 평균 단가`, value: region?.price != null ? `${region.price.toLocaleString()}원/kg` : '—', sub: '2023~2025' },
    ];
  }
  const nc = next?.predicted_catch, w = wow(cur?.predicted_catch, prev?.predicted_catch);
  return [
    { label: '다음 주 예측 어획량', value: nc ? toTon(nc.value) : '—', subOk: w != null && w >= 0,
      sub: w == null ? (nc ? `${toTon(nc.lower_bound)}~${toTon(nc.upper_bound)}` : '다음 주 예측 없음') : `전주 대비 ${w >= 0 ? '+' : ''}${Math.round(w)}%` },
    { label: '신뢰구간', value: nc ? `${toTon(nc.lower_bound)}~${toTon(nc.upper_bound)}` : '—', sub: '90% 신뢰수준' },
    { label: '창고 용량', value: `${capacityTon}톤`, sub: '설정에서 변경' },
    { label: `${region?.name ?? ''} 물량 비중`, value: region?.share != null ? `${region.share}%` : '—', sub: '금액 기준' },
  ];
}

// 예측 응답의 scenario로 추천 카드 구성 (확실/불확실·MAE는 예측의 uncertain/mae에서)
function scnCardFromApi(role, pred) {
  const sc = pred.scenario;
  const vb = role === 'fisher' ? pred.predicted_price : pred.predicted_catch;
  const cert = vb.uncertain ? { text: '불확실', kind: 'warn' } : { text: '확실', kind: 'ok' };
  const maeStr = role === 'fisher' ? `±${Math.round(vb.mae).toLocaleString()}원` : `±${(vb.mae / 1000).toFixed(1)}톤`;
  const kind = sc.price_level === '하락' ? 'danger' : sc.price_level === '상승' ? 'ok' : 'neutral';
  const title = role === 'fisher' ? '판매 타이밍 추천' : '재고 배치 추천';
  return `
    <div class="card scn-card scn-card--${kind}">
      <div class="scn">
        <div class="scn__head"><span class="scn__title">${title}</span>${badge(sc.price_level || sc.scenario_type, kind)}</div>
        <div class="scn__cond">${badge('물량 ' + sc.volume_level, 'outline')} <span>×</span> ${badge('가격 ' + sc.price_level, 'outline')}</div>
        <div class="conf">
          <div class="conf__row"><span class="conf__label">예측 신뢰도</span>${badge(cert.text, cert.kind)}</div>
          <div class="conf__row"><span class="conf__mae">MAE ${maeStr}</span></div>
        </div>
        <div class="scn__divider"></div>
        <div class="scn__headline">${sc.headline || ''}</div>
        <div class="scn__desc">${sc.text || ''}</div>
      </div>
    </div>`;
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
      weatherCardCompact(weatherToCard(ws[0]), { label: '이번 주', statusText: s0.text, statusKind: s0.kind, active: true }) +
      weatherCardCompact(weatherToCard(ws[1]), { label: '다음 주', statusText: s1.text, statusKind: s1.kind });
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

  // KPI 2×2 교체 (전주/이번주/다음주 예측 + 지역 통계 기반)
  const region = regionsSync().find((r) => r.name === s.region) || null;
  const kpiEl = root.querySelector('#kpiSlot');
  if (kpiEl) kpiEl.innerHTML = kpiGrid(kpisFromApi(role, preds, region, capacityTon));

  // 추천 시나리오 카드 교체 (이번주 예측 기준, 없으면 가장 가까운 것)
  const curPred = preds[1] || preds[2] || preds.find(Boolean);
  const scnEl = root.querySelector('#scnCard');
  if (curPred && scnEl) scnEl.innerHTML = scnCardFromApi(role, curPred);
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

        <div id="kpiSlot">${kpiGrid(kpis[role])}</div>

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

