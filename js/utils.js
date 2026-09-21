/**
 * Utility Functions for Running Dashboard
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RunUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // WMO Weather Code Descriptions
  const WMO_CODES = {
    0: { label: "맑음", icon: "☀️" },
    1: { label: "대체로 맑음", icon: "🌤️" },
    2: { label: "구름 조금", icon: "⛅" },
    3: { label: "흐림", icon: "☁️" },
    45: { label: "안개", icon: "🌫️" },
    48: { label: "빙결 안개", icon: "🌫️" },
    51: { label: "이슬비 (약)", icon: "🌦️" },
    53: { label: "이슬비 (보통)", icon: "🌦️" },
    55: { label: "이슬비 (강)", icon: "🌧️" },
    61: { label: "비 (약)", icon: "🌧️" },
    63: { label: "비 (보통)", icon: "🌧️" },
    65: { label: "비 (강)", icon: "🌧️" },
    71: { label: "눈 (약)", icon: "🌨️" },
    73: { label: "눈 (보통)", icon: "🌨️" },
    75: { label: "눈 (강)", icon: "❄️" },
    77: { label: "싸락눈", icon: "❄️" },
    80: { label: "소나기 (약)", icon: "🌦️" },
    81: { label: "소나기 (보통)", icon: "🌧️" },
    82: { label: "소나기 (강)", icon: "⛈️" },
    85: { label: "눈 소나기 (약)", icon: "🌨️" },
    86: { label: "눈 소나기 (강)", icon: "❄️" },
    95: { label: "뇌우", icon: "⛈️" },
    96: { label: "우박 동반 뇌우", icon: "⛈️" },
    99: { label: "강한 우박 동반 뇌우", icon: "⛈️" }
  };

  const CARDINAL_DIRECTIONS = [
    "북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동",
    "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서"
  ];

  const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

  return {
    clamp: function (val, min, max) {
      return Math.min(Math.max(val, min), max);
    },

    formatNumber: function (val, decimals = 1) {
      if (val === null || val === undefined || isNaN(val)) return "-";
      return Number(val).toFixed(decimals);
    },

    getWeatherInfo: function (code) {
      return WMO_CODES[code] || { label: "정보 없음", icon: "🌤️" };
    },

    getWindDirectionText: function (deg) {
      if (deg === null || deg === undefined || isNaN(deg)) return "-";
      const index = Math.round(deg / 22.5) % 16;
      return CARDINAL_DIRECTIONS[index] + "풍";
    },

    /**
     * Parse date string into Date object
     */
    parseDate: function (dateStr) {
      return new Date(dateStr);
    },

    /**
     * Format Date to local display (Asia/Seoul)
     */
    formatTimeHHmm: function (dateObj) {
      if (!dateObj) return "--:--";
      const d = typeof dateObj === "string" ? new Date(dateObj) : dateObj;
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    },

    formatDateFull: function (dateObj) {
      const d = typeof dateObj === "string" ? new Date(dateObj) : dateObj;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const date = d.getDate();
      const day = DAYS_KO[d.getDay()];
      return `${year}년 ${month}월 ${date}일 (${day})`;
    },

    getDayNameKo: function (dateObj) {
      const d = typeof dateObj === "string" ? new Date(dateObj) : dateObj;
      return DAYS_KO[d.getDay()];
    },

    /**
     * Calculate remaining time to sunset
     */
    getSunsetStatus: function (nowDate, sunsetDateStr, sunriseDateStr) {
      if (!sunsetDateStr) return { isNight: false, text: "일몰 정보 없음" };
      const now = nowDate || new Date();
      const sunset = new Date(sunsetDateStr);
      const sunrise = sunriseDateStr ? new Date(sunriseDateStr) : null;

      const diffMs = sunset.getTime() - now.getTime();

      if (diffMs > 0) {
        const totalMinutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        let text = "";
        if (hours > 0) {
          text = `일몰까지 ${hours}시간 ${minutes}분 남음`;
        } else {
          text = `일몰까지 ${minutes}분 남음`;
        }
        return {
          isNight: false,
          remainingMinutes: totalMinutes,
          text: text,
          badge: "주간 러닝"
        };
      } else {
        return {
          isNight: true,
          remainingMinutes: 0,
          text: "일몰 완료 (Night Run)",
          badge: "야간 러닝 (반사 장비/라이트 권장)"
        };
      }
    },

    /**
     * Pace & Speed Calculations
     */
    secondsToTimeString: function (totalSeconds, showHours = false) {
      if (!isFinite(totalSeconds) || totalSeconds <= 0) return "--:--";
      const total = Math.round(totalSeconds);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;

      const mm = String(minutes).padStart(2, "0");
      const ss = String(seconds).padStart(2, "0");

      if (hours > 0 || showHours) {
        return `${hours}:${mm}:${ss}`;
      }
      return `${minutes}:${ss}`;
    },

    timeStringToSeconds: function (str) {
      if (!str || typeof str !== "string") return 0;
      const parts = str.trim().split(":").map(Number);
      if (parts.some(isNaN)) return 0;

      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      } else if (parts.length === 1) {
        return parts[0] * 60; // 기본 분 단위
      }
      return 0;
    },

    paceToSpeed: function (secondsPerKm) {
      if (!secondsPerKm || secondsPerKm <= 0) return 0;
      return 3600 / secondsPerKm; // km/h
    },

    speedToPace: function (speedKmh) {
      if (!speedKmh || speedKmh <= 0) return 0;
      return 3600 / speedKmh; // seconds per km
    },

    calculateFinishTime: function (secondsPerKm, distanceKm) {
      if (!secondsPerKm || !distanceKm || secondsPerKm <= 0 || distanceKm <= 0) return 0;
      return secondsPerKm * distanceKm;
    }
  };
});
