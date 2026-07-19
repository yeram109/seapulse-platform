// router.js — 해시(#) 기반 화면 전환 (SPA)
// "경로 → 렌더 함수" 를 표에 등록해두고,
// 주소창의 # 뒤 값이 바뀌면 해당 화면을 #app 안에 다시 그린다.

const routes = new Map();
let fallbackPath = '/login';

// 렌더 토큰: 비동기 렌더(예: API로 화면을 나중에 채우는 경우)가 끝나기 전에
// 다른 화면으로 넘어갔는지 판단한다. 렌더할 때마다 증가시키고, 비동기 콜백은
// isStale(token) 로 자기 화면이 아직 유효한지 확인한 뒤에만 DOM을 건드린다.
let renderToken = 0;
export function isStale(token) { return token !== renderToken; }

/** 라우트 등록: registerRoute('/login', renderLogin) */
export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

/** 코드에서 화면 이동: navigate('/home') */
export function navigate(path) {
  if (location.hash === '#' + path) renderCurrent(); // 같은 경로면 강제로 다시 그림
  else location.hash = path;                          // 다르면 hashchange 이벤트가 렌더 트리거
}

/** 현재 해시에 맞는 화면을 그린다 */
function renderCurrent() {
  const path = location.hash.slice(1) || fallbackPath;   // '#/login' → '/login'
  const render = routes.get(path) || routes.get(fallbackPath);
  const root = document.getElementById('app');
  const token = ++renderToken;   // 이번 렌더의 고유 번호
  root.innerHTML = '';   // 이전 화면 지우기
  render(root, token);   // 새 화면 그리기 (async 렌더는 token 으로 staleness 확인)
  root.scrollTop = 0;    // 맨 위로
}

/** 현재 화면을 다시 그린다 (모달에서 데이터 바꾼 뒤 등) */
export function refresh() {
  renderCurrent();
}

/** 라우터 시작 (앱이 켜질 때 1번 호출) */
export function startRouter(fallback = '/login') {
  fallbackPath = fallback;
  window.addEventListener('hashchange', renderCurrent);
  renderCurrent();
}
