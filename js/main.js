// main.js — 앱 진입점
// 1) 테마 초기화  2) 모든 화면(라우트) 등록  3) 라우터 시작

import { initTheme } from './theme.js';
import { registerRoute, startRouter } from './router.js';
import { fetchRegions } from './api.js';

// 백엔드가 살아있으면 항구 목록/통계를 미리 받아 캐시(regionsSync·regionMetaSync용).
// 실패해도(서버 꺼짐) 무시 — 각 화면이 mock으로 동작한다.
fetchRegions().catch(() => {});

import { renderSplash } from './pages/splash.js';
import { renderLogin } from './pages/login.js';
import { renderSignup } from './pages/signup.js';
import { renderHomeLogistics, renderHomeFisher } from './pages/home.js';
import { renderHomeAdmin, renderAdminUsers, renderAdminData } from './pages/admin.js';
import { renderWeather } from './pages/weather.js';
import { renderSettings } from './pages/settings.js';
import { renderProfile } from './pages/profile.js';
import { renderPassword } from './pages/password.js';
import { renderRegion } from './pages/region.js';
import { renderNotifications } from './pages/notifications.js';
import { renderWithdraw } from './pages/withdraw.js';
import { renderSavedPredictions } from './pages/savedPredictions.js';
import { renderReportCreate } from './pages/reportCreate.js';

initTheme();

// 00 시작 스플래시 (로고 애니메이션 → 로그인)
registerRoute('/splash', renderSplash);

// 01 로그인
registerRoute('/login', renderLogin);

// 02~04 회원가입 (역할별)
registerRoute('/signup/logistics', renderSignup('logistics'));
registerRoute('/signup/fisher',    renderSignup('fisher'));
registerRoute('/signup/admin',     renderSignup('admin'));

// 05~07 홈 (역할별)
registerRoute('/home/logistics', renderHomeLogistics);
registerRoute('/home/fisher',    renderHomeFisher);
registerRoute('/home/admin',     renderHomeAdmin);
registerRoute('/admin/users',    renderAdminUsers);
registerRoute('/admin/data',     renderAdminData);

// 08 날씨
registerRoute('/weather', renderWeather);

// 09 설정 + 10~17 하위 화면
registerRoute('/settings',               renderSettings);
registerRoute('/settings/profile',       renderProfile);
registerRoute('/settings/password',      renderPassword);
registerRoute('/settings/region',        renderRegion);
registerRoute('/settings/notifications', renderNotifications);
registerRoute('/settings/withdraw',      renderWithdraw);
registerRoute('/settings/saved',         renderSavedPredictions);
registerRoute('/settings/report',        renderReportCreate);

// 첫 진입은 스플래시(딥링크로 들어온 경우엔 그 화면 그대로). 없는 경로 폴백은 로그인.
if (!location.hash || location.hash === '#' || location.hash === '#/') location.hash = '/splash';
startRouter('/login');
