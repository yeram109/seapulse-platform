// pages/settings.js — 09 설정 (탭 루트)

import { navigate } from '../router.js';
import { state, ensureSession, notiOnCount } from '../state.js';
import { roleMeta } from '../../data/mock.js';
import { getTheme, setTheme } from '../theme.js';
import { tabBar, roleBadge, badge, wire } from '../components.js';
import { icon } from '../icons.js';

export function renderSettings(root) {
  const s = ensureSession();
  const theme = getTheme();

  const row = (ic, label, right, nav) => `
    <div class="lrow" ${nav ? `data-nav="${nav}"` : ''}>
      <span class="lrow__ico">${icon(ic, 18)}</span>
      <span class="lrow__label">${label}</span>
      <span class="lrow__right">${right || ''}<span class="lrow__chev">›</span></span>
    </div>`;

  root.innerHTML = `
    <section class="screen screen--tab screen--narrow">
      <header class="navbar"><span class="navbar__title">설정</span></header>

      <div class="pcard">
        <div class="avatar">${icon(roleMeta[s.roleKey].icon, 26)}</div>
        <div class="pcard__info">
          <span class="pcard__name">${s.nickname}</span>
          <span class="pcard__email">${s.email}</span>
          <span class="pcard__badges">${roleBadge(s.roleKey)} ${badge('경남 ' + s.region, 'outline')}</span>
        </div>
      </div>

      <div class="lgroup">
        <div class="lgroup__title">계정</div>
        <div class="lgroup__box">
          ${row('user', '프로필 수정', '', '/settings/profile')}
          ${row('lock', '비밀번호 변경', '', '/settings/password')}
          ${row('pin', '활동 지역', s.region, '/settings/region')}
        </div>
      </div>

      <div class="lgroup">
        <div class="lgroup__title">내 예측</div>
        <div class="lgroup__box">
          ${row('bookmark', '저장한 예측', s.saved.length + '개', '/settings/saved')}
          ${row('file', '리포트', '', '/settings/report')}
          ${s.roleKey === 'logistics' ? `
          <div class="lrow lrow--static">
            <span class="lrow__ico">${icon('box', 18)}</span>
            <span class="lrow__label">창고 용량</span>
            <span class="lrow__right">
              <input id="capInput" class="cap-input" type="number" min="1" step="10"
                     value="${s.warehouseCapacityTon}" aria-label="창고 용량(톤)" /> 톤
            </span>
          </div>` : ''}
        </div>
      </div>

      <div class="lgroup">
        <div class="lgroup__title">알림</div>
        <div class="lgroup__box">
          ${row('bell', '알림 설정', notiOnCount() + '개 켜짐', '/settings/notifications')}
        </div>
      </div>

      <div class="lgroup">
        <div class="lgroup__title">앱</div>
        <div class="lgroup__box">
          <div class="lrow lrow--static">
            <span class="lrow__ico">${icon('palette', 18)}</span>
            <span class="lrow__label">테마</span>
            <span class="lrow__right">
              <span class="segment">
                <button data-theme-set="dark"  class="${theme === 'dark' ? 'is-active' : ''}">${icon('moon', 14)} 다크</button>
                <button data-theme-set="light" class="${theme === 'light' ? 'is-active' : ''}">${icon('sun', 14)} 라이트</button>
              </span>
            </span>
          </div>
          <div class="lrow lrow--static">
            <span class="lrow__ico">${icon('info', 18)}</span>
            <span class="lrow__label">버전</span>
            <span class="lrow__right">v1.3.0</span>
          </div>
          <div class="lrow" data-toast="이용약관은 준비 중이에요">
            <span class="lrow__ico">${icon('file', 18)}</span>
            <span class="lrow__label">이용약관</span>
            <span class="lrow__right"><span class="lrow__chev">›</span></span>
          </div>
        </div>
      </div>

      <div class="danger-zone">
        <div class="danger-zone__title">위험 구역</div>
        <button class="btn btn--ghost" id="logoutBtn">로그아웃</button>
        <button class="btn btn--danger" data-nav="/settings/withdraw">회원 탈퇴</button>
      </div>
    </section>
    ${tabBar('settings')}
  `;

  root.querySelectorAll('[data-theme-set]').forEach((el) =>
    el.addEventListener('click', () => { setTheme(el.dataset.themeSet); navigate('/settings'); }));

  // 창고 용량 = /predictions 의 warehouse_capacity_ton. 물류 역할에만 있다.
  root.querySelector('#capInput')?.addEventListener('change', (e) => {
    const ton = Number(e.target.value);
    if (ton > 0) s.warehouseCapacityTon = ton;
    else e.target.value = s.warehouseCapacityTon;   // 0·음수는 되돌린다
  });

  root.querySelector('#logoutBtn').addEventListener('click', () => { state.session = null; navigate('/login'); });

  wire(root);
}
