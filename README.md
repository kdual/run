# RUNWISE — Running Dashboard

Open‑Meteo의 실시간·예보 데이터를 이용해 러닝 환경을 분석하고, 목표 기록에 필요한 페이스와 속도를 계산하는 정적 웹사이트입니다. 개인 PB나 대회 기록은 저장하지 않습니다.

## 주요 기능

- 현재·오늘·내일·7일 Running Score(0–100)
- 시간대별 점수, 오늘의 추천 시간 TOP 3, 훈련 종류별 적합도
- 규칙 기반 러닝 코치, 복장 및 환경 주의사항
- 브라우저 현재 위치 및 Open‑Meteo 지역 검색
- 거리+목표 기록, 페이스, 속도 기준 계산과 페이스 표
- 모바일 반응형 UI, 다크 모드, 20분 로컬 캐시, PWA
- 날씨 API가 실패해도 마지막 저장 데이터 사용, 대기질만 실패하면 나머지 기능 유지

## 파일 구조

```text
run/
├─ index.html
├─ styles.css / responsive.css
├─ app.js 외 모듈       # API, 점수, 코치, 계산기, 차트, 저장소
├─ running-score-config.js
├─ icon.svg / PNG       # 앱 아이콘
├─ manifest.json
├─ service-worker.js
└─ .nojekyll
```

## GitHub 업로드 및 Pages 활성화

사용자 사이트 저장소가 `kdual.github.io`라면 이 `run` 폴더 전체를 저장소 루트의 `run/`에 올립니다. 저장소의 **Settings → Pages**에서 **Deploy from a branch**, `main` / `(root)`를 선택하면 `https://kdual.github.io/run/`에서 열립니다. 기존 Pages 설정이 이미 켜져 있으면 `main` 반영 후 자동 배포됩니다.

로컬 테스트는 저장소 루트에서 아래처럼 정적 서버를 실행합니다.

```bash
python -m http.server 8000
```

그 후 `http://localhost:8000/run/`을 엽니다. ES Module과 Service Worker 때문에 `index.html`을 파일로 직접 열지 마세요.

## 설정 변경

`running-score-config.js`에서 다음을 조정할 수 있습니다.

- `defaultLocation`: 첫 접속 기본 지역과 좌표
- `cacheMinutes`: API 캐시 시간
- `runningHours`: 추천 시간 탐색 범위
- `weights`: 기온, 이슬점, 습도, 비, 바람, 대기질, UV 가중치
- `paceTable`: 페이스 표 기본 범위
- `distances`: 계산기 거리(하프 21.0975 km, 마라톤 42.195 km)

Running Score는 환경 참고지수이며 의학적 안전 판정이 아닙니다. 점수 계산식은 `running-score.js`, 문장 규칙은 `running-coach.js`, 페이스 계산은 `pace-calculator.js`에서 확장합니다.

## 데이터와 캐시 구조

날씨는 Open‑Meteo Forecast API, 대기질은 Open‑Meteo Air Quality API(CAMS 기반)를 사용합니다. API 키나 Secret은 필요하지 않습니다. 선택 위치, 테마, 최근 응답만 브라우저 LocalStorage에 저장합니다. Service Worker는 정적 파일만 캐시하며 Open‑Meteo 응답은 가로채지 않습니다. 오프라인 또는 갱신 실패 시 화면에 저장 데이터임을 명시합니다.

## 문제 해결

- 지역 검색이 안 되면 인터넷 연결과 Open‑Meteo 접속 여부를 확인합니다.
- 위치 권한이 거부되어도 검색 또는 기본 위치로 정상 작동합니다.
- 배포 직후 이전 화면이 보이면 브라우저 새로고침 또는 사이트 데이터 삭제 후 다시 엽니다.
- Pages에서 404가 나오면 `run/index.html` 경로와 Pages 배포 브랜치를 확인합니다.
- 대기질만 비어 있으면 Air Quality API 일시 오류일 수 있으며 날씨 점수는 대기질 항목을 제외하고 계산됩니다.

## 향후 확장 위치

Garmin CSV, 주간 거리, 신발 마일리지, 훈련 부하 등은 별도 모듈로 저장소 루트에 추가하고 `app.js`에서 연결할 수 있습니다. 외부 인증 토큰은 GitHub Pages 프런트엔드 코드에 넣지 마세요.

## 출처

Weather data: [Open‑Meteo](https://open-meteo.com/) · Air quality data: Open‑Meteo / CAMS
