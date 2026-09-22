# RUNWISE — Running Dashboard

기상청·에어코리아 데이터를 이용해 국내 러닝 환경을 분석하고, 목표 기록에 필요한 페이스와 속도를 계산하는 정적 웹사이트입니다. 기상청 생활기상지수의 UV·대기정체지수도 3시간 단위로 함께 표시합니다. 주소와 장소 검색은 카카오맵을 사용하며 개인 PB나 대회 기록은 저장하지 않습니다.

## 주요 기능

- 현재·오늘·내일 Running Score와 단기예보 범위 내 주간 점수(0–100)
- 시간대별 점수, 오늘의 추천 시간 TOP 3, 훈련 종류별 적합도
- 규칙 기반 러닝 코치, 복장 및 환경 주의사항
- 브라우저 현재 위치 및 카카오 국내 주소·장소 검색과 지도 확인
- 페이스·속도 기준 계산과 페이스 표
- 모바일 반응형 UI, 다크 모드, 20분 로컬 캐시, PWA
- 날씨 API가 실패해도 마지막 저장 데이터 사용, 대기질만 실패하면 나머지 기능 유지

## 파일 구조

```text
run/
├─ index.html
├─ styles.css / responsive.css
├─ app.js 외 모듈       # API, 점수, 코치, 계산기, 차트, 저장소
├─ cloudflare-worker.js  # 기상청·에어코리아 보안 중계 API
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
- `apiBaseUrl`: 배포한 Cloudflare Worker 주소
- `cacheMinutes`: API 캐시 시간
- `runningHours`: 추천 시간 탐색 범위
- `weights`: 기온, 이슬점, 습도, 비, 바람, 대기질, UV 가중치
- `paceTable`: 페이스 표 기본 범위
- `distances`: 계산기 거리(하프 21.0975 km, 마라톤 42.195 km)

Running Score는 환경 참고지수이며 의학적 안전 판정이 아닙니다. 점수 계산식은 `running-score.js`, 문장 규칙은 `running-coach.js`, 페이스 계산은 `pace-calculator.js`에서 확장합니다.

## 데이터와 배포 구조

날씨는 기상청 초단기실황·단기예보, UV·대기정체지수는 기상청 생활기상지수 조회서비스(4.0)의 V5 엔드포인트, 대기질은 에어코리아 측정소 실측·예보를 사용합니다. 공공데이터 인증키는 브라우저나 GitHub 저장소에 두지 않고 Cloudflare Worker의 `DATA_GO_KR_SERVICE_KEY` Secret에 저장합니다. Worker에는 `ALLOWED_ORIGIN=https://kdual.github.io` 변수도 필요합니다. 생활기상지수는 카카오 주소검색에서 얻은 10자리 법정동코드(`areaNo`)로 조회합니다.

Cloudflare 대시보드의 Worker 편집기에 `cloudflare-worker.js` 내용을 반영하고 배포한 뒤, `running-score-config.js`의 `apiBaseUrl`을 해당 Worker 주소로 설정합니다. 카카오 JavaScript 키에는 `https://kdual.github.io` 도메인을 등록해야 합니다.

선택 위치, 테마, 최근 응답만 브라우저 LocalStorage에 저장합니다. 오프라인 또는 갱신 실패 시 마지막 저장 데이터임을 화면에 명시합니다. 현재 승인된 기상청 단기예보만으로는 7일 전체를 채울 수 없으므로 범위 밖 날짜는 점수를 임의 생성하지 않고 “예보 준비 중”으로 표시합니다. 7일 전체는 기상청 중기예보 API 승인 후 확장합니다.

## 문제 해결

- 지역 검색이 안 되면 카카오 JavaScript SDK 도메인 등록과 인터넷 연결을 확인합니다.
- 날씨가 비어 있으면 Worker의 `/health`, `/weather?latitude=37.5145&longitude=127.1059&areaNo=1171000000` 응답과 Secret 설정을 확인합니다.
- 위치 권한이 거부되어도 검색 또는 기본 위치로 정상 작동합니다.
- 배포 직후 이전 화면이 보이면 브라우저 새로고침 또는 사이트 데이터 삭제 후 다시 엽니다.
- Pages에서 404가 나오면 `run/index.html` 경로와 Pages 배포 브랜치를 확인합니다.
- UV·대기정체만 비어 있으면 공공데이터포털에서 생활기상지수 조회서비스(4.0)가 승인됐는지와 `/weather` 응답의 `life_indices` 상태를 확인합니다.
- 대기질만 비어 있으면 `/air?sidoName=서울&stationName=송파구` 응답을 확인합니다. 주소의 구·군명과 일치하는 측정소가 없으면 정확성을 위해 다른 측정소를 임의 대체하지 않습니다.

## 향후 확장 위치

Garmin CSV, 주간 거리, 신발 마일리지, 훈련 부하 등은 별도 모듈로 저장소 루트에 추가하고 `app.js`에서 연결할 수 있습니다. 외부 인증 토큰은 GitHub Pages 프런트엔드 코드에 넣지 마세요.

## 출처

날씨·UV·대기정체: 기상청 · 대기질: 한국환경공단 에어코리아 · 주소·지도: 카카오맵
