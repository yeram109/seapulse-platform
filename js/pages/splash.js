// pages/splash.js — 시작 스플래시 오버레이
// 라우팅과 무관하게, 페이지가 로드될 때 앱 위에 잠깐 덮어서 보여준다.
// (해시/캐시 상태와 상관없이 항상 뜨도록 오버레이로 구현)
//  · 로고: 동그라미 3개가 데이터처럼 하나씩 나와 셋 다 보이고 반복
//  · 이름 + 예측 신뢰 안내 문구 (전부 중앙정렬)

export function showSplash(holdMs = 2400) {
  if (document.querySelector('.splash-overlay')) return;
  const el = document.createElement('div');
  el.className = 'splash-overlay';
  el.innerHTML = `
    <div class="splash">
      <div class="logo-dots logo-dots--splash" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1 class="splash__name">Sea-Pulse</h1>
      <p class="splash__note">이 앱의 예측은 AI가 계산한 추정치예요.<br>100% 정확하지는 않으니 참고용으로만 봐주세요.</p>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-hiding');
    setTimeout(() => el.remove(), 450);   // 페이드아웃 후 제거
  }, holdMs);
}
