/**
 * Running Score & Dashboard Configuration
 * Global configuration accessible via window.RUN_CONFIG
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RUN_CONFIG = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    // Basic Settings
    appName: "Run Intelligence Dashboard",
    cacheDurationMs: 20 * 60 * 1000, // 20분 캐시
    defaultLocation: {
      name: "서울 송파구",
      latitude: 37.498,
      longitude: 127.123,
      timezone: "Asia/Seoul"
    },

    // Running Score Weights (Sum = 100)
    weights: {
      temperature: 25,
      dewPoint: 20,
      humidity: 15,
      rain: 15,
      wind: 10,
      airQuality: 10,
      uv: 5
    },

    // Environmental Thresholds & Ideal Targets
    thresholds: {
      // Temperature (°C) - Optimal range: 8°C - 15°C
      temperature: {
        idealMin: 8,
        idealMax: 15,
        acceptableMin: 4,
        acceptableMax: 20,
        extremeCold: -5,
        extremeHeat: 28
      },

      // Dew Point (°C) - Optimal: <= 10°C, >18°C causes cardiac drift, >22°C hazardous
      dewPoint: {
        idealMax: 10,
        comfortableMax: 15,
        oppressiveThreshold: 18,
        hazardousThreshold: 22
      },

      // Relative Humidity (%) - Optimal: 40% - 60%
      humidity: {
        idealMin: 40,
        idealMax: 60,
        acceptableMin: 30,
        acceptableMax: 70,
        highHumidity: 80
      },

      // Rain / Precipitation (mm)
      rain: {
        none: 0,
        light: 0.5,
        moderate: 2.0,
        heavy: 5.0
      },

      // Wind Speed (km/h) & Gusts (km/h)
      wind: {
        calmMax: 15,
        moderateMax: 25,
        strongMax: 35,
        gustHazard: 45
      },

      // Air Quality - PM2.5 (ug/m3) & European AQI
      airQuality: {
        pm25Good: 15,
        pm25Moderate: 35,
        pm25Unhealthy: 75,
        pm10Good: 30,
        pm10Moderate: 80,
        pm10Unhealthy: 150
      },

      // UV Index
      uv: {
        lowMax: 2,
        moderateMax: 5,
        highMax: 7,
        veryHighMax: 10
      }
    },

    // Running Score Grade Definitions
    scoreGrades: [
      { min: 90, max: 100, label: "매우 좋음", class: "score-excellent", color: "#10b981", badge: "최상의 러닝 환경" },
      { min: 80, max: 89,  label: "좋음",     class: "score-good",      color: "#059669", badge: "러닝하기 좋은 날씨" },
      { min: 70, max: 79,  label: "무난함",   class: "score-normal",    color: "#84cc16", badge: "무난한 조건" },
      { min: 60, max: 69,  label: "주의",     class: "score-caution",   color: "#f59e0b", badge: "컨디션 조절 권장" },
      { min: 40, max: 59,  label: "좋지 않음", class: "score-bad",       color: "#ef4444", badge: "체감 부담 큼" },
      { min: 0,  max: 39,  label: "러닝 비추천 환경", class: "score-terrible", color: "#b91c1c", badge: "실내 트레이닝 권장" }
    ],

    // Workout Mode Multipliers & Sensitivity Factors
    workoutModes: {
      recovery: {
        name: "Recovery",
        label: "회복런 (Recovery Run)",
        heatSensitivity: 0.6,
        dewPointSensitivity: 0.6,
        rainSensitivity: 0.8,
        description: "가벼운 회복 러닝으로 환경 영향이 비교적 적습니다."
      },
      easy: {
        name: "Easy",
        label: "이지런 (Easy Run)",
        heatSensitivity: 0.8,
        dewPointSensitivity: 0.8,
        rainSensitivity: 0.9,
        description: "기본 존2 유산소 지속주에 적합한 표준 강도입니다."
      },
      longRun: {
        name: "Long Run",
        label: "장거리주 (Long Run)",
        heatSensitivity: 1.3,
        dewPointSensitivity: 1.4,
        rainSensitivity: 1.2,
        description: "장시간 노출되므로 이슬점과 기온, 탈수 위험에 특히 민감합니다."
      },
      tempo: {
        name: "Tempo",
        label: "템포런 (Tempo Run)",
        heatSensitivity: 1.2,
        dewPointSensitivity: 1.3,
        rainSensitivity: 1.1,
        description: "젖산 역치 훈련으로 체온 상승 및 호흡 부담의 영향을 크게 받습니다."
      },
      interval: {
        name: "Interval",
        label: "인터벌 (Interval)",
        heatSensitivity: 1.4,
        dewPointSensitivity: 1.5,
        rainSensitivity: 1.4,
        description: "고강도 인터벌 세션으로 대기질, 고온 다습, 노면 접지력에 민감합니다."
      },
      race: {
        name: "Race",
        label: "레이스 / TT (Race / Time Trial)",
        heatSensitivity: 1.5,
        dewPointSensitivity: 1.6,
        rainSensitivity: 1.5,
        description: "기록 달성을 위한 최대 강도 모드로 모든 기상 요소가 성적에 직결됩니다."
      }
    },

    // Standard Race Distances (Exact in km)
    distances: {
      "400m": 0.4,
      "800m": 0.8,
      "1k": 1.0,
      "3k": 3.0,
      "5k": 5.0,
      "10k": 10.0,
      "half": 21.0975,
      "marathon": 42.195
    },

    // Pace Table Default Ranges
    paceTable: {
      defaultMinSeconds: 210, // 3:30 /km
      defaultMaxSeconds: 420, // 7:00 /km
      stepSeconds: 10         // 10초 단위
    }
  };
});
