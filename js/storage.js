/**
 * LocalStorage & Cache Management
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root.RUN_CONFIG || require('../config/running-score-config.js'));
  } else {
    root.RunStorage = factory(root.RUN_CONFIG);
  }
})(typeof self !== 'undefined' ? self : this, function (config) {
  'use strict';

  const KEYS = {
    LOCATION: "run_dash_location",
    DARK_MODE: "run_dash_dark_mode",
    WEATHER_CACHE: "run_dash_weather_cache",
    AQI_CACHE: "run_dash_aqi_cache",
    SETTINGS: "run_dash_settings"
  };

  function isStorageAvailable() {
    try {
      const test = "__test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  const available = isStorageAvailable();

  return {
    getLocation: function () {
      if (!available) return config.defaultLocation;
      try {
        const item = localStorage.getItem(KEYS.LOCATION);
        if (item) return JSON.parse(item);
      } catch (e) {
        console.warn("Failed to read location from LocalStorage", e);
      }
      return config.defaultLocation;
    },

    setLocation: function (locObj) {
      if (!available || !locObj) return;
      try {
        localStorage.setItem(KEYS.LOCATION, JSON.stringify(locObj));
      } catch (e) {
        console.warn("Failed to save location", e);
      }
    },

    getDarkMode: function () {
      if (!available) return false;
      try {
        const item = localStorage.getItem(KEYS.DARK_MODE);
        if (item !== null) return JSON.parse(item);
        // Default to system preference
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      } catch (e) {
        return false;
      }
    },

    setDarkMode: function (isDark) {
      if (!available) return;
      try {
        localStorage.setItem(KEYS.DARK_MODE, JSON.stringify(isDark));
      } catch (e) {
        console.warn("Failed to save dark mode setting", e);
      }
    },

    getWeatherCache: function (lat, lon) {
      if (!available) return null;
      try {
        const item = localStorage.getItem(KEYS.WEATHER_CACHE);
        if (!item) return null;
        const cache = JSON.parse(item);
        const now = Date.now();
        const duration = config.cacheDurationMs || 20 * 60 * 1000;

        // Check if cache is still fresh and matches coordinates within ~1km
        const matchCoord = Math.abs(cache.lat - lat) < 0.02 && Math.abs(cache.lon - lon) < 0.02;
        if (matchCoord && (now - cache.timestamp) < duration) {
          return cache;
        }
      } catch (e) {
        console.warn("Weather cache read error", e);
      }
      return null;
    },

    setWeatherCache: function (lat, lon, data) {
      if (!available || !data) return;
      try {
        const cache = {
          timestamp: Date.now(),
          lat: lat,
          lon: lon,
          data: data
        };
        localStorage.setItem(KEYS.WEATHER_CACHE, JSON.stringify(cache));
      } catch (e) {
        console.warn("Failed to write weather cache", e);
      }
    },

    getAqiCache: function (lat, lon) {
      if (!available) return null;
      try {
        const item = localStorage.getItem(KEYS.AQI_CACHE);
        if (!item) return null;
        const cache = JSON.parse(item);
        const now = Date.now();
        const duration = config.cacheDurationMs || 20 * 60 * 1000;

        const matchCoord = Math.abs(cache.lat - lat) < 0.02 && Math.abs(cache.lon - lon) < 0.02;
        if (matchCoord && (now - cache.timestamp) < duration) {
          return cache;
        }
      } catch (e) {
        console.warn("AQI cache read error", e);
      }
      return null;
    },

    setAqiCache: function (lat, lon, data) {
      if (!available || !data) return;
      try {
        const cache = {
          timestamp: Date.now(),
          lat: lat,
          lon: lon,
          data: data
        };
        localStorage.setItem(KEYS.AQI_CACHE, JSON.stringify(cache));
      } catch (e) {
        console.warn("Failed to write AQI cache", e);
      }
    },

    clearCaches: function () {
      if (!available) return;
      try {
        localStorage.removeItem(KEYS.WEATHER_CACHE);
        localStorage.removeItem(KEYS.AQI_CACHE);
      } catch (e) {
        console.warn("Failed to clear caches", e);
      }
    }
  };
});
