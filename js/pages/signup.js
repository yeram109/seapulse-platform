// pages/signup.js — 02·03·04 회원가입 (물류/어업인/관리자)
// 입력한 이름·닉네임·이메일·지역이 그대로 내 세션이 된다 (고정 아님).

import { navigate } from '../router.js';
import { startSession } from '../state.js';
import { roleMeta, regions } from '../../data/mock.js';
import { regionsSync } from '../api.js';
import { wire } from '../components.js';

export function renderSignup(role) {
  return function (root) {
    const roleCard = (key) => {
      const m = roleMeta[key];
      return `
        <div class="role-card ${key === role ? 'is-sel' : ''}" data-nav="/signup/${key}">
          <span class="role-card__ico">${m.icon}</span>
          <span><span class="role-card__t">${m.label}</span><span class="role-card__d">${m.desc}</span></span>
        </div>`;
    };

    // 활동 지역 (관리자는 없음). 백엔드가 살아있으면 /regions 목록, 아니면 mock.
    const regionList = regionsSync().length ? regionsSync() : regions;
    const regionField = role === 'admin' ? '' : `
      <label class="field">
        <span class="field__label">활동 지역 (경남 · 위판 항구)</span>
        <select class="select" id="suRegion">
          ${regionList.map((r) => `<option ${r.name === '통영' ? 'selected' : ''}>${r.name}</option>`).join('')}
        </select>
      </label>`;

    root.innerHTML = `
      <section class="screen screen--narrow">
        <header class="navbar">
          <span class="navbar__back" data-back="/login" role="button" aria-label="뒤로">‹</span>
          <span class="navbar__title">회원가입</span>
        </header>

        <p class="note">역할을 선택하세요 · 선택한 역할의 화면만 제공됩니다</p>
        <div class="role-cards">${roleCard('logistics')}${roleCard('fisher')}${roleCard('admin')}</div>

        <label class="field field--hl">
          <span class="field__label">이름</span>
          <input class="input" id="suName" placeholder="홍길동" />
        </label>
        <label class="field field--hl">
          <span class="field__label">닉네임</span>
          <input class="input" id="suNick" placeholder="통영어부" />
        </label>
        <label class="field">
          <span class="field__label">이메일</span>
          <input class="input" id="suEmail" type="email" placeholder="name@example.com" />
        </label>
        <label class="field">
          <span class="field__label">비밀번호 (8자 이상, 영문+숫자)</span>
          <input class="input" type="password" placeholder="••••••••" />
        </label>

        ${regionField}

        <label class="terms"><input type="checkbox" checked /><span>이용약관 · 개인정보 수집에 동의합니다 (필수)</span></label>

        <button class="btn btn--primary" id="signupBtn">가입하기</button>
        <p class="note" style="text-align:center;">가입 후 ${roleMeta[role].label} 전용 화면으로 이동합니다</p>
      </section>
    `;

    // 가입하기 → 입력값으로 세션 생성 후 홈으로
    root.querySelector('#signupBtn').addEventListener('click', () => {
      const val = (id, ph) => {
        const el = root.querySelector('#' + id);
        return (el && el.value.trim()) || ph;   // 비워두면 placeholder 를 값으로
      };
      startSession(role, {
        name:     val('suName', '홍길동'),
        nickname: val('suNick', '통영어부'),
        email:    val('suEmail', 'name@example.com'),
        region:   root.querySelector('#suRegion')?.value || '통영',
      });
      navigate('/home/' + role);
    });
    wire(root);
  };
}
