// js/components.js — 여러 화면이 함께 쓰는 UI 조각(함수)들.

import { navigate, refresh } from './router.js';
import { state, startSession } from './state.js';
import { roleMeta } from '../data/mock.js';
import { regionsSync, regionMetaSync } from './api.js';
import { icon } from './icons.js';

/* ============================ 작은 조각 ============================ */

export function badge(text, kind = 'neutral') {
  return `<span class="badge badge--${kind}">${text}</span>`;
}

export function roleBadge(roleKey) {
  const m = roleMeta[roleKey];
  return badge(m.label, m.badge);
}

export function logoBar() {
  return `
    <header class="logobar">
      <div class="logo-dots"><span></span><span></span><span></span></div>
      <span class="logobar__name">Sea-Pulse</span>
    </header>`;
}

export function navBar(title, backPath = '/settings') {
  return `
    <header class="navbar">
      <span class="navbar__back" data-back="${backPath}" role="button" aria-label="뒤로">‹</span>
      <span class="navbar__title">${title}</span>
    </header>`;
}

/* ============================ 하단 탭바 ============================ */
export function tabBar(activeKey) {
  const role = state.role;
  const item = (key, ic, lbl, nav, extra = '') =>
    `<button class="tabbar__item ${activeKey === key ? 'is-active' : ''}" ${nav} ${extra}>
       <span class="tabbar__ico">${icon(ic, 21)}</span><span class="tabbar__lbl">${lbl}</span>
     </button>`;

  let items;
  if (role === 'admin') {
    items = [
      item('home',     'home',     '홈',    `data-nav="/home/admin"`),
      item('users',    'users',    '사용자', ``, `data-adminscroll="approvals"`),
      item('data',     'database', '데이터', ``, `data-adminscroll="pipeline"`),
      item('settings', 'gear',     '설정',  `data-nav="/settings"`),
    ];
  } else {
    items = [
      item('home',     'home',  '홈',   `data-nav="/home/${role}"`),
      item('weather',  'waves', '날씨', `data-nav="/weather"`),
      item('settings', 'gear',  '설정', `data-nav="/settings"`),
    ];
  }
  return `<nav class="tabbar tabbar--${role}">${items.join('')}</nav>`;
}

/* ============================ 날씨 ============================ */
// 전년 동주 대비. 작년 같은 주 실측이 없으면 서버가 null을 준다.
function diffTag(diff) {
  if (diff == null) return '';
  const up = diff >= 0;
  return `<span class="${up ? 'wdiff-up' : 'wdiff-down'}">전년 ${up ? '▲+' : '▼−'}${Math.abs(diff)}</span>`;
}

// '실측'은 그 주 관측 평균, '예측'은 같은 주차의 과거 평균(발표용 데모 표기 —
// 실제로는 계절 평균이지 기상 예보가 아니다. weather.py 참고).
function typeBadge(w) {
  if (w.type === '실측') {
    return badge('실측', 'brand');
  }
  return badge('예측', 'neutral');
}

// 조업 상태 배지 — 공식 특보 기준이 아니라 발표용 데모로 정한 임의 임계값.
// 데이터 분포(수온 5~31℃, 풍속 0.8~11.6m/s) 기준으로, 수온이 높거나 전년보다
// 많이 오른 주는 고수온 주의, 풍속이 강하거나 전년보다 많이 세진 주는 강풍 주의,
// 둘 다 아니면 조업 양호로 표시한다.
function conditionBadge(w) {
  if (w.water_temp == null || w.wind_speed == null) return '';
  const hot = w.water_temp >= 26 || (w.water_temp_diff ?? 0) >= 3;
  const windy = w.wind_speed >= 8 || (w.wind_speed_diff ?? 0) >= 3;
  if (hot) return `<div class="wc__status wc__status--warn">고수온 주의</div>`;
  if (windy) return `<div class="wc__status wc__status--warn">강풍 주의</div>`;
  return `<div class="wc__status wc__status--ok">조업 양호</div>`;
}

// 상세 화면(08)용 가로형 날씨 카드
export function weatherCard(w) {
  return `
    <div class="wcard">
      <div class="wcard__top"><span class="wcard__wk">${w.week_of_year}주 · ${w.range}</span>${typeBadge(w)}</div>
      <div class="wcard__metrics">
        <span class="wmetric">${icon('thermometer', 15)} 수온 ${w.water_temp}°C <small>${diffTag(w.water_temp_diff)}</small></span>
        <span class="wmetric">${icon('wind', 15)} 풍속 ${w.wind_speed} m/s <small>${diffTag(w.wind_speed_diff)}</small></span>
      </div>
      ${conditionBadge(w)}
    </div>`;
}

// 홈용 2단 컴팩트 날씨 카드
export function weatherCardCompact(w, { label, active } = {}) {
  const metric = (ic, name, val, diff) => `
    <div class="wc__metric">
      <span class="wc__ml">${icon(ic, 14)} ${name}</span>
      <span class="wc__mv">${val}<small>${diffTag(diff)}</small></span>
    </div>`;
  return `
    <div class="wc ${active ? 'is-active' : ''}">
      <div class="wc__head">
        <div class="wc__when"><b>${label} (${w.week_of_year}주)</b><span>${w.range}</span></div>
        ${typeBadge(w)}
      </div>
      ${metric('thermometer', '수온', w.water_temp + '°C', w.water_temp_diff)}
      ${metric('wind', '풍속', w.wind_speed + ' m/s', w.wind_speed_diff)}
      ${conditionBadge(w)}
    </div>`;
}

/* ============================ KPI ============================ */
export function kpiGrid(items) {
  const cell = (k) => {
    const vClass = k.valueKind ? `kpi__value kpi__value--${k.valueKind}` : 'kpi__value';
    const sub = k.sub ? `<span class="kpi__sub${k.subKind ? ` kpi__sub--${k.subKind}` : ''}">${k.sub}</span>` : '';
    const badgeHtml = k.badge ? ` ${badge(k.badge, 'brand')}` : '';
    return `
      <div class="kpi">
        <span class="kpi__label">${k.label}${badgeHtml}</span>
        <span class="${vClass}">${k.value}</span>
        ${sub}
      </div>`;
  };
  return `<div class="kpi-grid">${items.map(cell).join('')}</div>`;
}

/* ============================ 시나리오 추천 카드 ============================ */
// 서버가 주는 headline(warehouse_view.recommended_space / fisher_view.timing_type)을
// 카드 테두리 색으로 옮기는 표. 서버에 없는 값이 오면 중립으로 떨어진다.
const HEADLINE_KIND = {
  분산판매: 'warn',
  충분한공간: 'warn',
  여유공간: 'warn',
  대기: 'ok',
  평소대로: 'neutral',
  표준공간: 'neutral',
};

/** MAE 는 모델 전체의 평균 오차. 어획량은 kg → 톤, 가격은 원/kg 그대로. */
function maeText(role, pred) {
  return role === 'fisher'
    ? `±${Math.round(pred.predicted_price.mae).toLocaleString()}원/kg`
    : `±${(pred.predicted_catch.mae / 1000).toFixed(1)}톤`;
}

/**
 * 추천 카드. mock 이 아니라 /predictions 응답(pred)을 그대로 받는다.
 * 신뢰도 %는 백엔드에 없는 값이라 표시하지 않고, uncertain 배지로 대체한다.
 */
export function scenarioCard(pred) {
  const s = pred.scenario;
  const isFisher = s.role === 'fisher';
  const kind = HEADLINE_KIND[s.headline] ?? 'neutral';
  const v = isFisher ? pred.predicted_price : pred.predicted_catch;

  const uncertainRow = v.uncertain
    ? `<div class="scn__uncertain">
         ${badge('예측 불확실', 'warn')}
         <span>신뢰구간이 넓어 참고용으로만 봐주세요</span>
       </div>`
    : '';

  return `
    <div class="card scn-card scn-card--${kind}">
      <div class="scn">
        <div class="scn__head">
          <span class="scn__title">${isFisher ? '판매 타이밍 추천' : '재고 배치 추천'}</span>
          ${badge(s.headline, kind)}
        </div>
        <div class="scn__cond">
          ${badge('물량 ' + s.volume_level, 'outline')} <span>×</span> ${badge('가격 ' + s.price_level, 'outline')}
        </div>
        ${uncertainRow}
        <div class="conf">
          <div class="conf__row"><span class="conf__mae">모델 평균오차 MAE ${maeText(s.role, pred)}</span></div>
        </div>
        <div class="scn__divider"></div>
        <div class="scn__desc">${s.text}</div>
        <button class="btn btn--scn" data-action="save-prediction">${icon('bookmark', 16)} 예측 저장</button>
      </div>
    </div>`;
}

/* ============================ 로딩 / 에러 ============================ */
// API 응답을 기다리는 동안, 그리고 실패했을 때 화면에 채울 것.

/** KPI 자리 채움. 실제 값이 오기 전에 mock 숫자를 보여주면 오해를 주므로 빈 칸으로 둔다. */
export function kpiSkeleton(n = 4) {
  const cell = `<div class="kpi">
      <div class="skeleton skeleton--short"></div>
      <div class="skeleton skeleton--line"></div>
    </div>`;
  return `<div class="kpi-grid">${cell.repeat(n)}</div>`;
}

export function loadingCard(label = '예측을 불러오는 중…') {
  return `<div class="card scn-card scn-card--neutral"><div class="scn">
      <div class="skeleton skeleton--line"></div>
      <div class="skeleton skeleton--line skeleton--short"></div>
      <div class="scn__desc">${label}</div>
    </div></div>`;
}

export function errorCard(err) {
  const hint =
    err.code === 'OUT_OF_FORECAST_RANGE' && err.validRange
      ? `<div class="scn__desc">예측이 있는 기간: ${err.validRange[0]} ~ ${err.validRange[1]}</div>`
      : '';
  return `<div class="card scn-card scn-card--danger"><div class="scn">
      <div class="scn__head">
        <span class="scn__title">예측을 불러오지 못했어요</span>
        ${badge('오류', 'danger')}
      </div>
      <div class="scn__desc">${err.message}</div>
      ${hint}
    </div></div>`;
}

/* ============================ 토글 ============================ */
export function toggleEl(id, on) {
  return `
    <div class="toggle ${on ? 'is-on' : ''}" data-toggle="${id}" role="switch" aria-checked="${on}">
      <span class="toggle__txt toggle__txt--on">ON</span>
      <span class="toggle__txt toggle__txt--off">OFF</span>
      <span class="toggle__knob"></span>
    </div>`;
}

/* ============================ 토스트 ============================ */
let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('is-show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 1600);
}

/* ============================ 모달(바텀시트) 공통 ============================ */
// 모달을 폰 프레임(.phone) 위치·크기에 맞춰 앵커링 → 데스크톱에서도 폰 안쪽에 뜬다.
function anchorToPhone(back) {
  const phone = document.querySelector('.phone');
  if (!phone) return;
  const r = phone.getBoundingClientRect();
  back.style.inset = 'auto';
  back.style.left = r.left + 'px';
  back.style.top = r.top + 'px';
  back.style.width = r.width + 'px';
  back.style.height = r.height + 'px';
}

function openSheet(title, sub, bodyHtml, { showDone = true, refreshOnClose = true } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal">
      <div class="modal__head">
        <div>
          <div class="modal__title">${title}</div>
          ${sub ? `<div class="modal__sub">${sub}</div>` : ''}
        </div>
        ${showDone ? `<button class="btn--done" data-sheet-close>${icon('check', 15)} 완료</button>` : ''}
      </div>
      <div class="modal__body">${bodyHtml}</div>
    </div>`;
  document.body.appendChild(back);
  anchorToPhone(back);
  const close = () => { back.remove(); if (refreshOnClose) refresh(); };
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.querySelector('[data-sheet-close]')?.addEventListener('click', close);
  return { back, close };
}

// 역할 선택 (로그인) → 세션 시작 후 홈으로
export function openRoleModal() {
  const card = (key) => {
    const m = roleMeta[key];
    return `
      <div class="role-card" data-role="${key}">
        <span class="role-card__ico role-card__ico--${m.badge}">${icon(m.icon, 22)}</span>
        <span><span class="role-card__t">${m.label}</span><span class="role-card__d">${m.desc}</span></span>
      </div>`;
  };
  const { back } = openSheet('역할을 선택하세요', '선택한 역할의 홈 화면으로 이동합니다',
    `<div class="role-cards">${card('logistics')}${card('fisher')}${card('admin')}</div>`,
    { showDone: false, refreshOnClose: false });
  back.querySelectorAll('.role-card').forEach((el) =>
    el.addEventListener('click', () => {
      startSession(el.dataset.role);
      back.remove();
      navigate('/home/' + el.dataset.role);
    }));
}

// 지역 추가 모달 — 여러 곳을 추가하고 완료로 닫는다
export function openRegionModal() {
  const s = state.session;
  // 8개 항구 모두 예측이 있다. 의창·진해·고성은 위판 물량이 적어 금액 비중이
  // 0.0%로 잡힐 뿐, 예측이 없는 게 아니다.
  const note = `<p class="sheet-note">＊ 경남 8개 항구 · 물량이 적은 항구는 예측 불확실성이 큽니다.</p>`;
  const render = () => {
    const avail = regionsSync().filter((r) => !s.regions.includes(r.name));
    const rows = avail.length
      ? avail.map((r) => {
          const noForecast = !r.weeks?.length;
          return `
          <div class="sheet-row ${noForecast ? 'sheet-row--pending' : ''}">
            <div class="sheet-row__main">
              <span class="sheet-row__name">${r.name}${noForecast ? ' ' + badge('예측 없음', 'neutral') : ''}</span>
              <span class="sheet-row__sub">${regionMetaSync(r.name)}</span>
            </div>
            <button class="btn btn--sm btn--primary" data-add-region="${r.name}">추가</button>
          </div>`;
        }).join('')
      : `<div class="sheet-empty">${icon('check', 16)} 경남 8개 항구를 모두 추가했어요</div>`;
    return rows + note;
  };
  const { back } = openSheet('경남 지역 추가', '여러 곳을 추가한 뒤 완료를 누르세요', render());
  const body = back.querySelector('.modal__body');
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add-region]');
    if (!btn) return;
    const name = btn.dataset.addRegion;
    if (!s.regions.includes(name)) { s.regions.push(name); s.region = name; }
    body.innerHTML = render();
    toast(`'${name}' 추가됨`);
  });
}

// 어종 추가 모달 (삼치 1종 + 빈 슬롯 + 완료)
export function openSpeciesModal() {
  const slots = Array.from({ length: 3 }, () => `<div class="sheet-slot">${icon('plus', 15)} 빈 슬롯</div>`).join('');
  openSheet('어종 추가', '예측 대상 어종 (현재 삼치)',
    `<div class="sheet-row sheet-row--static">
       <div class="sheet-row__main">
         <span class="sheet-row__name">${icon('fish', 16)} 삼치</span>
         <span class="sheet-row__sub">현재 유일하게 제공되는 어종</span>
       </div>
       ${badge('추가됨', 'ok')}
     </div>
     <div class="sheet-slots">${slots}</div>
     <p class="sheet-note">＊ 삼치만 데이터가 있어요 · 다른 어종은 추후 추가 예정입니다.</p>`);
}

/* ============================ 이벤트 배선 ============================ */
export function wire(root) {
  root.querySelectorAll('[data-nav]').forEach((el) =>
    el.addEventListener('click', () => navigate(el.dataset.nav)));
  root.querySelectorAll('[data-back]').forEach((el) =>
    el.addEventListener('click', () => navigate(el.dataset.back)));
  root.querySelectorAll('[data-toast]').forEach((el) =>
    el.addEventListener('click', () => toast(el.dataset.toast)));
  root.querySelectorAll('[data-adminscroll]').forEach((el) =>
    el.addEventListener('click', () => { state.adminScroll = el.dataset.adminscroll; navigate('/home/admin'); }));
  root.querySelectorAll('[data-action="add-region"]').forEach((el) =>
    el.addEventListener('click', openRegionModal));
  root.querySelectorAll('[data-action="add-species"]').forEach((el) =>
    el.addEventListener('click', openSpeciesModal));
  root.querySelectorAll('[data-action="save-prediction"]').forEach((el) =>
    el.addEventListener('click', () => {
      // 저장 대상은 지금 화면에 그려져 있는 예측 = home.js 가 넣어둔 lastPrediction
      const pred = state.lastPrediction;
      if (!pred) return toast('저장할 예측이 없어요');

      const s = pred.scenario;
      const isFisher = s.role === 'fisher';
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      state.session.saved.unshift({
        date,
        roleKey: s.role,
        type: s.headline,
        typeKind: HEADLINE_KIND[s.headline] ?? 'neutral',
        headline: s.text,
        week: pred.week_start,
        uncertain: (isFisher ? pred.predicted_price : pred.predicted_catch).uncertain,
      });
      toast('예측을 저장했어요 · 설정 › 저장한 예측');
    }));
}

// 다른 페이지에서 아이콘 쓰도록 재노출
export { icon };
