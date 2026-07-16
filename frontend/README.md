# Sea-Pulse Frontend

어획량·가격 예측 앱 프로토타입 — **순수 HTML / CSS / JS + Node.js**(의존성 0, 빌드 없음).

## 실행

```bash
cd frontend
node server.js      # 또는  npm run dev
```

터미널에 `🌊 Sea-Pulse ▶ http://localhost:3000` 이 뜨면 브라우저에서 열면 됩니다.

## 구조

```
frontend/
├── index.html          폰 프레임 진입점
├── server.js           의존성 0 정적 서버 (node server.js)
├── css/
│   ├── tokens.css      디자인 토큰(다크/라이트 CSS 변수)
│   ├── global.css      리셋 + 폰 프레임
│   └── components.css   공용 컴포넌트 스타일
├── js/
│   ├── main.js         진입점(라우트 등록)
│   ├── router.js       해시 라우터 (#/login 등)
│   ├── state.js        세션 상태(닉네임·지역·저장예측)
│   ├── theme.js        다크/라이트 테마
│   ├── icons.js        커스텀 SVG 아이콘
│   ├── components.js   배지·탭바·카드·모달 등 공용 조각
│   └── pages/          19개 화면 렌더 함수
└── data/mock.js        더미 데이터(항구 비중·단가·시나리오·KPI)
```

## 화면 (19개)
로그인 · 회원가입(물류/어업인/관리자) · 홈(역할별·시나리오 전환) · 주간 해양 날씨 ·
설정 · 프로필/비밀번호/활동지역/알림/회원탈퇴 · 저장한 예측 · 리포트 생성

## 데이터 연동 (TODO)
현재 KPI·예측값은 `data/mock.js`의 더미 값입니다. 백엔드(`../outputs/*.csv`,
`../src` 예측 결과)와 연동 시 이 mock 을 실제 API/데이터로 교체하면 됩니다.
