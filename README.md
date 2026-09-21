# RUN INTEL — 개인용 러닝 환경 인텔리전스 & 페이스 계산기

**RUN INTEL**은 러너가 매일 접속하여 *"지금 뛰어도 괜찮은가?"*, *"오늘 몇 시에 뛰는 것이 가장 좋은가?"*, *"목표 기록을 달성하려면 몇 분/km 페이스로 달려야 하는가?"*에 즉각적인 해답을 얻을 수 있도록 설계된 **Weather + Running Intelligence + Pace Calculator** 대시보드입니다.

별도의 백엔드 서버나 빌드(Build) 과정 없이 **순수 HTML5 / CSS3 / Vanilla JavaScript**로 구현되어 있어 GitHub 저장소에 푸시하는 즉시 **GitHub Pages**를 통해 호스팅 및 PWA로 구동됩니다.

---

## 1. 주요 기능

1. **RUN NOW? (즉각 의사결정 카드)**
   * 현재 기온, 체감온도, 습도뿐만 아니라 러너의 체온 조절에 결정적인 **이슬점(Dew Point)**을 종합하여 0~100점의 **Running Score** 산출
   * 오늘 최고 점수 및 골든 타임(BEST TIME)과 실시간 비교 안내
2. **오늘 BEST TIME TOP 3**
   * 단일 시간대가 아닌 실제 러닝이 가능한 연속 2시간 블록(예: 19:00~21:00)을 우선 분석하여 상위 3개 추천
3. **상세 기상 및 대기질 그리드**
   * 기온, 체감온도, 상대습도, 이슬점, 강수량/강수확률, 풍속/풍향/돌풍
   * 초미세먼지(PM2.5), 미세먼지(PM10), 유럽 AQI, 자외선(UV), 일출/일몰 남은 시간
4. **시간대별 러닝 스코어 그래프 (Chart.js)**
   * 오늘 및 내일 24시간 추이 선그래프 제공 및 지점 클릭 시 해당 시간대 세부 기상 지표 확인
5. **오늘 vs 내일 기상 비교**
   * 기온 차이, 강수 확률 차이, 스코어 우위를 분석하여 데이터 기반 코멘트 자동 생성
6. **주간 7일 러닝 날씨 예보**
   * 요일별 대표 러닝 스코어 산출 및 가장 뛰기 좋은 날에 `★ BEST DAY` 배지 부여
7. **훈련 강도별 적합도 (Workout Modes)**
   * Recovery, Easy, Long Run, Tempo, Interval, Race 6개 모드별 차등 페널티 적용 (고온/고이슬점 시 고강도 인터벌 추가 감점)
8. **룰 기반 러닝 코치 & 맞춤 복장 추천**
   * 체감 온도, 바람, 강수, 일조량에 맞춘 상의/하의/소품(바람막이, 선글라스, 장갑 등) 추천
   * 고온, 고습, 이슬점, 미세먼지, 강풍, 빙결/노면 주의보 자동 노출
9. **정밀 페이스 & 속도 계산기 (Pace Calculator)**
   * **A. 거리 + 목표 기록**: 필요 페이스(/km), 시속(km/h), 구간별 예상 시간 산출
   * **B. 페이스 입력**: 5:00/km 입력 시 시속 및 5K, 10K, 하프(21.0975km), 풀(42.195km) 완주 시간 계산
   * **C. 속도 입력**: 12.0 km/h 입력 시 페이스 및 거리별 예상 시간 실시간 환산
10. **페이스 환산표 (Pace Table)**
    * 3:30/km ~ 7:00/km 구간의 페이스별 완주 예상 기록 한눈에 확인 (5초/10초/15초 단위 조절 가능, 모바일 가로 스크롤 지원)
11. **PWA & 오프라인 대응**
    * 모바일 홈 화면 추가 지원 (`manifest.json`, `service-worker.js`)
    * 오프라인 또는 API 장애 시 LocalStorage에 저장된 최신 캐시 데이터를 표시하며 "마지막 저장 데이터" 안내 배너 출력

---

## 2. 프로젝트 파일 구조

```text
/
├── index.html                   # 메인 대시보드 웹페이지 (시맨틱 HTML5, 반응형 구조)
├── manifest.json                # PWA 설치 명세서
├── service-worker.js            # 서비스 워커 (정적 에셋 캐싱 및 네트워크 우선 처리)
├── .nojekyll                    # GitHub Pages의 Jekyll 처리 방지 파일
├── README.md                    # 프로젝트 가이드 문서
│
├── config/
│   └── running-score-config.js  # 러닝 스코어 가중치, 임계값, 거리 표준, 기본 위치 설정
│
├── css/
│   ├── styles.css               # 코어 디자인 (다크/라이트 모드, 컴포넌트, 타이포그래피)
│   └── responsive.css           # 모바일 퍼스트 반응형 레이아웃 (375px, 태블릿, 데스크톱)
│
├── js/
│   ├── utils.js                 # 시간 형식 변환, 방위각, 페이스/속도 수학 연산
│   ├── storage.js               # LocalStorage 캐시 관리 및 사용자 설정 영속화
│   ├── weather.js               # Open-Meteo 날씨 예보 및 지오코딩 API 연동
│   ├── air-quality.js           # Open-Meteo 대기질 API 연동 (오류 시 폴백 처리)
│   ├── running-score.js         # 0~100점 러닝 스코어 & 훈련 모드별 알고리즘
│   ├── running-coach.js         # 룰 기반 코칭 브리핑, 복장 및 환경 주의보 엔진
│   ├── pace-calculator.js       # 3가지 모드의 페이스 계산기 및 환산표 생성
│   ├── charts.js                # Chart.js 기반 시간대별 인터랙티브 차트
│   └── app.js                   # 전체 UI 라이프사이클 및 이벤트 오케스트레이터
│
└── assets/
    └── icons/
        ├── favicon.svg          # SVG 파비콘
        ├── icon-192.png         # PWA 192x192 아이콘
        └── icon-512.png         # PWA 512x512 아이콘
```

---

## 3. GitHub에 업로드하고 GitHub Pages 활성화하는 방법

### 1단계: GitHub 새 저장소 만들기
1. [GitHub](https://github.com/new)에 로그인하여 새 저장소를 생성합니다.
2. **Repository name**에 `run`을 입력합니다.
3. 공개 범위는 **Public**으로 설정합니다. (무료 계정 기준)
4. `Add a README file` 체크를 해제하고 **Create repository**를 클릭합니다.

### 2단계: 파일 업로드
#### 방법 A. 웹 브라우저에서 직접 업로드
1. 생성된 저장소 화면에서 **"uploading an existing file"** 링크를 클릭합니다.
2. 이 폴더 안에 있는 모든 파일과 폴더(`index.html`, `config/`, `css/`, `js/`, `assets/`, `manifest.json`, `service-worker.js`, `.nojekyll` 등)를 그대로 드래그 앤 드롭합니다.
3. 하단의 **Commit changes** 버튼을 누릅니다.

#### 방법 B. Git 명령어로 푸시
```bash
git init
git add .
git commit -m "feat: Initial release of RUN INTEL Dashboard"
git branch -M main
git remote add origin https://github.com/<사용자ID>/run.git
git push -u origin main
```

### 3단계: GitHub Pages 배포 설정
1. 저장소 상단의 **Settings** 탭을 클릭합니다.
2. 좌측 메뉴의 **Pages** 항목을 클릭합니다.
3. **Build and deployment > Source** 항목에서 **Deploy from a branch**를 선택합니다.
4. Branch를 **`main`**, 폴더를 **`/(root)`**로 지정하고 **Save**를 누릅니다.
5. 1~2분 뒤 페이지 상단에 표시되는 `https://<사용자ID>.github.io/run/` 주소로 접속하면 즉시 사이트가 열립니다.

---

## 4. 사용자 맞춤 설정 가이드

모든 핵심 설정값은 코드 곳곳에 흩어져 있지 않고 `config/running-score-config.js` 파일 하나에 모여 있습니다.

### 기본 위치 변경
사이트 최초 접속 시 표시될 기본 위치를 변경하려면 `config/running-score-config.js`를 엽니다:
```javascript
defaultLocation: {
  name: "서울 송파구",
  latitude: 37.498,
  longitude: 127.123,
  timezone: "Asia/Seoul"
}
```
*원하는 지역의 위도/경도로 수정하면 사이트 첫 로딩 시 해당 지역을 기본값으로 사용합니다.*

### Running Score 가중치 수정
각 요소의 가중치(합계 100)를 본인의 러닝 선호도에 맞춰 조절할 수 있습니다:
```javascript
weights: {
  temperature: 25, // 기온 비중
  dewPoint: 20,    // 이슬점 비중
  humidity: 15,    // 습도 비중
  rain: 15,        // 비/강수확률 비중
  wind: 10,        // 바람 비중
  airQuality: 10,  // 미세먼지 비중
  uv: 5            // 자외선 비중
}
```

### 페이스 환산표 범위 변경
페이스 표의 기본 표시 범위(기본값 3분 30초 ~ 7분 00초)를 변경하려면:
```javascript
paceTable: {
  defaultMinSeconds: 210, // 3:30 /km (초 단위: 3*60 + 30)
  defaultMaxSeconds: 420, // 7:00 /km (초 단위: 7*60 + 0)
  stepSeconds: 10         // 기본 10초 단위 간격
}
```

---

## 5. API 및 캐시 구조

* **Open-Meteo Weather API**:
  * 위도, 경도 좌표와 함께 `Asia/Seoul` 시간대로 1회 요청하여 현재 날씨, 24~48시간 시간대별 날씨, 7일 주간 예보를 일괄 수신합니다.
* **Open-Meteo Air Quality API**:
  * 초미세먼지(PM2.5), 미세먼지(PM10), 유럽 대기질 지수(AQI)를 병렬로 수신합니다. 만약 대기질 서버가 지연되거나 응답하지 않아도 날씨 대시보드는 멈추지 않고 정상 작동합니다.
* **스마트 캐싱 (LocalStorage)**:
  * 1회 호출된 기상 데이터는 20분간 브라우저 LocalStorage에 안전하게 저장됩니다.
  * 20분 이내 재방문 시 불필요한 네트워크 트래픽을 유발하지 않고 즉시 화면을 띄우며, 우측 상단의 🔄 새로고침 버튼을 누르면 캐시를 즉시 비우고 최신 데이터를 갱신합니다.

---

## 6. 문제 발생 시 확인 사항

1. **지도가 뜨지 않거나 기상이 안 불러와질 때**:
   * 브라우저 콘솔(F12)을 확인하세요.
   * 브라우저 위치 권한을 거부했더라도 기본 위치(서울 송파구)로 동작해야 합니다. 상단 📍 위치 뱃지를 눌러 지역 검색을 직접 실행해 보세요.
2. **GitHub Pages에서 404가 발생할 때**:
   * 저장소 루트에 `.nojekyll` 파일이 포함되어 있는지 확인하세요.
   * `Settings > Pages`에서 Branch가 `main`, Folder가 `/(root)`로 정확히 선택되어 있는지 확인하세요.
3. **PWA 업데이트가 즉시 반영되지 않을 때**:
   * 서비스 워커가 이전 캐시를 유지하고 있을 수 있으므로 브라우저에서 `Ctrl + Shift + R` (Mac은 `Cmd + Shift + R`)을 눌러 강력 새로고침을 실행하세요.
