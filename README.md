# SeaPulse

경남 지역 삼치 어획량·가격을 예측해, **물류담당자에게는 창고 재고 관리**를, **어업인에게는 판매 타이밍**을 안내하는 서비스입니다. (아래는 예측 모델 파이프라인, 웹 화면은 [프론트엔드](#프론트엔드-웹-화면) 참고)

## 프론트엔드 (웹 화면)

물류/어업인/관리자 화면을 브라우저에서 바로 볼 수 있는 순수 HTML/CSS/JS 데모입니다.
**별도 설치(npm install)나 백엔드 없이, Node만 있으면** 실행됩니다.

### 실행 (팀원용 · 2단계)

```bash
git fetch && git checkout feat/rangkkuku   # 최신 프론트 브랜치
node server.js                             # → http://localhost:3000
```

브라우저에서 **http://localhost:3000** 접속 → 로그인 → 역할(물류/어업인/관리자) 선택.

### 주요 화면

- 어획량·가격 **4주 예측 차트** — 오늘 기준 전주~다다음주, 신뢰구간(상·하한) 표시
- 삼치 **금어기 알림**, 예측 **확실/불확실** 표기, 다크/라이트 테마(설정에서 전환)
- **관리자** — 사용자 승인(대기→활성 실시간 반영·승인 시각 기록), 데이터 파이프라인 현황
- 하단 탭바로 화면 이동 (관리자는 홈·사용자·데이터·설정)

### 팀원에게 링크로 공유 (선택)

내 PC가 켜져 있는 동안, 로컬 서버를 임시 공개 링크로 만들 수 있습니다:

```bash
node server.js                                    # 1) 서버 실행 (다른 터미널)
./cloudflared tunnel --url http://localhost:3000  # 2) 출력되는 https://xxxx.trycloudflare.com 를 공유
```

> 프론트 소스는 저장소 **root**(`js/` `css/` `index.html` `server.js`)가 정식입니다.
> `server.js`는 의존성 0인 정적 파일 서버이며, `data/mock.js`의 목업 데이터로 동작합니다(예측 파이프라인과 독립).

## 파일 구조

```
seapulse-model/
├── data/
│   ├── raw/                 # 원본 데이터 (위판·소매·해양기상)
│   ├── processed/           # 전처리/중간 산출물
│   └── seapulse_final.db    # 백엔드 DB (예측·시나리오 적재)
├── models/                  # 학습된 모델(.pkl) — 검증용(_val) / 배포용(_final)
├── outputs/                 # 예측 결과 CSV, 모델 평가지표
├── src/
│   ├── common.py                     # 항구-region_id 매핑, 모델 버전 등 공용 상수
│   ├── evaluate.py                   # MAE/RMSE, 신뢰구간, 불확실성 플래그 공용 유틸
│   ├── preprocess_daily.py           # 위판(도매) 데이터 전처리: 일별 -> 주별 집계
│   ├── preprocess_monthly.py         # 소매(노량진) 데이터 전처리: 월별 집계
│   ├── train_catch_model.py          # 어획량 예측 모델 학습
│   ├── train_wholesale_price_model.py# 도매가격 예측 모델 학습
│   ├── train_retail_price_model.py   # 소매가격 예측 모델 학습
│   ├── predict_future.py             # 배포용 모델로 미래 주차 추론
│   ├── load_to_db.py                 # 예측 결과를 DB에 적재
│   └── generate_scenarios.py         # 미래 예측을 창고뷰/어민뷰 시나리오로 변환
└── requirements.txt
```

## 파이프라인 순서

1. `preprocess_daily.py` — 위판 원본 + 해양기상 → 항구별 일/주별 집계
2. `preprocess_monthly.py` — 노량진 소매 원본 + 위판 데이터 → 월별 집계
3. `train_catch_model.py` — 어획량 예측 모델 학습 (검증용/배포용)
4. `train_wholesale_price_model.py` — 도매가격 예측 모델 학습
5. `train_retail_price_model.py` — 소매가격 예측 모델 학습
6. `predict_future.py` — 배포용 모델(`*_final.pkl`)로 아직 관측되지 않은 미래 주차 추론
7. `load_to_db.py` — 예측 결과를 `seapulse_final.db`에 적재
8. `generate_scenarios.py` — 미래 예측을 물류창고 재고관리용/어업인 판매타이밍용 시나리오로 변환해 DB에 적재

## 설치

```bash
pip install -r requirements.txt
```
