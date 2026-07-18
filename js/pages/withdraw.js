// pages/withdraw.js — 15 회원 탈퇴

import { navigate } from '../router.js';
import { state } from '../state.js';
import { withdrawReasons } from '../../data/mock.js';
import { navBar, wire, toast } from '../components.js';
import { icon } from '../icons.js';

export function renderWithdraw(root) {
  let selected = 0;   // 선택된 탈퇴 사유 인덱스

  const rows = withdrawReasons.map((r, i) => `
    <div class="radio-row ${i === 0 ? 'is-sel' : ''}" data-idx="${i}">
      <span class="radio-dot"></span>
      <div class="radio-row__main"><span class="radio-row__label">${r}</span></div>
    </div>`).join('');

  root.innerHTML = `
    <section class="screen screen--narrow">
      ${navBar('회원 탈퇴', '/settings')}

      <div class="alert alert--danger">
        <div class="alert__head"><span class="alert__title">${icon('warning', 16)} 탈퇴 전 확인해주세요</span></div>
        <div class="alert__body">계정·리포트가 모두 삭제되며 복구할 수 없습니다.</div>
      </div>

      <div class="section-title">탈퇴 사유</div>
      <div class="lgroup__box" id="reasons">${rows}</div>

      <button class="btn btn--danger" id="withdrawBtn">회원 탈퇴</button>
    </section>
  `;

  // 사유 라디오 선택
  root.querySelectorAll('[data-idx]').forEach((el) =>
    el.addEventListener('click', () => {
      selected = Number(el.dataset.idx);
      root.querySelectorAll('#reasons .radio-row').forEach((r) => r.classList.remove('is-sel'));
      el.classList.add('is-sel');
    }));

  root.querySelector('#withdrawBtn').addEventListener('click', () => {
    state.session = null;
    toast('탈퇴 처리되었습니다');
    navigate('/login');
  });

  wire(root);
}
