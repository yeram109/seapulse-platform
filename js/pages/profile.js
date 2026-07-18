// pages/profile.js — 10 프로필 수정 (여기서 바꾸면 세션에 반영 → 홈·설정 전부 갱신)

import { navigate } from '../router.js';
import { ensureSession } from '../state.js';
import { roleMeta } from '../../data/mock.js';
import { navBar, avatar, wire, toast } from '../components.js';
import { icon } from '../icons.js';

export function renderProfile(root) {
  const s = ensureSession();
  root.innerHTML = `
    <section class="screen screen--narrow">
      ${navBar('프로필 수정', '/settings')}

      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        ${avatar(s.roleKey, 34, true)}
        <span class="textlink" data-toast="사진 변경은 준비 중이에요">사진 변경</span>
      </div>

      <label class="field">
        <span class="field__label">이름</span>
        <input class="input" id="pfName" value="${s.name}" />
      </label>
      <label class="field field--hl">
        <span class="field__label">닉네임</span>
        <input class="input" id="pfNick" value="${s.nickname}" />
      </label>
      <label class="field">
        <span class="field__label">이메일</span>
        <input class="input" id="pfEmail" type="email" value="${s.email}" />
      </label>
      <label class="field">
        <span class="field__label">소속</span>
        <input class="input" id="pfOrg" value="${s.org}" placeholder="예: 통영수협 냉동창고" />
      </label>

      <button class="btn btn--primary" id="saveBtn">저장</button>
    </section>
  `;
  root.querySelector('#saveBtn').addEventListener('click', () => {
    s.name     = root.querySelector('#pfName').value.trim()  || s.name;
    s.nickname = root.querySelector('#pfNick').value.trim()  || s.nickname;
    s.email    = root.querySelector('#pfEmail').value.trim() || s.email;
    s.org      = root.querySelector('#pfOrg').value.trim();
    toast('프로필을 저장했어요');
    navigate('/settings');
  });
  wire(root);
}
