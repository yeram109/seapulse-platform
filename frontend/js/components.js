// js/components.js — 여러 화면이 함께 쓰는 UI 조각(함수)들.

import { navigate, refresh } from './router.js';
import { state, startSession } from './state.js';
import { scenarios, roleMeta, regions, regionMeta } from '../data/mock.js';
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
function diffTag(diff) {
  const up = diff >= 0;
  return `<span class="${up ? 'wdiff-up' : 'wdiff-down'}">전년 ${up ? '▲+' : '▼−'}${Math.abs(diff)}</span>`;
}

// 상세 화면(08)용 가로형 날씨 카드
export function weatherCard(w, statusText, statusKind) {
  const st = statusText || w.status, sk = statusKind || w.kind;
  const typeBadge = w.type === '실측' ? badge('실측', 'brand') : badge('예측', 'neutral');
  return `
    <div class="wcard">
      <div class="wcard__top"><span class="wcard__wk">${w.week}주 · ${w.range}</span>${typeBadge}</div>
      <div class="wcard__metrics">
        <span class="wmetric">${icon('thermometer', 15)} 수온 ${w.temp}°C <small>(${diffTag(w.tempDiff)})</small></span>
        <span class="wmetric">${icon('wind', 15)} 풍속 ${w.wind} m/s <small>(${diffTag(w.windDiff)})</small></span>
      </div>
      <div>${badge(st, sk)}</div>
    </div>`;
}

// 홈용 2단 컴팩트 날씨 카드
export function weatherCardCompact(w, { label, statusText, statusKind, active }) {
  const st = statusText || w.status, sk = statusKind || w.kind;
  const typeBadge = w.type === '실측' ? badge('실측', 'brand') : badge('예측', 'neutral');
  const metric = (ic, name, val, diff) => `
    <div class="wc__metric">
      <span class="wc__ml">${icon(ic, 14)} ${name}</span>
      <span class="wc__mv">${val}<small>${diffTag(diff)}</small></span>
    </div>`;
  return `
    <div class="wc ${active ? 'is-active' : ''}">
      <div class="wc__head">
        <div class="wc__when"><b>${label} (${w.week}주)</b><span>${w.range}</span></div>
        ${typeBadge}
      </div>
      ${metric('thermometer', '수온', w.temp + '°C', w.tempDiff)}
      ${metric('wind', '풍속', w.wind + ' m/s', w.windDiff)}
      <div>${badge(st, sk)}</div>
    </div>`;
}

/* ============================ KPI ============================ */
export function kpiGrid(items) {
  const cell = (k) => {
    const vClass = k.valueKind ? `kpi__value kpi__value--${k.valueKind}` : 'kpi__value';
    const sub = k.sub ? `<span class="kpi__sub ${k.subOk ? 'kpi__sub--ok' : ''}">${k.sub}</span>` : '';
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
function confKindOf(conf) { return conf >= 80 ? 'ok' : conf >= 73 ? 'brand' : 'warn'; }

export function scenarioCard(scnKey) {
  const s = scenarios[scnKey];
  const ck = confKindOf(s.confidence);
  return `
    <div class="card scn-card scn-card--${s.typeKind}">
      <div class="scn">
        <div class="scn__head">
          <span class="scn__title">${s.title}</span>
          ${badge(s.type, s.typeKind)}
        </div>
        <div class="scn__cond">
          ${badge('물량 ' + s.volume, 'outline')} <span>×</span> ${badge('가격 ' + s.price, 'outline')}
        </div>
        <div class="conf">
          <div class="conf__row"><span class="conf__label">예측 신뢰도</span><span class="conf__val">${s.confidence}%</span></div>
          <div class="conf__bar"><div class="conf__fill conf__fill--${ck}" style="width:${s.confidence}%"></div></div>
          <div class="conf__row"><span class="conf__mae">MAE ${s.mae}</span></div>
        </div>
        <div class="scn__divider"></div>
        <div class="scn__headline">${s.headline}</div>
        <div class="scn__desc">${s.desc}</div>
        <button class="btn btn--scn" data-action="save-prediction" data-scn="${scnKey}">${icon('bookmark', 16)} 예측 저장</button>
      </div>
    </div>`;
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
  const note = `<p class="sheet-note">＊ 경남 8개 항구 · 통영·마산·삼천포·남해·거제도만 예측 데이터 제공, 의창·진해·고성은 추후 제공 예정입니다.</p>`;
  const render = () => {
    const avail = regions.filter((r) => !s.regions.includes(r.name));
    const rows = avail.length
      ? avail.map((r) => `
          <div class="sheet-row ${r.pending ? 'sheet-row--pending' : ''}">
            <div class="sheet-row__main">
              <span class="sheet-row__name">${r.name}${r.pending ? ' ' + badge('준비 중', 'neutral') : ''}</span>
              <span class="sheet-row__sub">${regionMeta(r.name)}</span>
            </div>
            <button class="btn btn--sm btn--primary" data-add-region="${r.name}">추가</button>
          </div>`).join('')
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
      const s = scenarios[el.dataset.scn];
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      state.session.saved.unshift({
        date, roleKey: s.role, type: s.type, typeKind: s.typeKind,
        headline: s.headline.replace('⚠️ ', ''), confidence: s.confidence,
      });
      toast('예측을 저장했어요 · 설정 › 저장한 예측');
    }));
}

// 다른 페이지에서 아이콘 쓰도록 재노출
export { icon };
