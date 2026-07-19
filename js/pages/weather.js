// pages/weather.js — 08 주간 해양 날씨 (상세)

import { state } from '../state.js';
import { isStale } from '../router.js';
import { weeklyWeather, weatherInsight } from '../../data/mock.js';
import { navBar, tabBar, weatherCard, wire } from '../components.js';
import { icon } from '../icons.js';
import { regionIdOf, fetchWeather, weatherToCard, weatherStatus } from '../api.js';

export function renderWeather(root, token) {
  // mock으로 먼저 그리고, 백엔드가 살아있으면 실제 관측/예측으로 교체
  const cards = weeklyWeather.map((w) => weatherCard(w)).join('');
  const region = state.session?.region ?? '통영';

  root.innerHTML = `
    <section class="screen screen--tab">
      ${navBar('주간 해양 날씨', '/home/' + state.role)}
      <p class="section-sub">${region} 부이 · 전년 동주 대비 · 기상청 해양기상부이</p>

      <div id="wCards">${cards}</div>

      <div class="hint-card">${icon('search', 15)} ${weatherInsight}</div>
    </section>
    ${tabBar('weather')}
  `;
  wire(root);

  // ── 백엔드 연동: 4주치 실제 날씨로 교체 (실패 시 mock 유지) ──
  (async () => {
    try {
      const regionId = await regionIdOf(region);
      if (isStale(token) || regionId == null) return;
      const ws = await fetchWeather(regionId, 4);
      if (isStale(token) || !Array.isArray(ws) || !ws.length) return;
      const el = root.querySelector('#wCards');
      if (el) el.innerHTML = ws.map((w) => {
        const st = weatherStatus(w);
        return weatherCard(weatherToCard(w), st.text, st.kind);
      }).join('');
    } catch { /* API 미연결 → mock 유지 */ }
  })();
}
