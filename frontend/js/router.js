// router.js — 해시(#) 기반 화면 전환 (SPA)
// "경로 → 렌더 함수" 를 표에 등록해두고,
// 주소창의 # 뒤 값이 바뀌면 해당 화면을 #app 안에 다시 그린다.

const routes = new Map();
let fallbackPath = '/login';

/** 라우트 등록: registerRoute('/login', renderLogin) */
export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

/** 코드에서 화면 이동: navigate('/home') */
export function navigate(path) {
  if (location.hash === '#' + path) renderCurrent(); // 같은 경로면 강제로 다시 그림
  else location.hash = path;                          // 다르면 hashchange 이벤트가 렌더 트리거
}

// 렌더가 async 라서, 느린 화면의 응답이 늦게 도착해 다음 화면을 덮어쓸 수 있다.
// 렌더마다 번호를 매겨서 "가장 최근 렌더"만 DOM 에 쓰도록 한다.
let renderToken = 0;

/** 지금 이 렌더가 아직 유효한지 (화면을 그려도 되는지) */
export function isStale(token) {
  return token !== renderToken;
}

/** 현재 해시에 맞는 화면을 그린다 */
async function renderCurrent() {
  const path = location.hash.slice(1) || fallbackPath;   // '#/login' → '/login'
  const render = routes.get(path) || routes.get(fallbackPath);
  const root = document.getElementById('app');
  const token = ++renderToken;

  root.innerHTML = '';   // 이전 화면 지우기
  await render(root, token);   // 새 화면 그리기 (async 렌더면 기다린다)
  if (isStale(token)) return;  // 그 사이 다른 화면으로 넘어갔으면 스크롤 건드리지 않음
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
