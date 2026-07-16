// js/icons.js — 앱 전용 커스텀 SVG 아이콘 세트
// 전부 24x24 뷰박스 · 선(stroke) 스타일 · currentColor 상속(활성 탭이면 시안색 등 자동).
// 사용: icon('home')  또는  icon('bell', 22)

const P = {
  // 하단 탭바
  home:     '<path d="M3 10.2 12 3l9 7.2"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  waves:    '<path d="M2 7c1.3 0 1.3 1.2 2.6 1.2S6 7 7.3 7s1.3 1.2 2.7 1.2S11.3 7 12.6 7 14 8.2 15.3 8.2 16.7 7 18 7s1.3 1.2 2.6 1.2"/><path d="M2 12c1.3 0 1.3 1.2 2.6 1.2S6 12 7.3 12s1.3 1.2 2.7 1.2S11.3 12 12.6 12 14 13.2 15.3 13.2 16.7 12 18 12s1.3 1.2 2.6 1.2"/><path d="M2 17c1.3 0 1.3 1.2 2.6 1.2S6 17 7.3 17s1.3 1.2 2.7 1.2S11.3 17 12.6 17 14 18.2 15.3 18.2 16.7 17 18 17s1.3 1.2 2.6 1.2"/>',
  gear:     '<circle cx="12" cy="12" r="3"/><path d="M12 2.5l1.4 2.3 2.6-.6.5 2.6 2.5 1-.8 2.5 1.7 2-1.9 1.8.6 2.6-2.6.6-.8 2.5-2.6-.7-1.8 2-1.8-2-2.6.7-.8-2.5-2.6-.6.6-2.6L2 15.4l1.7-2-.8-2.5 2.5-1 .5-2.6 2.6.6z"/>',
  users:    '<circle cx="9" cy="8" r="3.4"/><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6"/><path d="M17 14.2A5 5 0 0 1 21 19v1"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',

  // 지역 · 어종
  pin:      '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  fish:     '<path d="M3 12c3-5 8-6.5 12-6.5 3.6 0 6 2.6 6 6.5s-2.4 6.5-6 6.5C11 18.5 6 17 3 12z"/><path d="M3 12c-.6 1.2-.6 3 0 4.2M3 12c-.6-1.2-.6-3 0-4.2"/><circle cx="16.5" cy="10.5" r=".9" fill="currentColor" stroke="none"/>',

  // 설정 리스트 · 알림
  user:     '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20v-.5a6 6 0 0 1 6-6h3a6 6 0 0 1 6 6v.5"/>',
  lock:     '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  bookmark: '<path d="M7 3h10a1 1 0 0 1 1 1v17l-6-3.6L6 21V4a1 1 0 0 1 1-1z"/>',
  file:     '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  bell:     '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  palette:  '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.3-.9-.5-1.2-.2-.3-.4-.6-.4-1 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-4.4-4-7.7-9-7.7z"/><circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/><circle cx="16.3" cy="11" r="1" fill="currentColor" stroke="none"/>',
  info:     '<circle cx="12" cy="12" r="9"/><path d="M12 16.5v-5"/><path d="M12 8h.01"/>',
  box:      '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  megaphone:'<path d="M4 10v4a1 1 0 0 0 1 1h3l5 4V5L9 9H5a1 1 0 0 0-1 1z"/><path d="M17 8.5a4 4 0 0 1 0 7"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9.5h16"/><path d="M8.5 3v4"/><path d="M15.5 3v4"/>',
  shield:   '<path d="M12 3l8 3v5.5c0 5-3.4 8.2-8 9.5-4.6-1.3-8-4.5-8-9.5V6z"/><path d="M9 12l2 2 4-4"/>',

  // 날씨 지표
  thermometer: '<path d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0z"/>',
  wind:        '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7a3 3 0 1 1-3 3"/>',

  // 테마 · 상태 · 기타
  moon:    '<path d="M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9z"/>',
  sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2 12h2M20 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4"/>',
  warning: '<path d="M12 3.5 2.5 20.5h19z"/><path d="M12 10v4"/><path d="M12 17.5h.01"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4-4"/>',
  clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  check:   '<path d="M20 6 9 17l-5-5"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',

  // 리포트 항목
  chart:   '<path d="M4 20V11"/><path d="M10 20V4"/><path d="M16 20v-6"/><path d="M3 20.5h18"/>',
  trend:   '<path d="M3 16l6-6 4 4 8-8"/><path d="M15 6h6v6"/>',
};

export function icon(name, size = 18) {
  const body = P[name] || P.info;
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
