/**
 * Main Application Orchestrator for RUN INTEL Dashboard
 */
(function () {
  'use strict';

  // State
  let state = {
    location: null,
    weather: null,
    aqi: null,
    isDark: false,
    hourlyMode: 'today', // 'today' | 'tomorrow'
    paceMode: 'modeA',   // 'modeA' | 'modeB' | 'modeC'
    paceTableStep: 10
  };

  // DOM Elements Cache
  const DOM = {};

  function cacheDOMElements() {
    DOM.cacheBanner = document.getElementById('cacheBanner');
    DOM.cacheBannerText = document.getElementById('cacheBannerText');

    // Header
    DOM.currentLocationName = document.getElementById('currentLocationName');
    DOM.btnOpenLocation = document.getElementById('btnOpenLocation');
    DOM.currentDateDisplay = document.getElementById('currentDateDisplay');
    DOM.updateTimeDisplay = document.getElementById('updateTimeDisplay');
    DOM.btnRefresh = document.getElementById('btnRefresh');
    DOM.btnThemeToggle = document.getElementById('btnThemeToggle');
    DOM.themeIcon = document.getElementById('themeIcon');

    // Section 1: Run Now
    DOM.runNowCard = document.getElementById('runNowCard');
    DOM.runNowCircle = document.getElementById('runNowCircle');
    DOM.runNowScore = document.getElementById('runNowScore');
    DOM.runNowGradeBadge = document.getElementById('runNowGradeBadge');
    DOM.sunsetStatusBadge = document.getElementById('sunsetStatusBadge');
    DOM.runNowDecision = document.getElementById('runNowDecision');
    DOM.quickTemp = document.getElementById('quickTemp');
    DOM.quickApparentTemp = document.getElementById('quickApparentTemp');
    DOM.quickHumidity = document.getElementById('quickHumidity');
    DOM.quickDewPoint = document.getElementById('quickDewPoint');
    DOM.compCurrentScore = document.getElementById('compCurrentScore');
    DOM.compMaxScore = document.getElementById('compMaxScore');
    DOM.compBestTime = document.getElementById('compBestTime');

    // Section 2 & 3: Best Times & Sun
    DOM.bestTimesList = document.getElementById('bestTimesList');
    DOM.sunRemainingText = document.getElementById('sunRemainingText');
    DOM.sunriseTime = document.getElementById('sunriseTime');
    DOM.sunsetTime = document.getElementById('sunsetTime');
    DOM.nightRunNotice = document.getElementById('nightRunNotice');

    // Section 4: Current Weather Grid
    DOM.gridTemp = document.getElementById('gridTemp');
    DOM.gridApparent = document.getElementById('gridApparent');
    DOM.gridDewPoint = document.getElementById('gridDewPoint');
    DOM.gridDewPointDesc = document.getElementById('gridDewPointDesc');
    DOM.gridHumidity = document.getElementById('gridHumidity');
    DOM.gridPrecip = document.getElementById('gridPrecip');
    DOM.gridWeatherCode = document.getElementById('gridWeatherCode');
    DOM.gridWind = document.getElementById('gridWind');
    DOM.gridWindSub = document.getElementById('gridWindSub');
    DOM.gridPm25 = document.getElementById('gridPm25');
    DOM.gridPm25Grade = document.getElementById('gridPm25Grade');
    DOM.gridPm10 = document.getElementById('gridPm10');
    DOM.gridPm10Grade = document.getElementById('gridPm10Grade');
    DOM.gridUv = document.getElementById('gridUv');
    DOM.gridUvDesc = document.getElementById('gridUvDesc');

    // Section 5: Hourly Score
    DOM.btnHourlyToday = document.getElementById('btnHourlyToday');
    DOM.btnHourlyTomorrow = document.getElementById('btnHourlyTomorrow');
    DOM.hourlyChartCanvas = document.getElementById('hourlyChartCanvas');
    DOM.selectedHourDetail = document.getElementById('selectedHourDetail');
    DOM.selHourTitle = document.getElementById('selHourTitle');
    DOM.selHourBadge = document.getElementById('selHourBadge');
    DOM.selHourGrid = document.getElementById('selHourGrid');

    // Section 6 & 7: Today vs Tomorrow & Weekly
    DOM.todayAvgScore = document.getElementById('todayAvgScore');
    DOM.todayAvgGrade = document.getElementById('todayAvgGrade');
    DOM.todayCompStats = document.getElementById('todayCompStats');
    DOM.tomorrowAvgScore = document.getElementById('tomorrowAvgScore');
    DOM.tomorrowAvgGrade = document.getElementById('tomorrowAvgGrade');
    DOM.tomorrowCompStats = document.getElementById('tomorrowCompStats');
    DOM.compCommentaryText = document.getElementById('compCommentaryText');
    DOM.weeklyForecastList = document.getElementById('weeklyForecastList');

    // Section 8: Workout Modes
    DOM.workoutGrid = document.getElementById('workoutGrid');

    // Section 9 & 10: Coach & Gear
    DOM.coachMessage = document.getElementById('coachMessage');
    DOM.warningContainer = document.getElementById('warningContainer');
    DOM.gearTop = document.getElementById('gearTop');
    DOM.gearBottom = document.getElementById('gearBottom');
    DOM.gearAccessories = document.getElementById('gearAccessories');

    // Section 11: Pace Calculator
    DOM.tabModeA = document.getElementById('tabModeA');
    DOM.tabModeB = document.getElementById('tabModeB');
    DOM.tabModeC = document.getElementById('tabModeC');
    DOM.panelModeA = document.getElementById('panelModeA');
    DOM.panelModeB = document.getElementById('panelModeB');
    DOM.panelModeC = document.getElementById('panelModeC');
    DOM.selectDistanceA = document.getElementById('selectDistanceA');
    DOM.customDistGroupA = document.getElementById('customDistGroupA');
    DOM.inputCustomDistA = document.getElementById('inputCustomDistA');
    DOM.timeHoursA = document.getElementById('timeHoursA');
    DOM.timeMinutesA = document.getElementById('timeMinutesA');
    DOM.timeSecondsA = document.getElementById('timeSecondsA');
    DOM.paceMinB = document.getElementById('paceMinB');
    DOM.paceSecB = document.getElementById('paceSecB');
    DOM.speedInputC = document.getElementById('speedInputC');
    DOM.calcResultPace = document.getElementById('calcResultPace');
    DOM.calcResultSpeed = document.getElementById('calcResultSpeed');
    DOM.calcSplitsGrid = document.getElementById('calcSplitsGrid');

    // Section 12: Pace Table
    DOM.tableStepSelect = document.getElementById('tableStepSelect');
    DOM.paceTableBody = document.getElementById('paceTableBody');

    // Location Modal
    DOM.locationModal = document.getElementById('locationModal');
    DOM.btnCloseLocationModal = document.getElementById('btnCloseLocationModal');
    DOM.btnUseGeolocation = document.getElementById('btnUseGeolocation');
    DOM.inputLocationSearch = document.getElementById('inputLocationSearch');
    DOM.btnSearchLocation = document.getElementById('btnSearchLocation');
    DOM.locationSearchResults = document.getElementById('locationSearchResults');
  }

  // Initialization
  async function init() {
    cacheDOMElements();

    // 1. Setup Theme (Dark / Light)
    state.isDark = RunStorage.getDarkMode();
    applyTheme(state.isDark);

    // 2. Setup Location
    state.location = RunStorage.getLocation();
    DOM.currentLocationName.textContent = state.location.name;

    // 3. Update Date / Time Display
    updateDateTime();
    setInterval(updateDateTime, 30000); // 30초마다 시간 갱신

    // 4. Attach Event Listeners
    setupEventListeners();

    // 5. Initialize Pace Table & Calculator Defaults
    updatePaceCalculator();
    renderPaceTable();

    // 6. Fetch Weather & Air Quality Data
    await loadDashboardData(false);
  }

  function applyTheme(isDark) {
    state.isDark = isDark;
    RunStorage.setDarkMode(isDark);
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      DOM.themeIcon.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      DOM.themeIcon.textContent = '🌙';
    }
    RunCharts.updateTheme(isDark);
  }

  function updateDateTime() {
    const now = new Date();
    DOM.currentDateDisplay.textContent = RunUtils.formatDateFull(now);
  }

  function setupEventListeners() {
    // Refresh Button
    DOM.btnRefresh.addEventListener('click', async () => {
      DOM.btnRefresh.style.transform = 'rotate(180deg)';
      DOM.btnRefresh.style.transition = 'transform 0.4s ease';
      await loadDashboardData(true);
      setTimeout(() => {
        DOM.btnRefresh.style.transform = 'none';
      }, 400);
    });

    // Dark Mode Toggle
    DOM.btnThemeToggle.addEventListener('click', () => {
      applyTheme(!state.isDark);
    });

    // Location Modal
    DOM.btnOpenLocation.addEventListener('click', () => {
      DOM.locationModal.showModal();
      DOM.inputLocationSearch.focus();
    });

    DOM.btnCloseLocationModal.addEventListener('click', () => {
      DOM.locationModal.close();
    });

    DOM.locationModal.addEventListener('click', (e) => {
      if (e.target === DOM.locationModal) DOM.locationModal.close();
    });

    // Geolocation
    DOM.btnUseGeolocation.addEventListener('click', handleGeolocation);

    // Location Search
    DOM.btnSearchLocation.addEventListener('click', performLocationSearch);
    DOM.inputLocationSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performLocationSearch();
    });

    // Hourly Tabs
    DOM.btnHourlyToday.addEventListener('click', () => {
      state.hourlyMode = 'today';
      DOM.btnHourlyToday.classList.add('active');
      DOM.btnHourlyToday.setAttribute('aria-selected', 'true');
      DOM.btnHourlyTomorrow.classList.remove('active');
      DOM.btnHourlyTomorrow.setAttribute('aria-selected', 'false');
      renderHourlySection();
    });

    DOM.btnHourlyTomorrow.addEventListener('click', () => {
      state.hourlyMode = 'tomorrow';
      DOM.btnHourlyTomorrow.classList.add('active');
      DOM.btnHourlyTomorrow.setAttribute('aria-selected', 'true');
      DOM.btnHourlyToday.classList.remove('active');
      DOM.btnHourlyToday.setAttribute('aria-selected', 'false');
      renderHourlySection();
    });

    // Pace Tabs
    DOM.tabModeA.addEventListener('click', () => switchPaceMode('modeA'));
    DOM.tabModeB.addEventListener('click', () => switchPaceMode('modeB'));
    DOM.tabModeC.addEventListener('click', () => switchPaceMode('modeC'));

    // Pace Inputs
    DOM.selectDistanceA.addEventListener('change', (e) => {
      DOM.customDistGroupA.style.display = e.target.value === 'custom' ? 'block' : 'none';
      updatePaceCalculator();
    });
    DOM.inputCustomDistA.addEventListener('input', updatePaceCalculator);
    DOM.timeHoursA.addEventListener('input', updatePaceCalculator);
    DOM.timeMinutesA.addEventListener('input', updatePaceCalculator);
    DOM.timeSecondsA.addEventListener('input', updatePaceCalculator);

    DOM.paceMinB.addEventListener('input', updatePaceCalculator);
    DOM.paceSecB.addEventListener('input', updatePaceCalculator);

    DOM.speedInputC.addEventListener('input', updatePaceCalculator);

    // Pace Table Filter
    DOM.tableStepSelect.addEventListener('change', (e) => {
      state.paceTableStep = parseInt(e.target.value, 10) || 10;
      renderPaceTable();
    });
  }

  // Load All Weather and AQI Data
  async function loadDashboardData(forceRefresh = false) {
    const lat = state.location.latitude;
    const lon = state.location.longitude;

    try {
      // Parallel API calls with fault-tolerant individual handling
      const [weatherRes, aqiRes] = await Promise.all([
        WeatherService.fetchWeather(lat, lon, forceRefresh),
        AirQualityService.fetchAirQuality(lat, lon, forceRefresh)
      ]);

      state.weather = weatherRes.data;
      state.aqi = aqiRes.data;

      // Handle Stale / Offline Banner
      if (weatherRes.source === 'stale-cache' || aqiRes.source === 'stale-cache' || !navigator.onLine) {
        DOM.cacheBanner.classList.remove('hidden');
        const updateDate = new Date(weatherRes.timestamp);
        DOM.cacheBannerText.textContent = `오프라인 모드: 마지막 저장된 데이터 (${RunUtils.formatTimeHHmm(updateDate)})를 표시 중입니다.`;
      } else {
        DOM.cacheBanner.classList.add('hidden');
      }

      // Update Header Time
      const updateDate = new Date(weatherRes.timestamp);
      DOM.updateTimeDisplay.textContent = `업데이트: ${RunUtils.formatTimeHHmm(updateDate)}`;

      // Calculate Running Scores across Hourly Data
      enrichHourlyWithRunningScores();

      // Render Dashboard Components
      renderDashboard();
    } catch (err) {
      console.error("Dashboard data load error:", err);
      DOM.runNowDecision.textContent = "날씨 데이터를 불러오는데 실패했습니다. 인터넷 연결 및 위치를 확인해 주세요.";
      DOM.cacheBanner.classList.remove('hidden');
      DOM.cacheBannerText.textContent = "날씨 API 연결 오류: 일시적으로 데이터를 수신할 수 없습니다.";
    }
  }

  // Enrich Hourly Data with calculated Running Scores & AQI
  function enrichHourlyWithRunningScores() {
    if (!state.weather || !state.weather.hourly) return;

    const hourlyAqiMap = {};
    if (state.aqi && state.aqi.hourly) {
      state.aqi.hourly.forEach(a => {
        hourlyAqiMap[a.timeString] = a;
      });
    }

    const curAqi = (state.aqi && state.aqi.current) || {};

    // Current weather enrichment
    state.weather.current.pm25 = curAqi.pm25 !== undefined ? curAqi.pm25 : null;
    state.weather.current.pm10 = curAqi.pm10 !== undefined ? curAqi.pm10 : null;
    state.weather.current.aqi = curAqi.aqi !== undefined ? curAqi.aqi : null;
    state.weather.current.runningScore = RunningScoreEngine.calculateScore(state.weather.current);

    // Hourly weather enrichment
    state.weather.hourly.forEach(h => {
      const matchedAqi = hourlyAqiMap[h.timeString];
      h.pm25 = matchedAqi ? matchedAqi.pm25 : curAqi.pm25;
      h.pm10 = matchedAqi ? matchedAqi.pm10 : curAqi.pm10;
      h.aqi = matchedAqi ? matchedAqi.aqi : curAqi.aqi;
      h.runningScore = RunningScoreEngine.calculateScore(h);
    });
  }

  // Master Render Function
  function renderDashboard() {
    renderRunNow();
    renderBestTimesAndSun();
    renderWeatherGrid();
    renderHourlySection();
    renderTodayVsTomorrow();
    renderWeeklyForecast();
    renderWorkouts();
    renderCoachAndGear();
  }

  // 1. Render RUN NOW Card
  function renderRunNow() {
    const cur = state.weather.current;
    const scoreObj = cur.runningScore;

    DOM.runNowScore.textContent = scoreObj.totalScore;
    DOM.runNowScore.style.color = scoreObj.grade.color;
    DOM.runNowCircle.style.borderColor = scoreObj.grade.color;
    DOM.runNowCard.style.borderLeftColor = scoreObj.grade.color;

    DOM.runNowGradeBadge.textContent = scoreObj.grade.label;
    DOM.runNowGradeBadge.style.backgroundColor = scoreObj.grade.color;

    // Quick Stats
    DOM.quickTemp.textContent = `${RunUtils.formatNumber(cur.temperature, 1)}°C`;
    DOM.quickApparentTemp.textContent = `${RunUtils.formatNumber(cur.apparentTemperature, 1)}°C`;
    DOM.quickHumidity.textContent = `${cur.humidity}%`;
    DOM.quickDewPoint.textContent = `${RunUtils.formatNumber(cur.dewPoint, 1)}°C`;

    // Today's Max Score & Best Time Comparison
    const todayHourly = getTodayHourlyData();
    const todayBestTimes = RunningScoreEngine.findBestRunningTimes(todayHourly);
    const todayMaxScore = todayHourly.reduce((max, h) => Math.max(max, h.runningScore.totalScore), 0);

    DOM.compCurrentScore.textContent = `${scoreObj.totalScore}점`;
    DOM.compMaxScore.textContent = `${todayMaxScore}점`;

    if (todayBestTimes.length > 0) {
      DOM.compBestTime.textContent = todayBestTimes[0].timeLabel;
    } else {
      DOM.compBestTime.textContent = "--:--";
    }

    // Sunset Status
    const sunsetStatus = RunUtils.getSunsetStatus(new Date(), cur.sunset, cur.sunrise);
    DOM.sunsetStatusBadge.textContent = sunsetStatus.badge;

    // Decision Phrase
    const coachMsg = RunningCoachEngine.generateCoachMessage(
      cur,
      scoreObj,
      todayBestTimes[0],
      todayMaxScore
    );
    DOM.runNowDecision.textContent = coachMsg;
  }

  // 2. Render Best Times & Sun
  function renderBestTimesAndSun() {
    const todayHourly = getTodayHourlyData();
    const bestTimes = RunningScoreEngine.findBestRunningTimes(todayHourly);

    if (bestTimes.length === 0) {
      DOM.bestTimesList.innerHTML = `<div class="loading-placeholder">시간대 분석 데이터가 충분하지 않습니다.</div>`;
    } else {
      const medals = ["🥇", "🥈", "🥉"];
      DOM.bestTimesList.innerHTML = bestTimes.map((b, idx) => `
        <div class="best-time-item">
          <div class="best-time-left">
            <span class="best-rank">${medals[idx] || (idx + 1)}</span>
            <div>
              <span class="best-time-range">${b.timeLabel}</span>
              <span class="best-time-badge">${b.badge}</span>
            </div>
          </div>
          <div class="best-time-right">
            <span class="best-time-score" style="color: ${b.grade.color}">${b.score}점</span>
            <span class="grade-badge" style="background-color: ${b.grade.color}; font-size: 0.75rem;">${b.grade.label}</span>
          </div>
        </div>
      `).join('');
    }

    // Sun Times
    const cur = state.weather.current;
    if (cur.sunrise && cur.sunset) {
      DOM.sunriseTime.textContent = RunUtils.formatTimeHHmm(cur.sunrise);
      DOM.sunsetTime.textContent = RunUtils.formatTimeHHmm(cur.sunset);
      const sunsetStatus = RunUtils.getSunsetStatus(new Date(), cur.sunset, cur.sunrise);
      DOM.sunRemainingText.textContent = sunsetStatus.text;
    }
  }

  // 3. Render Weather Grid
  function renderWeatherGrid() {
    const cur = state.weather.current;
    const aqiCur = (state.aqi && state.aqi.current) || {};

    DOM.gridTemp.textContent = `${RunUtils.formatNumber(cur.temperature, 1)}°C`;
    DOM.gridApparent.textContent = `체감 ${RunUtils.formatNumber(cur.apparentTemperature, 1)}°C`;

    DOM.gridDewPoint.textContent = `${RunUtils.formatNumber(cur.dewPoint, 1)}°C`;
    DOM.gridDewPointDesc.textContent = cur.dewPoint <= 12 ? "땀 증발 탁월 (쾌적)" : (cur.dewPoint <= 17 ? "보통" : "땀 증발 저하 (부담)");

    DOM.gridHumidity.textContent = `${cur.humidity}%`;
    DOM.gridPrecip.textContent = `${cur.precipitation || 0}mm`;
    DOM.gridWeatherCode.textContent = `${cur.weatherInfo.icon} ${cur.weatherInfo.label}`;

    DOM.gridWind.textContent = `${cur.windSpeed} km/h`;
    DOM.gridWindSub.textContent = `${cur.windDirectionText} (돌풍 ${cur.windGusts || 0})`;

    // PM2.5 & PM10
    if (aqiCur.pm25 !== null && aqiCur.pm25 !== undefined) {
      DOM.gridPm25.textContent = `${RunUtils.formatNumber(aqiCur.pm25, 1)} ㎍/㎥`;
      DOM.gridPm25Grade.textContent = aqiCur.gradePm25.label;
      DOM.gridPm25Grade.className = `w-sub aqi-badge ${aqiCur.gradePm25.class}`;
    } else {
      DOM.gridPm25.textContent = "데이터 없음";
      DOM.gridPm25Grade.textContent = "확인 불가";
    }

    if (aqiCur.pm10 !== null && aqiCur.pm10 !== undefined) {
      DOM.gridPm10.textContent = `${RunUtils.formatNumber(aqiCur.pm10, 1)} ㎍/㎥`;
      DOM.gridPm10Grade.textContent = aqiCur.gradePm10.label;
      DOM.gridPm10Grade.className = `w-sub aqi-badge ${aqiCur.gradePm10.class}`;
    } else {
      DOM.gridPm10.textContent = "데이터 없음";
      DOM.gridPm10Grade.textContent = "확인 불가";
    }

    // UV
    const uvVal = cur.uvIndex || 0;
    DOM.gridUv.textContent = uvVal;
    DOM.gridUvDesc.textContent = uvVal <= 2 ? "안전 (낮음)" : (uvVal <= 5 ? "보통" : "자외선 차단 권장");
  }

  // 4. Render Hourly Running Score & Chart
  function renderHourlySection() {
    const list = state.hourlyMode === 'today' ? getTodayHourlyData() : getTomorrowHourlyData();
    if (!list || list.length === 0) return;

    RunCharts.renderHourlyChart(DOM.hourlyChartCanvas, list, state.isDark, (selectedHour) => {
      displaySelectedHourDetail(selectedHour);
    });

    // Automatically display first or current hour detail
    displaySelectedHourDetail(list[0]);
  }

  function displaySelectedHourDetail(h) {
    if (!h) return;
    DOM.selectedHourDetail.style.display = 'block';
    DOM.selHourTitle.textContent = `${h.dateKey} ${String(h.hour).padStart(2, '0')}:00 상세 지표`;
    DOM.selHourBadge.textContent = `${h.runningScore.totalScore}점 (${h.runningScore.grade.label})`;
    DOM.selHourBadge.style.backgroundColor = h.runningScore.grade.color;

    DOM.selHourGrid.innerHTML = `
      <div><strong>기온:</strong> ${h.temperature}°C (체감 ${h.apparentTemperature}°C)</div>
      <div><strong>이슬점:</strong> ${h.dewPoint}°C (습도 ${h.humidity}%)</div>
      <div><strong>강수확률:</strong> ${h.precipitationProbability}% (${h.rain}mm)</div>
      <div><strong>풍속:</strong> ${h.windSpeed} km/h (돌풍 ${h.windGusts || 0})</div>
      <div><strong>초미세먼지:</strong> ${h.pm25 !== null && h.pm25 !== undefined ? h.pm25 + ' ㎍/㎥' : '정보 없음'}</div>
    `;
  }

  // 5. Render Today vs Tomorrow
  function renderTodayVsTomorrow() {
    const todayHours = getTodayHourlyData();
    const tomorrowHours = getTomorrowHourlyData();

    if (todayHours.length === 0 || tomorrowHours.length === 0) return;

    const todayAvg = Math.round(todayHours.reduce((s, h) => s + h.runningScore.totalScore, 0) / todayHours.length);
    const tomorrowAvg = Math.round(tomorrowHours.reduce((s, h) => s + h.runningScore.totalScore, 0) / tomorrowHours.length);

    const todayGrade = RunningScoreEngine.getGrade(todayAvg);
    const tomorrowGrade = RunningScoreEngine.getGrade(tomorrowAvg);

    DOM.todayAvgScore.textContent = todayAvg;
    DOM.todayAvgGrade.textContent = todayGrade.label;
    DOM.todayAvgGrade.style.backgroundColor = todayGrade.color;

    DOM.tomorrowAvgScore.textContent = tomorrowAvg;
    DOM.tomorrowAvgGrade.textContent = tomorrowGrade.label;
    DOM.tomorrowAvgGrade.style.backgroundColor = tomorrowGrade.color;

    const todayMaxTemp = Math.max(...todayHours.map(h => h.temperature));
    const todayMaxRain = Math.max(...todayHours.map(h => h.precipitationProbability));
    const tomorrowMaxTemp = Math.max(...tomorrowHours.map(h => h.temperature));
    const tomorrowMaxRain = Math.max(...tomorrowHours.map(h => h.precipitationProbability));

    DOM.todayCompStats.textContent = `최고 ${todayMaxTemp}°C | 강수확률 ${todayMaxRain}%`;
    DOM.tomorrowCompStats.textContent = `최고 ${tomorrowMaxTemp}°C | 강수확률 ${tomorrowMaxRain}%`;

    const comparison = RunningCoachEngine.generateTodayVsTomorrowComparison(
      { avgScore: todayAvg, maxTemp: todayMaxTemp, maxRainProb: todayMaxRain },
      { avgScore: tomorrowAvg, maxTemp: tomorrowMaxTemp, maxRainProb: tomorrowMaxRain }
    );
    DOM.compCommentaryText.textContent = comparison.text;
  }

  // 6. Render Weekly 7-Day Forecast
  function renderWeeklyForecast() {
    const daily = state.weather.daily || [];
    if (daily.length === 0) return;

    // Calculate daily representative score (from daytime & evening hours or max)
    const dailyWithScores = daily.slice(0, 7).map((d) => {
      // Find matching hourly data for this date
      const matchingHours = state.weather.hourly.filter(h => h.dateKey === d.dateStr);
      let avgDayScore = 75;
      if (matchingHours.length > 0) {
        avgDayScore = Math.round(matchingHours.reduce((acc, h) => acc + h.runningScore.totalScore, 0) / matchingHours.length);
      } else {
        avgDayScore = RunningScoreEngine.calculateScore({
          temperature: (d.minTemp + d.maxTemp) / 2,
          humidity: 55,
          rain: d.precipSum,
          precipitationProbability: d.maxRainProb,
          windSpeed: d.maxWindSpeed,
          uvIndex: d.maxUv
        }).totalScore;
      }
      return {
        ...d,
        representativeScore: avgDayScore,
        grade: RunningScoreEngine.getGrade(avgDayScore)
      };
    });

    // Find highest score day
    let bestDayIdx = 0;
    let maxScore = -1;
    dailyWithScores.forEach((d, idx) => {
      if (d.representativeScore > maxScore) {
        maxScore = d.representativeScore;
        bestDayIdx = idx;
      }
    });

    DOM.weeklyForecastList.innerHTML = dailyWithScores.map((d, idx) => `
      <div class="weekly-item ${idx === bestDayIdx ? 'best-day' : ''}">
        <div class="weekly-day-info">
          <span class="weekly-icon">${d.weatherInfo.icon}</span>
          <span class="weekly-date">${d.dateFormatted} (${d.dayName})</span>
          ${idx === bestDayIdx ? '<span class="weekly-badge">★ BEST DAY</span>' : ''}
        </div>
        <div class="weekly-score-area">
          <span class="weekly-score" style="color: ${d.grade.color}">${d.representativeScore}점</span>
          <span class="weekly-temps tabular">${Math.round(d.minTemp)}° / ${Math.round(d.maxTemp)}°C</span>
        </div>
      </div>
    `).join('');
  }

  // 7. Render Workout Modes
  function renderWorkouts() {
    const cur = state.weather.current;
    const workoutScores = RunningScoreEngine.calculateWorkoutScores(cur.runningScore.totalScore, cur);

    const keys = ['easy', 'longRun', 'tempo', 'interval', 'recovery', 'race'];
    DOM.workoutGrid.innerHTML = keys.map(k => {
      const item = workoutScores[k];
      return `
        <div class="workout-item">
          <div class="workout-header">
            <span class="workout-name">${item.label}</span>
            <span class="workout-score" style="color: ${item.grade.color}">${item.score}점</span>
          </div>
          <span class="grade-badge" style="background-color: ${item.grade.color}; font-size: 0.7rem; align-self: flex-start;">${item.grade.label}</span>
          <p class="workout-desc">${item.description}</p>
        </div>
      `;
    }).join('');
  }

  // 8. Render Coach & Gear Advice
  function renderCoachAndGear() {
    const cur = state.weather.current;

    // Environmental Warnings
    const warnings = RunningCoachEngine.getEnvironmentWarnings(cur);
    if (warnings.length === 0) {
      DOM.warningContainer.innerHTML = `
        <div class="warn-item" style="border-left: 3px solid var(--accent-primary);">
          <span class="warn-icon">✅</span>
          <span>현재 주의할 만한 극한 기상(폭염, 돌풍, 폭우 등)은 없습니다. 안전하고 상쾌한 러닝 되세요!</span>
        </div>
      `;
    } else {
      DOM.warningContainer.innerHTML = warnings.map(w => `
        <div class="warn-item">
          <span class="warn-icon">⚠️</span>
          <div>
            <strong class="warn-title">[${w.title}]</strong>
            <span>${w.text}</span>
          </div>
        </div>
      `).join('');
    }

    // Clothing Recommendation
    const clothing = RunningCoachEngine.getClothingAdvice(cur);
    DOM.gearTop.textContent = clothing.top;
    DOM.gearBottom.textContent = clothing.bottom;
    DOM.gearAccessories.textContent = clothing.accessories;
    DOM.gearDisclaimer.textContent = `※ ${clothing.notice}`;
  }

  // Helpers to get today / tomorrow hourly data
  function getTodayHourlyData() {
    if (!state.weather || !state.weather.hourly) return [];
    const todayKey = new Date().toISOString().split('T')[0];
    const filtered = state.weather.hourly.filter(h => h.dateKey === todayKey);
    return filtered.length > 0 ? filtered : state.weather.hourly.slice(0, 24);
  }

  function getTomorrowHourlyData() {
    if (!state.weather || !state.weather.hourly) return [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().split('T')[0];
    const filtered = state.weather.hourly.filter(h => h.dateKey === tomorrowKey);
    return filtered.length > 0 ? filtered : state.weather.hourly.slice(24, 48);
  }

  // Location Handlers
  function handleGeolocation() {
    if (!navigator.geolocation) {
      alert("브라우저가 위치 정보 기능을 지원하지 않습니다.");
      return;
    }

    DOM.btnUseGeolocation.disabled = true;
    DOM.btnUseGeolocation.innerHTML = '<span class="btn-icon">⏳</span> GPS 수신 중...';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        state.location = {
          name: "📍 현재 내 위치 (GPS)",
          latitude: lat,
          longitude: lon,
          timezone: "Asia/Seoul"
        };
        RunStorage.setLocation(state.location);
        DOM.currentLocationName.textContent = state.location.name;
        DOM.locationModal.close();
        DOM.btnUseGeolocation.disabled = false;
        DOM.btnUseGeolocation.innerHTML = '<span class="btn-icon">🎯</span> 현재 GPS 위치 사용';
        await loadDashboardData(true);
      },
      (err) => {
        console.warn("Geolocation denied or failed", err);
        DOM.btnUseGeolocation.disabled = false;
        DOM.btnUseGeolocation.innerHTML = '<span class="btn-icon">🎯</span> 현재 GPS 위치 사용';
        alert("위치 접근 권한이 거부되었거나 위치를 가져올 수 없습니다. 기본 위치를 사용하거나 지역명을 검색해 주세요.");
      },
      { timeout: 8000 }
    );
  }

  async function performLocationSearch() {
    const q = DOM.inputLocationSearch.value.trim();
    if (q.length < 2) {
      alert("검색할 지역명을 2글자 이상 입력해 주세요.");
      return;
    }

    DOM.btnSearchLocation.disabled = true;
    DOM.btnSearchLocation.textContent = "검색 중...";

    const results = await WeatherService.searchLocations(q);
    DOM.btnSearchLocation.disabled = false;
    DOM.btnSearchLocation.textContent = "검색";

    if (results.length === 0) {
      DOM.locationSearchResults.innerHTML = `<div class="loading-placeholder">검색 결과가 없습니다.</div>`;
      return;
    }

    DOM.locationSearchResults.innerHTML = results.map((r, i) => `
      <div class="search-res-item" data-index="${i}">
        <span>${r.name}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${RunUtils.formatNumber(r.latitude, 2)}, ${RunUtils.formatNumber(r.longitude, 2)}</span>
      </div>
    `).join('');

    DOM.locationSearchResults.querySelectorAll('.search-res-item').forEach(item => {
      item.addEventListener('click', async () => {
        const idx = parseInt(item.getAttribute('data-index'), 10);
        const selected = results[idx];
        state.location = selected;
        RunStorage.setLocation(selected);
        DOM.currentLocationName.textContent = selected.name;
        DOM.locationModal.close();
        await loadDashboardData(true);
      });
    });
  }

  // Pace Calculator Tabs & Calculation
  function switchPaceMode(mode) {
    state.paceMode = mode;
    [DOM.tabModeA, DOM.tabModeB, DOM.tabModeC].forEach(t => t.classList.remove('active'));
    [DOM.panelModeA, DOM.panelModeB, DOM.panelModeC].forEach(p => p.style.display = 'none');

    if (mode === 'modeA') {
      DOM.tabModeA.classList.add('active');
      DOM.panelModeA.style.display = 'block';
    } else if (mode === 'modeB') {
      DOM.tabModeB.classList.add('active');
      DOM.panelModeB.style.display = 'block';
    } else if (mode === 'modeC') {
      DOM.tabModeC.classList.add('active');
      DOM.panelModeC.style.display = 'block';
    }
    updatePaceCalculator();
  }

  function updatePaceCalculator() {
    let result = null;

    if (state.paceMode === 'modeA') {
      let dist = parseFloat(DOM.selectDistanceA.value);
      if (DOM.selectDistanceA.value === 'custom') {
        dist = parseFloat(DOM.inputCustomDistA.value) || 0;
      }
      const h = parseInt(DOM.timeHoursA.value, 10) || 0;
      const m = parseInt(DOM.timeMinutesA.value, 10) || 0;
      const s = parseInt(DOM.timeSecondsA.value, 10) || 0;
      const totalSec = h * 3600 + m * 60 + s;

      result = PaceCalculatorEngine.calculateFromDistanceAndTime(dist, totalSec);
    } else if (state.paceMode === 'modeB') {
      const min = parseInt(DOM.paceMinB.value, 10) || 0;
      const sec = parseInt(DOM.paceSecB.value, 10) || 0;
      const paceSec = min * 60 + sec;

      result = PaceCalculatorEngine.calculateFromPace(paceSec);
    } else if (state.paceMode === 'modeC') {
      const speed = parseFloat(DOM.speedInputC.value) || 0;
      result = PaceCalculatorEngine.calculateFromSpeed(speed);
    }

    if (result && result.valid) {
      DOM.calcResultPace.textContent = result.paceString;
      DOM.calcResultSpeed.textContent = result.speedString;

      // Render Splits Grid
      const splits = result.splits;
      const keys = ['400m', '800m', '1k', '3k', '5k', '10k', 'half', 'marathon'];
      DOM.calcSplitsGrid.innerHTML = keys.map(k => {
        const item = splits[k];
        if (!item) return '';
        return `
          <div class="split-card">
            <span class="split-label">${item.label}</span>
            <span class="split-time tabular">${item.timeString}</span>
          </div>
        `;
      }).join('');
    } else {
      DOM.calcResultPace.textContent = "--:--";
      DOM.calcResultSpeed.textContent = "-";
      DOM.calcSplitsGrid.innerHTML = `<div class="loading-placeholder">올바른 시간 또는 페이스를 입력해 주세요.</div>`;
    }
  }

  // Pace Table Renderer
  function renderPaceTable() {
    const rows = PaceCalculatorEngine.generatePaceTable(210, 420, state.paceTableStep);
    DOM.paceTableBody.innerHTML = rows.map(r => `
      <tr>
        <td class="tabular">${r.paceString}</td>
        <td class="tabular">${r.speedKmh}</td>
        <td class="tabular">${r.time5k}</td>
        <td class="tabular">${r.time10k}</td>
        <td class="tabular">${r.timeHalf}</td>
        <td class="tabular">${r.timeFull}</td>
      </tr>
    `).join('');
  }

  // Start App on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
