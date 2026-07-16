// main.js — 앱 진입점
// 1) 테마 초기화  2) 모든 화면(라우트) 등록  3) 라우터 시작

import { initTheme } from './theme.js';
import { registerRoute, startRouter } from './router.js';
import { fetchRegions } from './api.js';

import { renderLogin } from './pages/login.js';
import { renderSignup } from './pages/signup.js';
import { renderHomeLogistics, renderHomeFisher, renderHomeAdmin } from './pages/home.js';
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

// 항구 목록을 미리 받아둔다. 회원가입 드롭다운·지역 모달은 동기 렌더라
// 그릴 때 이미 캐시에 있어야 한다. 서버가 꺼져 있어도 앱은 떠야 하므로
// 실패는 삼키고, 그 화면들은 빈 목록으로 그려진다.
await fetchRegions().catch((e) => console.warn('[regions] 로드 실패:', e.message));

// 첫 화면은 로그인
startRouter('/login');
