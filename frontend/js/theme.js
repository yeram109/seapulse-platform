// theme.js — 다크/라이트 테마 전환
// <html data-theme="dark|light"> 를 바꾸고 localStorage 에 기억한다.
// (설정 화면의 테마 토글이 여기 setTheme/toggleTheme 를 호출할 예정)

const KEY = 'sea-pulse-theme';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(KEY, theme);
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

// 앱 시작 시 저장된 테마 적용 (없으면 다크가 기본)
export function initTheme() {
  setTheme(localStorage.getItem(KEY) || 'dark');
}
