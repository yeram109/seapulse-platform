// pages/splash.js — 00 시작 스플래시
// 로고(동그라미 3개가 데이터처럼 하나씩 → 셋 다 보이며 반복) + 이름 + 예측 신뢰 안내.
// 잠깐 보여준 뒤 로그인으로 넘어간다.

import { navigate, isStale } from '../router.js';

export function renderSplash(root, token) {
  root.innerHTML = `
    <section class="splash">
      <div class="logo-dots logo-dots--splash" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1 class="splash__name">Sea-Pulse</h1>
      <p class="splash__note">이 앱의 예측은 AI가 계산한 추정치예요.<br>100% 정확하지는 않으니 참고용으로만 봐주세요.</p>
    </section>
  `;
  // 로고 애니메이션을 잠깐 보여준 뒤 로그인으로 (그 사이 이동했으면 취소)
  setTimeout(() => { if (!isStale(token)) navigate('/login'); }, 2600);
}
