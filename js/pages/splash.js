// pages/splash.js — 시작 스플래시 오버레이
// 라우팅과 무관하게, 페이지가 로드될 때 앱 위에 덮어서 보여준다.
//  · 로고: 동그라미 3개가 데이터처럼 하나씩 나와 셋 다 보이고 반복(계속)
//  · 이름 + 서비스 소개 + 예측 신뢰 안내 문구 (전부 중앙정렬)
//  · 화면을 누르면 바로 시작, 안 누르면 최대 30초 뒤 자동으로 로그인으로

export function showSplash(holdMs = 30000) {
  if (document.querySelector('.splash-overlay')) return;
  const el = document.createElement('div');
  el.className = 'splash-overlay';
  el.innerHTML = `
    <div class="splash">
      <div class="logo-dots logo-dots--splash" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1 class="splash__name">Sea-Pulse</h1>
      <p class="splash__tag">AI 어획량·가격 예측 서비스</p>
      <p class="splash__note">
        이 앱의 예측은 과거 위판·해양 데이터를 학습한 <b>AI 추정치</b>입니다.<br>
        날씨·조업·시장 상황에 따라 실제 어획량·가격과 다를 수 있으니,<br>
        <b>100% 신뢰하기보다 참고 지표</b>로만 활용해 주세요.
      </p>
      <span class="splash__hint">화면을 터치하면 시작합니다</span>
    </div>`;
  document.body.appendChild(el);

  let done = false;
  const dismiss = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    el.classList.add('is-hiding');
    setTimeout(() => el.remove(), 450);   // 페이드아웃 후 제거 → 아래의 로그인 화면이 드러남
  };
  const timer = setTimeout(dismiss, holdMs);          // 30초 후 자동으로 시작
  el.addEventListener('click', dismiss);              // 클릭/터치하면 바로 시작
  el.addEventListener('touchstart', dismiss, { passive: true });
}
