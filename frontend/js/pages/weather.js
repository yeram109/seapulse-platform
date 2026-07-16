// pages/weather.js — 08 주간 해양 날씨 (상세)

import { state } from '../state.js';
import { weeklyWeather, weatherInsight } from '../../data/mock.js';
import { navBar, tabBar, weatherCard, wire } from '../components.js';
import { icon } from '../icons.js';

export function renderWeather(root) {
  const cards = weeklyWeather.map((w) => weatherCard(w)).join('');

  root.innerHTML = `
    <section class="screen screen--tab">
      ${navBar('주간 해양 날씨', '/home/' + state.role)}
      <p class="section-sub">통영 부이 · 전년 동주 대비 · 기상청 해양기상부이</p>

      ${cards}

      <div class="hint-card">${icon('search', 15)} ${weatherInsight}</div>
    </section>
    ${tabBar('weather')}
  `;
  wire(root);
}
