// pages/region.js — 12 활동 지역 변경 (내가 추가한 지역들 중에서 고른다)

import { navigate, refresh } from '../router.js';
import { ensureSession } from '../state.js';
import { regionMeta } from '../../data/mock.js';
import { navBar, wire, toast, openRegionModal } from '../components.js';

export function renderRegion(root) {
  const s = ensureSession();

  const rows = s.regions.map((name) => {
    const sel = name === s.region;
    return `
      <div class="radio-row ${sel ? 'is-sel' : ''}" data-region="${name}">
        <span class="radio-dot"></span>
        <div class="radio-row__main"><span class="radio-row__label">${name}</span></div>
        <span class="radio-row__meta">${regionMeta(name)}</span>
      </div>`;
  }).join('');

  root.innerHTML = `
    <section class="screen screen--narrow">
      ${navBar('활동 지역', '/settings')}
      <p class="section-sub">경남 · 위판 항구 · 내가 추가한 지역</p>

      <div class="lgroup__box">${rows}</div>

      <button class="btn btn--ghost" id="addBtn"><span class="emo">＋</span>지역 추가</button>
      <button class="btn btn--primary" id="saveBtn">저장</button>
    </section>
  `;

  root.querySelectorAll('[data-region]').forEach((el) =>
    el.addEventListener('click', () => { s.region = el.dataset.region; refresh(); }));

  root.querySelector('#addBtn').addEventListener('click', openRegionModal);
  root.querySelector('#saveBtn').addEventListener('click', () => {
    toast(`활동 지역을 '${s.region}'(으)로 저장했어요`);
    navigate('/settings');
  });
  wire(root);
}
