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

// 프로필 아바타 — 역할별 사진(assets/profiles/<role>.jpg|png)을 보여주고,
// 파일이 없으면 자동으로 역할 아이콘으로 폴백. 얼굴 확대·위치는 CSS(.avatar__img--role)에서.
export function avatar(roleKey, size = 26, large = false) {
  const m = roleMeta[roleKey];
  const onerr = `if(!this.dataset.t){this.dataset.t=1;this.src='/assets/profiles/${roleKey}.png'}else{this.remove()}`;
  return `<div class="avatar ${large ? 'avatar--lg' : ''}">`
    + `${icon(m.icon, size)}`
    + `<img class="avatar__img avatar__img--${roleKey}" src="/assets/profiles/${roleKey}.jpg" alt="" onerror="${onerr}">`
    + `</div>`;
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
      item('users',    'users',    '사용자', `data-nav="/admin/users"`),
      item('data',     'database', '데이터', `data-nav="/admin/data"`),
      item('settings', 'gear',     '설정',  `data-nav="/settings"`),
    ];
  } else {
    items = [
      item('home',     'home',  '홈',   `data-nav="/home/${role}"`),
      item('weather',  'waves', '날씨', `data-nav="/weather"`),
      item('settings', 'gear',  '설정', `data-nav="/settings"`),
    ];
  }
  // 맨 앞의 pill = 활성 탭 뒤에서 좌우로 슬라이드하는 '동그라미'(배경). 위치는 JS(wireTabbar)가 잡음.
  return `<nav class="tabbar tabbar--${role}"><span class="tabbar__pill" aria-hidden="true"></span>${items.join('')}</nav>`;
}

// 탭바 슬라이드 시간(ms). CSS transition 과 동일하게 유지 → 이동이 끝난 뒤 화면 전환.
const TAB_SLIDE_MS = 320;

// pill 을 대상 탭 위치로 이동. animate=false 면 트랜지션 없이 즉시(첫 렌더·리렌더용).
function placePill(bar, item, animate) {
  const pill = bar.querySelector('.tabbar__pill');
  if (!pill || !item) return;
  const apply = () => {
    pill.style.width = item.offsetWidth + 'px';
    pill.style.height = item.offsetHeight + 'px';
    pill.style.transform = `translate(${item.offsetLeft}px, ${item.offsetTop}px)`;
    pill.style.opacity = '1';
  };
  if (animate) {
    apply();
  } else {
    pill.style.transition = 'none';
    apply();
    void pill.offsetWidth;      // 강제 리플로우 → 다음 이동부터 트랜지션 적용
    pill.style.transition = '';
  }
}

// 탭 클릭 시: 동그라미를 누른 쪽으로 슬라이드 → 이동이 끝나면 화면 전환.
function wireTabbar(root) {
  const bar = root.querySelector('.tabbar');
  if (!bar) return;
  const items = [...bar.querySelectorAll('.tabbar__item')];
  const active = bar.querySelector('.tabbar__item.is-active') || items[0];
  placePill(bar, active, false);   // 첫 렌더: 활성 탭 위치에 즉시 배치

  items.forEach((el) => {
    if (!el.dataset.nav) return;
    el.addEventListener('click', () => {
      // 동그라미를 누른 탭으로 슬라이드 → 이동이 끝나면 화면 전환
      items.forEach((i) => i.classList.remove('is-active'));
      el.classList.add('is-active');
      placePill(bar, el, true);
      setTimeout(() => navigate(el.dataset.nav), TAB_SLIDE_MS);
    });
  });
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

/* ============================ 4주 예측 라인 차트 ============================ */
// 전주·이번주·다음주·다다음주 4개 지점을 "이어지는 선" 하나로 연결한 미니 라인 차트.
// 값(value)·신뢰구간(lo/hi)에 따라 좌표를 매번 계산 → 데이터가 바뀌면 그래프도 바뀐다.
//   points: [{ label:'전주', week:27, range:'6/30–7/6', value:7.6, type:'실측'|'예측',
//              lo, hi(예측 신뢰구간), now(이번주 강조) }]
//   opts:   { fmt(값 표기 함수) }
export function predictionChart(points, opts = {}) {
  const fmt = opts.fmt || ((v) => v);
  const W = 350, H = 148, padX = 30, padTop = 30, padBot = 18;
  const plotW = W - padX * 2, plotH = H - padTop - padBot;

  // y 스케일: 값 + 신뢰구간까지 모두 담기게 min/max 산출 (+여유 18%)
  const vals = [];
  points.forEach((p) => { vals.push(p.value); if (p.lo != null) vals.push(p.lo); if (p.hi != null) vals.push(p.hi); });
  let min = Math.min(...vals), max = Math.max(...vals);
  const room = (max - min) * 0.18 || Math.abs(max) * 0.1 || 1;
  min -= room; max += room;

  const last = points.length - 1;
  const x = (i) => padX + (last === 0 ? 0 : (i * plotW) / last);
  const y = (v) => padTop + (1 - (v - min) / (max - min)) * plotH;

  // 실측 → 예측이 갈리는 경계(마지막 실측 지점)
  const lastActual = points.reduce((acc, p, i) => (p.type === '실측' ? i : acc), 0);

  // 신뢰구간 밴드: 마지막 실측 지점(폭 0)에서 예측 지점으로 부채꼴처럼 벌어짐
  const bIdx = points.map((_, i) => i).filter((i) => i >= lastActual);
  const bandTop = bIdx.map((i) => `${x(i)},${y(points[i].hi ?? points[i].value)}`);
  const bandBot = bIdx.slice().reverse().map((i) => `${x(i)},${y(points[i].lo ?? points[i].value)}`);
  const band = bIdx.length > 1
    ? `<polygon class="pchart__band" points="${[...bandTop, ...bandBot].join(' ')}" />` : '';

  // 이어지는 선: 실측 구간(실선) + 예측 구간(점선) — 경계 지점을 공유해 매끄럽게 연결
  const actualPts = points.filter((_, i) => i <= lastActual).map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const fcPts = points.map((_, i) => i).filter((i) => i >= lastActual).map((i) => `${x(i)},${y(points[i].value)}`).join(' ');
  const lineActual = `<polyline class="pchart__line pchart__line--actual" points="${actualPts}" />`;
  const lineFc = fcPts.split(' ').length > 1
    ? `<polyline class="pchart__line pchart__line--fc" points="${fcPts}" />` : '';

  // 세로 가이드 + 마커 + 값 라벨 + 신뢰구간 상·하한 라벨(예측 지점만)
  const marks = points.map((p, i) => {
    const px = x(i), py = y(p.value), isFc = p.type !== '실측';
    const guide = `<line class="pchart__guide" x1="${px}" y1="${padTop - 4}" x2="${px}" y2="${padTop + plotH + 4}" />`;
    const ring = p.now ? `<circle class="pchart__ring" cx="${px}" cy="${py}" r="7" />` : '';
    const dot = `<circle class="pchart__dot ${isFc ? 'pchart__dot--fc' : ''}" cx="${px}" cy="${py}" r="4" />`;
    const val = `<text class="pchart__val ${p.now ? 'pchart__val--now' : ''}" x="${px}" y="${py - 11}" text-anchor="middle">${fmt(p.value)}</text>`;
    // 신뢰구간 범위: 상한은 밴드 위 끝, 하한은 밴드 아래 끝에 표기
    const bounds = (isFc && p.hi != null && p.lo != null)
      ? `<text class="pchart__bound" x="${px}" y="${y(p.hi) - 5}" text-anchor="middle">${fmt(p.hi)}</text>`
        + `<text class="pchart__bound" x="${px}" y="${y(p.lo) + 11}" text-anchor="middle">${fmt(p.lo)}</text>`
      : '';
    return guide + ring + bounds + dot + val;
  }).join('');

  const svg = `
    <svg class="pchart__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="전주부터 다다음주까지 4주 예측 추이">
      ${band}${lineActual}${lineFc}${marks}
    </svg>`;

  // 하단 주차 라벨 (라벨 · 몇 주 · 기간 · 실측/예측) — 줄바꿈 없이 칸 높이 균일하게 3줄 분리
  const axis = points.map((p) => `
    <div class="pchart__col ${p.now ? 'is-now' : ''}">
      <span class="pchart__col-name">${p.label}</span>
      <span class="pchart__col-week">${p.week}주</span>
      <span class="pchart__col-range">${p.range}</span>
      <span class="pchart__col-tag pchart__col-tag--${p.type === '실측' ? 'actual' : 'fc'}">${p.type}</span>
    </div>`).join('');

  return `
    <div class="pchart">
      <div class="pchart__legend">
        <span><i class="pchart__lg pchart__lg--actual"></i>실측</span>
        <span><i class="pchart__lg pchart__lg--fc"></i>예측</span>
        <span><i class="pchart__lg pchart__lg--band"></i>신뢰구간</span>
      </div>
      <div class="pchart__plot">${svg}</div>
      <div class="pchart__axis">${axis}</div>
    </div>`;
}

/* ============================ 시나리오 추천 카드 ============================ */
// 예측 신뢰도는 데이터상 이진값(확실/불확실)만 존재 → % 바 대신 두 상태로 표기.
// (지금은 목업 confidence 값에서 임계값으로 파생. 실제 데이터 오면 불리언으로 교체만 하면 됨.)
export function certaintyOf(conf) {
  return conf >= 78 ? { text: '확실', kind: 'ok' } : { text: '불확실', kind: 'warn' };
}

export function scenarioCard(scnKey) {
  const s = scenarios[scnKey];
  const cert = certaintyOf(s.confidence);
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
          <div class="conf__row"><span class="conf__label">예측 신뢰도</span>${badge(cert.text, cert.kind)}</div>
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
  // 탭바 항목은 wireTabbar 에서 슬라이드 처리 → 여기 일반 핸들러에서는 제외
  root.querySelectorAll('[data-nav]').forEach((el) => {
    if (el.closest('.tabbar')) return;
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });
  root.querySelectorAll('[data-back]').forEach((el) =>
    el.addEventListener('click', () => navigate(el.dataset.back)));
  root.querySelectorAll('[data-toast]').forEach((el) =>
    el.addEventListener('click', () => toast(el.dataset.toast)));
  wireTabbar(root);
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
