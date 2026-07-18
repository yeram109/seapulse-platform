// pages/notifications.js — 13/14 알림 설정
// 13(일부 ON) · 14(전부 OFF)는 같은 화면의 다른 토글 상태 → 토글로 즉시 전환된다.

import { state } from '../state.js';
import { navBar, toggleEl, wire } from '../components.js';
import { icon } from '../icons.js';

export function renderNotifications(root) {
  const rows = state.notifications.map((n) => `
    <div class="trow">
      <span class="trow__ico">${icon(n.icon, 18)}</span>
      <div class="trow__info">
        <span class="trow__label">${n.label}</span>
        <span class="trow__sub">${n.sub}</span>
      </div>
      ${toggleEl(n.id, n.on)}
    </div>`).join('');

  root.innerHTML = `
    <section class="screen screen--narrow">
      ${navBar('알림 설정', '/settings')}
      <p class="note">예측·해양 상황 알림을 받아보세요.</p>

      <div class="lgroup__box">${rows}</div>
    </section>
  `;

  // 토글 클릭 → 상태 뒤집고 화면에도 즉시 반영 (다시 그리지 않음)
  root.querySelectorAll('[data-toggle]').forEach((el) =>
    el.addEventListener('click', () => {
      const item = state.notifications.find((n) => n.id === el.dataset.toggle);
      item.on = !item.on;
      el.classList.toggle('is-on', item.on);
      el.setAttribute('aria-checked', item.on);
    }));

  wire(root);
}
