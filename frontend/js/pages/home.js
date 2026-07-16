// pages/home.js — 05·06·07 홈 (물류 / 어업인 / 관리자)

import { navigate, isStale } from '../router.js';
import { state, ensureSession } from '../state.js';
import { kpis, pendingUsers } from '../../data/mock.js';
import {
  logoBar, tabBar, roleBadge, badge, weatherCardCompact,
  kpiGrid, kpiSkeleton, scenarioCard, loadingCard, errorCard, wire,
} from '../components.js';
import { icon } from '../icons.js';
import { fetchPrediction, fetchWeather, fetchPipeline, regionIdOf, weeksOf, regionsSync, toTon, toWon, currentWeekStart, closestWeek } from '../api.js';

/** cur/prev 사이 변화율(%, digits 자리 반올림). prev가 없거나 0이면 null. */
function pctChange(cur, prev, digits = 0) {
  if (prev == null || prev === 0) return null;
  return Number((((cur - prev) / prev) * 100).toFixed(digits));
}

/** 예측값으로 KPI 2×2를 만든다. mock 의 고정 문자열을 대체.
 * prevPred: 직전 주(예측 가능한 주차 중 하나 전)의 전체 예측 응답, 없으면 null.
 * nextPred: 다음 주(예측 가능한 주차 중 하나 뒤)의 전체 예측 응답, 없으면 null.
 * regionName/regionPrice: GET /regions의 항구별 평균단가(원/kg, 2023~2025 위판 원본 기준). */
function kpisFromPrediction(role, pred, prevPred, nextPred, regionName, regionPrice) {
  const c = pred.predicted_catch;
  const p = pred.predicted_price;
  const catchPct = pctChange(c.value, prevPred?.predicted_catch.value);
  const catchSub = catchPct == null
    ? `${toTon(c.lower_bound)}~${toTon(c.upper_bound)}`
    : `전주 대비 ${catchPct >= 0 ? '+' : ''}${catchPct}%`;
  const catchSubKind = catchPct == null ? undefined : (catchPct >= 0 ? 'ok' : 'danger');

  const pricePct = pctChange(p.value, prevPred?.predicted_price.value, 1);
  const priceWowTile = pricePct == null
    ? { label: '전주 대비', value: '—', sub: '비교할 이전 주 데이터 없음' }
    : {
        label: '전주 대비',
        value: `${pricePct >= 0 ? '+' : ''}${pricePct}%`,
        valueKind: pricePct >= 0 ? 'ok' : 'danger',
        sub: pricePct > 0 ? '상승 추세' : pricePct < 0 ? '하락 추세' : '보합',
      };

  const np = nextPred?.predicted_price;
  const nextPriceTile = np
    ? {
        label: '차주 예상 가격',
        value: toWon(np.value),
        sub: `신뢰 ${Math.round(np.lower_bound).toLocaleString()}~${Math.round(np.upper_bound).toLocaleString()}`,
        badge: '위판가',
      }
    : { label: '다음주 예상 가격', value: '—', sub: '다음 주 예측 데이터 없음', badge: '위판가' };

  return role === 'fisher'
    ? [
        nextPriceTile,
        priceWowTile,
        { label: '이번 주 물량', value: pred.scenario.volume_level, sub: `가격 ${pred.scenario.price_level}` },
        {
          label: `${regionName} 평균 단가`,
          value: regionPrice != null ? `${regionPrice.toLocaleString()}원/kg` : '—',
          sub: '2023~2025',
        },
      ]
    : [
        { label: '예측 어획량', value: toTon(c.value), sub: catchSub, subKind: catchSubKind },
        { label: '신뢰구간', value: `${toTon(c.lower_bound)}~${toTon(c.upper_bound)}`, sub: '90% 신뢰수준' },
        { label: '창고 용량', value: `${state.session.warehouseCapacityTon}톤`, sub: '설정에서 변경' },
        { label: '예상 위판가', value: toWon(p.value), sub: `가격 ${pred.scenario.price_level}` },
      ];
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

    // 날씨는 예측과 별개로 받아서 채운다 (아래 비동기 블록).

    // 명절 알림 (어업인만) — 실제 명절 날짜 계산 로직이 없어 항상 고정 문구("추석 D-14")가
    // 뜨는 문제로 임시 비활성화. 날짜 계산 로직이 준비되면 복구.
    // const holidayCard = isFisher ? `
    //   <div class="alert alert--warn">
    //     <div class="alert__head"><span class="alert__title">${icon('warning', 16)} 명절 알림</span>${badge('추석 D-14', 'warn')}</div>
    //     <div class="alert__body">명절 직전엔 물량이 몰려 가격이 떨어집니다 (추석 前 평균 −21%). 직후 열흘은 반등했습니다 (설날 +31%).</div>
    //   </div>` : '';
    const holidayCard = '';

    const chartLabel = isFisher ? 'kg당 가격 추이' : '어획량 추이';

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
            <div class="section-sub">${s.region} 부이 · 전년 동주 대비</div>
          </div>
          <span class="section-link" data-nav="/weather">자세히 ›</span>
        </div>
        <div id="wGrid" class="wc-grid"></div>

        ${holidayCard}

        <div class="section-title">${isFisher ? '가격 예측' : '어획량 예측'}</div>
        <div class="chart-ph">
          <span class="chart-ph__title">${chartLabel}</span>
          <span class="chart-ph__legend">실측 · 예측 · 신뢰구간</span>
        </div>

        <div id="kpiSlot">${kpiSkeleton()}</div>

        <div class="section-title">추천</div>
        <div id="scnCard">${loadingCard()}</div>
      </section>
      ${tabBar('home')}
    `;

    // 지역 칩 클릭 → 활성 지역 변경. 주차는 항구마다 다르므로 같이 초기화한다.
    root.querySelectorAll('[data-region]').forEach((el) =>
      el.addEventListener('click', () => {
        s.region = el.dataset.region;
        state.weekStart = null;
        navigate('/home/' + role);
      }));

    wire(root);

    // ── 여기부터 비동기: 위 껍데기는 이미 그려져 있고, 예측만 나중에 채운다 ──
    const scnSlot = root.querySelector('#scnCard');
    const kpiSlot = root.querySelector('#kpiSlot');

    try {
      const regionId = await regionIdOf(s.region);
      if (isStale(token)) return;   // 그 사이 다른 화면으로 넘어갔으면 중단

      // 날씨는 예측과 독립이라 실패해도 예측은 계속 그린다.
      fetchWeather(regionId, 2)
        .then((ws) => {
          if (isStale(token) || ws.length < 2) return;
          root.querySelector('#wGrid').innerHTML =
            weatherCardCompact(ws[0], { label: '이번 주', active: true }) +
            weatherCardCompact(ws[1], { label: '다음 주' });
        })
        .catch(() => {});

      if (regionId == null) {
        scnSlot.innerHTML = errorCard({ code: 'INVALID_REGION', message: `${s.region}은(는) 예측 대상 항구가 아니에요.` });
        return;
      }

      const weeks = await weeksOf(s.region);
      if (isStale(token)) return;

      if (!weeks.length) {
        scnSlot.innerHTML = errorCard({ code: 'NO_DEPLOYED_PREDICTION', message: `${s.region}은(는) 아직 예측 데이터가 없어요.` });
        return;
      }

      // 기본 주차 = 오늘이 속한 주(배포 예측 범위가 이제 오늘을 포함하도록 갱신됨).
      // 범위 밖이면(파이프라인이 한동안 안 돌아 다시 오래돼진 경우) 가장 가까운 주로 대체.
      const week = weeks.includes(state.weekStart) ? state.weekStart : closestWeek(weeks, currentWeekStart());
      state.weekStart = week;

      // 전주 대비/다음주 예상가 계산용: 이 주 바로 앞/뒤 주차(있으면)도 같이 받는다.
      const weekIdx = weeks.indexOf(week);
      const prevWeek = weeks[weekIdx - 1];
      const nextWeek = weeks[weekIdx + 1];
      const fetchOrNull = (w) =>
        w ? fetchPrediction({ regionId, weekStart: w, role, capacityTon: s.warehouseCapacityTon }).catch(() => null) : Promise.resolve(null);
      const [pred, prevPred, nextPred] = await Promise.all([
        fetchPrediction({ regionId, weekStart: week, role, capacityTon: s.warehouseCapacityTon }),
        fetchOrNull(prevWeek),
        fetchOrNull(nextWeek),
      ]);
      if (isStale(token)) return;

      state.lastPrediction = pred;
      const regionPrice = regionsSync().find((r) => r.name === s.region)?.price ?? null;
      kpiSlot.innerHTML = kpiGrid(kpisFromPrediction(role, pred, prevPred, nextPred, s.region, regionPrice));
      scnSlot.innerHTML = scenarioCard(pred);
      wire(root);   // 새로 그린 "예측 저장" 버튼에 핸들러를 다시 붙인다
    } catch (err) {
      if (isStale(token)) return;
      scnSlot.innerHTML = errorCard(err);
    }
  };
}

export const renderHomeLogistics = renderRoleHome('logistics');
export const renderHomeFisher = renderRoleHome('fisher');

/* ============================ 07 관리자 홈 ============================ */
export async function renderHomeAdmin(root, token) {
  state.role = 'admin';
  const s = ensureSession();

  const approvals = pendingUsers.map((p) => `
    <div class="arow">
      <div class="arow__main"><span class="arow__name">${p.name}</span><span class="arow__sub">${p.email}</span></div>
      <div class="arow__right">${roleBadge(p.roleKey)}<button class="btn btn--sm btn--primary" data-toast="${p.name} 님을 승인했어요">승인</button></div>
    </div>`).join('');

  root.innerHTML = `
    <section class="screen screen--tab">
      ${logoBar()}
      <div class="role-row">
        ${roleBadge('admin')}
        <span class="role-row__meta">시스템 운영</span>
        <span class="role-row__name">${s.nickname} 님</span>
      </div>

      ${kpiGrid(kpis.admin)}

      <div class="section-title" id="approvals">승인 대기 사용자</div>
      <div class="lgroup__box">${approvals}</div>

      <div class="section-title" id="pipeline">데이터 파이프라인</div>
      <div class="lgroup__box" id="pipelineBox"><div class="arow"><span class="arow__sub">불러오는 중…</span></div></div>

      <button class="btn btn--primary" data-toast="예측 갱신을 시작했어요">예측 갱신 실행</button>
    </section>
    ${tabBar('home')}
  `;
  wire(root);

  if (state.adminScroll) {
    const id = state.adminScroll === 'pipeline' ? 'pipeline' : 'approvals';
    state.adminScroll = null;
    requestAnimationFrame(() => root.querySelector('#' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // 파이프라인은 실제 적재 건수. '정상/미수집' 판정 기준이 백엔드에 없으므로
  // 상태 배지 대신 최신일을 그대로 보여준다.
  try {
    const sources = await fetchPipeline();
    if (isStale(token)) return;
    root.querySelector('#pipelineBox').innerHTML = sources.map((d) => `
      <div class="arow">
        <div class="arow__main">
          <span class="arow__name">${d.name}</span>
          <span class="arow__sub">${d.count.toLocaleString()}건</span>
        </div>
        <div class="arow__right">${badge('최신 ' + (d.latest ?? '없음'), 'neutral')}</div>
      </div>`).join('');
  } catch (err) {
    if (isStale(token)) return;
    root.querySelector('#pipelineBox').innerHTML =
      `<div class="arow"><span class="arow__sub">${err.message}</span></div>`;
  }
}
