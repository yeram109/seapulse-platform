// pages/home.js — 05·06·07 홈 (물류 / 어업인 / 관리자)

import { navigate, isStale } from '../router.js';
import { state, ensureSession } from '../state.js';
import {
  logoBar, tabBar, roleBadge, badge, weatherCardCompact,
  kpiGrid, kpiSkeleton, scenarioCard, loadingCard, errorCard, toast, wire,
} from '../components.js';
import { icon } from '../icons.js';
import {
  fetchPrediction, fetchWeather, fetchPipeline, fetchModelInfo,
  startRefresh, refreshStatus, regionIdOf, weeksOf, toTon, toWon, weekLabel,
} from '../api.js';

/** 예측값으로 KPI 2×2를 만든다. mock 의 고정 문자열을 대체. */
function kpisFromPrediction(role, pred) {
  const c = pred.predicted_catch;
  const p = pred.predicted_price;
  return role === 'fisher'
    ? [
        { label: '예상 위판가', value: toWon(p.value), sub: `신뢰 ${toWon(p.lower_bound)}~${toWon(p.upper_bound)}`, badge: '위판가' },
        { label: '예측 주차', value: weekLabel(pred.week_start), sub: pred.week_start },
        { label: '이번 주 물량', value: pred.scenario.volume_level, sub: `가격 ${pred.scenario.price_level}` },
        { label: '예측 어획량', value: toTon(c.value), sub: `${toTon(c.lower_bound)}~${toTon(c.upper_bound)}` },
      ]
    : [
        { label: '예측 어획량', value: toTon(c.value), sub: `${toTon(c.lower_bound)}~${toTon(c.upper_bound)}` },
        { label: '예측 주차', value: weekLabel(pred.week_start), sub: pred.week_start },
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

    // 명절 알림 (어업인만)
    const holidayCard = isFisher ? `
      <div class="alert alert--warn">
        <div class="alert__head"><span class="alert__title">${icon('warning', 16)} 명절 알림</span>${badge('추석 D-14', 'warn')}</div>
        <div class="alert__body">명절 직전엔 물량이 몰려 가격이 떨어집니다 (추석 前 평균 −21%). 직후 열흘은 반등했습니다 (설날 +31%).</div>
      </div>` : '';

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
        <p class="scroll-hint" data-nav="/weather">← 밀어서 4주치 보기 · 자세히 ›</p>

        ${holidayCard}

        <div class="section-title">${isFisher ? '가격 예측' : '어획량 예측'}</div>
        <div class="chart-ph">
          <span class="chart-ph__title">${chartLabel}</span>
          <span class="chart-ph__legend">실측 · 예측 · 신뢰구간</span>
        </div>

        <div id="weekChips" class="chips"></div>
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
    const weekSlot = root.querySelector('#weekChips');

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

      // 기본 주차 = 그 항구에서 예측이 있는 가장 최근 주차.
      // 오늘 날짜로 계산하면 안 된다 (배포 예측 범위가 과거라 항상 빗나감).
      const week = weeks.includes(state.weekStart) ? state.weekStart : weeks[weeks.length - 1];
      state.weekStart = week;

      weekSlot.innerHTML = weeks
        .map((w) => `<span class="chip ${w === week ? 'is-active' : ''}" data-week="${w}">${weekLabel(w)}</span>`)
        .join('');
      weekSlot.querySelectorAll('[data-week]').forEach((el) =>
        el.addEventListener('click', () => { state.weekStart = el.dataset.week; navigate('/home/' + role); }));

      const pred = await fetchPrediction({
        regionId,
        weekStart: week,
        role,
        capacityTon: s.warehouseCapacityTon,
      });
      if (isStale(token)) return;

      state.lastPrediction = pred;
      kpiSlot.innerHTML = kpiGrid(kpisFromPrediction(role, pred));
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

  const approvals = state.demoPendingUsers.length
    ? state.demoPendingUsers.map((p) => `
        <div class="arow">
          <div class="arow__main"><span class="arow__name">${p.name}</span><span class="arow__sub">${p.email}</span></div>
          <div class="arow__right">${roleBadge(p.roleKey)}<button class="btn btn--sm btn--primary" data-approve="${p.email}">승인</button></div>
        </div>`).join('')
    : `<div class="arow"><span class="arow__sub">승인 대기 중인 사용자가 없어요</span></div>`;

  root.innerHTML = `
    <section class="screen screen--tab">
      ${logoBar()}
      <div class="role-row">
        ${roleBadge('admin')}
        <span class="role-row__meta">시스템 운영</span>
        <span class="role-row__name">${s.nickname} 님</span>
      </div>

      <div id="kpiSlot">${kpiSkeleton()}</div>

      <div class="section-title" id="approvals">승인 대기 사용자</div>
      <div class="lgroup__box">${approvals}</div>
      <p class="note">＊ 사용자 목록은 데모 데이터입니다. 회원가입이 서버에 저장되지 않아 승인 결과는 새로고침하면 되돌아갑니다.</p>

      <div class="section-title" id="pipeline">데이터 파이프라인</div>
      <div class="lgroup__box" id="pipelineBox"><div class="arow"><span class="arow__sub">불러오는 중…</span></div></div>

      <button class="btn btn--primary" id="refreshBtn">예측 갱신 실행</button>
      <p class="note" id="refreshNote">예측 파이프라인을 다시 돌립니다 (추론 → DB 적재 → 시나리오 생성). 10초쯤 걸립니다.</p>
    </section>
    ${tabBar('home')}
  `;
  wire(root);

  // 승인: 데모 목록에서 빼고 사용자 수를 늘린다 (서버에는 반영되지 않음)
  root.querySelectorAll('[data-approve]').forEach((el) =>
    el.addEventListener('click', () => {
      const email = el.dataset.approve;
      const user = state.demoPendingUsers.find((u) => u.email === email);
      state.demoPendingUsers = state.demoPendingUsers.filter((u) => u.email !== email);
      state.demoUserCount += 1;
      toast(`${user?.name ?? ''} 님을 승인했어요`);
      state.adminScroll = 'approvals';
      navigate('/home/admin');
    }));

  root.querySelector('#refreshBtn').addEventListener('click', () => runRefresh(root));

  if (state.adminScroll) {
    const id = state.adminScroll === 'pipeline' ? 'pipeline' : 'approvals';
    state.adminScroll = null;
    requestAnimationFrame(() => root.querySelector('#' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // 파이프라인은 실제 적재 건수. '정상/미수집' 판정 기준이 백엔드에 없으므로
  // 상태 배지 대신 최신일을 그대로 보여준다.
  try {
    const [sources, model] = await Promise.all([fetchPipeline(), fetchModelInfo()]);
    if (isStale(token)) return;

    root.querySelector('#pipelineBox').innerHTML = sources.map((d) => `
      <div class="arow">
        <div class="arow__main">
          <span class="arow__name">${d.name}</span>
          <span class="arow__sub">${d.count.toLocaleString()}건</span>
        </div>
        <div class="arow__right">${badge('최신 ' + (d.latest ?? '없음'), 'neutral')}</div>
      </div>`).join('');

    const wipanLatest = sources.find((d) => d.name.startsWith('위판'))?.latest ?? '없음';
    root.querySelector('#kpiSlot').innerHTML = kpiGrid([
      { label: '전체 사용자', value: `${state.demoUserCount}명`, sub: '데모 데이터' },
      { label: '승인 대기', value: `${state.demoPendingUsers.length}명`, sub: '데모 데이터',
        valueKind: state.demoPendingUsers.length ? 'warn' : undefined },
      { label: '데이터 최신일', value: wipanLatest, sub: '위판 기준' },
      { label: '모델 MAE', value: `±${Math.round(model.price_mae).toLocaleString()}원`,
        sub: `어획량 ±${(model.catch_mae / 1000).toFixed(1)}톤 · ${model.model_version}` },
    ]);
  } catch (err) {
    if (isStale(token)) return;
    root.querySelector('#pipelineBox').innerHTML =
      `<div class="arow"><span class="arow__sub">${err.message}</span></div>`;
    // 스켈레톤을 그대로 두면 영영 로딩 중처럼 보인다. 서버가 필요한 칸은
    // '—'로, 데모 데이터인 칸은 그대로 채운다.
    root.querySelector('#kpiSlot').innerHTML = kpiGrid([
      { label: '전체 사용자', value: `${state.demoUserCount}명`, sub: '데모 데이터' },
      { label: '승인 대기', value: `${state.demoPendingUsers.length}명`, sub: '데모 데이터' },
      { label: '데이터 최신일', value: '—', sub: '불러오지 못함' },
      { label: '모델 MAE', value: '—', sub: '불러오지 못함' },
    ]);
  }
}

/** '예측 갱신 실행' — 파이프라인을 돌리고 끝날 때까지 상태를 폴링한다. */
async function runRefresh(root) {
  const btn = root.querySelector('#refreshBtn');
  const note = root.querySelector('#refreshNote');
  btn.disabled = true;

  try {
    await startRefresh();
    // 서버가 subprocess 3개를 순서대로 돌린다. 끝날 때까지 step 을 보여준다.
    for (;;) {
      const st = await refreshStatus();
      if (st.state === 'running') {
        note.textContent = `갱신 중… ${st.step ?? ''}`;
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      if (st.state === 'failed') {
        note.textContent = st.message ?? '갱신에 실패했어요';
        toast('예측 갱신 실패');
      } else {
        toast('예측 갱신 완료 · 최신 예측이 반영됐어요');
        navigate('/home/admin');   // 새 MAE·최신일로 다시 그린다
      }
      break;
    }
  } catch (err) {
    note.textContent = err.message;
    toast('예측 갱신을 시작하지 못했어요');
  } finally {
    btn.disabled = false;
  }
}
