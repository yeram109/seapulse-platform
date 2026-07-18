// pages/password.js — 11 비밀번호 변경

import { navigate } from '../router.js';
import { navBar, wire, toast } from '../components.js';

export function renderPassword(root) {
  root.innerHTML = `
    <section class="screen screen--narrow">
      ${navBar('비밀번호 변경', '/settings')}

      <label class="field">
        <span class="field__label">현재 비밀번호</span>
        <input class="input" type="password" placeholder="••••••••" />
      </label>
      <label class="field">
        <span class="field__label">새 비밀번호 (8자 이상, 영문+숫자)</span>
        <input class="input" type="password" placeholder="••••••••" />
      </label>
      <label class="field">
        <span class="field__label">새 비밀번호 확인</span>
        <input class="input" type="password" placeholder="••••••••" />
      </label>

      <button class="btn btn--primary" id="saveBtn">변경하기</button>
    </section>
  `;
  root.querySelector('#saveBtn').addEventListener('click', () => {
    toast('비밀번호를 변경했어요');
    navigate('/settings');
  });
  wire(root);
}
