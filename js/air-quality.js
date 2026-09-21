/**
 * Air Quality Service for Open-Meteo Air Quality API
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      root.RunStorage || require('./storage.js'),
      root.RunUtils || require('./utils.js')
    );
  } else {
    root.AirQualityService = factory(root.RunStorage, root.RunUtils);
  }
})(typeof self !== 'undefined' ? self : this, function (storage, utils) {
  'use strict';

  const BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

  return {
    fetchAirQuality: async function (latitude, longitude, forceRefresh = false) {
      if (!forceRefresh) {
        const cached = storage.getAqiCache(latitude, longitude);
        if (cached) {
          return {
            available: true,
            source: "cache",
            data: cached.data
          };
        }
      }

      const params = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,
        current: "pm10,pm2_5,european_aqi",
        hourly: "pm10,pm2_5,european_aqi",
        timezone: "Asia/Seoul"
      });

      const url = `${BASE_URL}?${params.toString()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Air Quality API error ${response.status}`);
        }

        const raw = await response.json();
        const parsed = this.parseAqiData(raw);

        storage.setAqiCache(latitude, longitude, parsed);

        return {
          available: true,
          source: "network",
          data: parsed
        };
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn("Air quality API request failed, falling back gracefully", err);

        const stale = storage.getAqiCache(latitude, longitude);
        if (stale) {
          return {
            available: true,
            source: "stale-cache",
            data: stale.data,
            error: err.message
          };
        }

        return {
          available: false,
          message: "대기질 데이터를 가져올 수 없습니다.",
          data: {
            current: { pm25: null, pm10: null, aqi: null, gradePm25: "확인 불가", gradePm10: "확인 불가" },
            hourly: []
          }
        };
      }
    },

    parseAqiData: function (raw) {
      if (!raw) return null;

      const cur = raw.current || {};
      const pm25 = cur.pm2_5 !== undefined ? cur.pm2_5 : null;
      const pm10 = cur.pm10 !== undefined ? cur.pm10 : null;
      const aqi = cur.european_aqi !== undefined ? cur.european_aqi : null;

      const current = {
        pm25: pm25,
        pm10: pm10,
        aqi: aqi,
        gradePm25: this.getPm25Grade(pm25),
        gradePm10: this.getPm10Grade(pm10),
        gradeAqi: this.getAqiGrade(aqi)
      };

      const hourly = [];
      const times = (raw.hourly && raw.hourly.time) || [];
      for (let i = 0; i < times.length; i++) {
        hourly.push({
          timeString: times[i],
          pm25: raw.hourly.pm2_5 ? raw.hourly.pm2_5[i] : null,
          pm10: raw.hourly.pm10 ? raw.hourly.pm10[i] : null,
          aqi: raw.hourly.european_aqi ? raw.hourly.european_aqi[i] : null
        });
      }

      return {
        current: current,
        hourly: hourly
      };
    },

    getPm25Grade: function (val) {
      if (val === null || val === undefined || isNaN(val)) return { label: "정보 없음", class: "aqi-na" };
      if (val <= 15) return { label: "좋음", class: "aqi-good" };
      if (val <= 35) return { label: "보통", class: "aqi-normal" };
      if (val <= 75) return { label: "나쁨", class: "aqi-bad" };
      return { label: "매우 나쁨", class: "aqi-terrible" };
    },

    getPm10Grade: function (val) {
      if (val === null || val === undefined || isNaN(val)) return { label: "정보 없음", class: "aqi-na" };
      if (val <= 30) return { label: "좋음", class: "aqi-good" };
      if (val <= 80) return { label: "보통", class: "aqi-normal" };
      if (val <= 150) return { label: "나쁨", class: "aqi-bad" };
      return { label: "매우 나쁨", class: "aqi-terrible" };
    },

    getAqiGrade: function (val) {
      if (val === null || val === undefined || isNaN(val)) return { label: "정보 없음", class: "aqi-na" };
      if (val <= 20) return { label: "아주 좋음", class: "aqi-good" };
      if (val <= 40) return { label: "좋음", class: "aqi-good" };
      if (val <= 60) return { label: "보통", class: "aqi-normal" };
      if (val <= 80) return { label: "나쁨", class: "aqi-bad" };
      return { label: "매우 나쁨", class: "aqi-terrible" };
    }
  };
});
