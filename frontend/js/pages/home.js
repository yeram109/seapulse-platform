// pages/home.js — 05·06·07 홈 (물류 / 어업인 / 관리자)

import { navigate } from '../router.js';
import { state, ensureSession } from '../state.js';
import { kpis, weeklyWeather, scenarioPairs, pendingUsers, dataPipeline } from '../../data/mock.js';
import {
  logoBar, tabBar, roleBadge, badge, weatherCardCompact,
  kpiGrid, scenarioCard, wire,
} from '../components.js';
import { icon } from '../icons.js';

/* ============================ 05 / 06 물류·어업인 홈 ============================ */
export function renderRoleHome(role) {
  return function (root) {
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
      <div class="wc-grid">
        ${weatherCardCompact(weeklyWeather[0], { label: '이번 주', statusText: thisWeek.text, statusKind: thisWeek.kind, active: true })}
        ${weatherCardCompact(weeklyWeather[1], { label: '다음 주', statusText: '조업 양호', statusKind: 'ok' })}
      </div>`;

    // 명절 알림 (어업인만)
    const holidayCard = isFisher ? `
      <div class="alert alert--warn">
        <div class="alert__head"><span class="alert__title">${icon('warning', 16)} 명절 알림</span>${badge('추석 D-14', 'warn')}</div>
        <div class="alert__body">명절 직전엔 물량이 몰려 가격이 떨어집니다 (추석 前 평균 −21%). 직후 열흘은 반등했습니다 (설날 +31%).</div>
      </div>` : '';

    const chartLabel = isFisher ? 'kg당 가격 추이' : '어획량 추이';
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
        <p class="scroll-hint" data-nav="/weather">← 밀어서 4주치 보기 · 자세히 ›</p>

        ${holidayCard}

        <div class="section-title">${isFisher ? '가격 예측' : '어획량 예측'}</div>
        <div class="chart-ph">
          <span class="chart-ph__title">${chartLabel}</span>
          <span class="chart-ph__legend">실측 · 예측 · 신뢰구간</span>
        </div>

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
  };
}

export const renderHomeLogistics = renderRoleHome('logistics');
export const renderHomeFisher = renderRoleHome('fisher');

/* ============================ 07 관리자 홈 ============================ */
export function renderHomeAdmin(root) {
  state.role = 'admin';
  const s = ensureSession();

  const approvals = pendingUsers.map((p) => `
    <div class="arow">
      <div class="arow__main"><span class="arow__name">${p.name}</span><span class="arow__sub">${p.email}</span></div>
      <div class="arow__right">${roleBadge(p.roleKey)}<button class="btn btn--sm btn--primary" data-toast="${p.name} 님을 승인했어요">승인</button></div>
    </div>`).join('');

  const pipeline = dataPipeline.map((d) => `
    <div class="arow">
      <div class="arow__main"><span class="arow__name">${d.name}</span><span class="arow__sub">${d.count}</span></div>
      <div class="arow__right">${badge(d.status, d.kind)}</div>
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
      <div class="lgroup__box">${pipeline}</div>

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
}
