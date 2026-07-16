// pages/weather.js — 08 주간 해양 날씨 (상세)

import { state, ensureSession } from '../state.js';
import { isStale } from '../router.js';
import { weatherInsight } from '../../data/mock.js';
import { navBar, tabBar, weatherCard, errorCard, wire } from '../components.js';
import { fetchWeather, regionIdOf } from '../api.js';
import { icon } from '../icons.js';

export async function renderWeather(root, token) {
  const s = ensureSession();

  root.innerHTML = `
    <section class="screen screen--tab">
      ${navBar('주간 해양 날씨', '/home/' + state.role)}
      <p class="section-sub">${s.region} 부이 · 기상청 해양기상부이</p>
      <div id="wCards"><p class="note">불러오는 중…</p></div>
      <div class="hint-card">${icon('search', 15)} ${weatherInsight}</div>
    </section>
    ${tabBar('weather')}
  `;
  wire(root);

  const slot = root.querySelector('#wCards');
  try {
    const regionId = await regionIdOf(s.region);
    if (isStale(token)) return;
    if (regionId == null) {
      slot.innerHTML = `<p class="note">${s.region}의 관측 데이터가 없어요.</p>`;
      return;
    }

    const weeks = await fetchWeather(regionId, 4);
    if (isStale(token)) return;

    slot.innerHTML =
      weeks.map((w) => weatherCard(w)).join('') +
      `<p class="note">'평년'은 예보가 아니라 같은 주차의 과거 평균입니다. 예측 모델도 이 값을 사용합니다.</p>`;
  } catch (err) {
    if (isStale(token)) return;
    slot.innerHTML = errorCard(err);
  }
}
