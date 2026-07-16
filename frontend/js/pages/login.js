// pages/login.js — 01 로그인
// 렌더 함수 패턴: (1) HTML 을 root 에 넣고 → (2) 이벤트를 연결한다.

import { navigate } from '../router.js';
import { openRoleModal, wire } from '../components.js';

export function renderLogin(root) {
  root.innerHTML = `
    <section class="screen login">
      <!-- 로고 -->
      <header class="login__brand">
        <div class="logo-dots"><span></span><span></span><span></span></div>
        <h1 class="login__title">Sea-Pulse</h1>
        <p class="login__subtitle">어획량 · 가격 예측 어플</p>
      </header>

      <!-- 이메일 -->
      <label class="field">
        <span class="field__label">이메일</span>
        <input class="input" type="email" placeholder="name@example.com" />
      </label>

      <!-- 비밀번호 -->
      <label class="field">
        <span class="field__label">비밀번호</span>
        <input class="input" type="password" placeholder="••••••••" />
      </label>

      <!-- 로그인 상태 유지 -->
      <label class="check">
        <input type="checkbox" checked />
        <span>로그인 상태 유지</span>
      </label>

      <!-- 버튼 -->
      <button class="btn btn--primary" id="loginBtn">로그인</button>
      <button class="btn btn--ghost" data-nav="/signup/logistics">회원가입</button>

      <p class="textlink" data-toast="임시 화면 · 비밀번호 재설정은 준비 중이에요">비밀번호를 잊으셨나요?</p>
    </section>
  `;

  // 로그인 → 역할 선택 모달 → 해당 홈으로
  root.querySelector('#loginBtn').addEventListener('click', openRoleModal);
  wire(root);
}
