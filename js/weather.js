/**
 * Weather Service for Open-Meteo API
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      root.RUN_CONFIG || require('../config/running-score-config.js'),
      root.RunStorage || require('./storage.js'),
      root.RunUtils || require('./utils.js')
    );
  } else {
    root.WeatherService = factory(root.RUN_CONFIG, root.RunStorage, root.RunUtils);
  }
})(typeof self !== 'undefined' ? self : this, function (config, storage, utils) {
  'use strict';

  const BASE_URL = "https://api.open-meteo.com/v1/forecast";
  const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

  return {
    /**
     * Fetch Weather Data with Caching & Timeout
     */
    fetchWeather: async function (latitude, longitude, forceRefresh = false) {
      if (!forceRefresh) {
        const cached = storage.getWeatherCache(latitude, longitude);
        if (cached) {
          return {
            source: "cache",
            timestamp: cached.timestamp,
            data: cached.data
          };
        }
      }

      const params = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "is_day",
          "precipitation",
          "rain",
          "weather_code",
          "cloud_cover",
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
          "dew_point_2m"
        ].join(","),
        hourly: [
          "temperature_2m",
          "relative_humidity_2m",
          "dew_point_2m",
          "apparent_temperature",
          "precipitation_probability",
          "precipitation",
          "rain",
          "weather_code",
          "visibility",
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
          "uv_index",
          "is_day"
        ].join(","),
        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "apparent_temperature_max",
          "apparent_temperature_min",
          "sunrise",
          "sunset",
          "uv_index_max",
          "precipitation_sum",
          "precipitation_probability_max",
          "wind_speed_10m_max"
        ].join(","),
        timezone: "Asia/Seoul"
      });

      const url = `${BASE_URL}?${params.toString()}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Weather API Error: ${response.status} ${response.statusText}`);
        }

        const rawData = await response.json();
        const parsed = this.parseWeatherData(rawData);

        storage.setWeatherCache(latitude, longitude, parsed);

        return {
          source: "network",
          timestamp: Date.now(),
          data: parsed
        };
      } catch (err) {
        clearTimeout(timeoutId);
        // If network failed, attempt returning stale cache
        const staleCache = storage.getWeatherCache(latitude, longitude);
        if (staleCache) {
          console.warn("Using stale weather cache due to network error", err);
          return {
            source: "stale-cache",
            timestamp: staleCache.timestamp,
            data: staleCache.data,
            error: err.message
          };
        }
        throw err;
      }
    },

    /**
     * Parse raw Open-Meteo payload into structured domain models
     */
    parseWeatherData: function (raw) {
      if (!raw || !raw.current || !raw.hourly || !raw.daily) {
        throw new Error("Invalid weather data payload structure");
      }

      // Current Weather
      const cur = raw.current;
      const currentWeather = {
        time: cur.time,
        temperature: cur.temperature_2m,
        apparentTemperature: cur.apparent_temperature,
        humidity: cur.relative_humidity_2m,
        dewPoint: cur.dew_point_2m !== undefined ? cur.dew_point_2m : (cur.temperature_2m - ((100 - cur.relative_humidity_2m) / 5)),
        rain: cur.rain || 0,
        precipitation: cur.precipitation || 0,
        weatherCode: cur.weather_code,
        weatherInfo: utils.getWeatherInfo(cur.weather_code),
        cloudCover: cur.cloud_cover,
        windSpeed: cur.wind_speed_10m,
        windDirection: cur.wind_direction_10m,
        windDirectionText: utils.getWindDirectionText(cur.wind_direction_10m),
        windGusts: cur.wind_gusts_10m,
        isDay: cur.is_day
      };

      // Hourly Weather
      const hTimes = raw.hourly.time || [];
      const hourlyList = [];

      for (let i = 0; i < hTimes.length; i++) {
        const timeStr = hTimes[i];
        const dateObj = new Date(timeStr);
        const temp = raw.hourly.temperature_2m[i];
        const rh = raw.hourly.relative_humidity_2m[i];
        const dp = raw.hourly.dew_point_2m ? raw.hourly.dew_point_2m[i] : (temp - ((100 - rh) / 5));

        hourlyList.push({
          timeString: timeStr,
          dateObj: dateObj,
          hour: dateObj.getHours(),
          dateKey: timeStr.split("T")[0],
          temperature: temp,
          apparentTemperature: raw.hourly.apparent_temperature[i],
          humidity: rh,
          dewPoint: dp,
          precipitationProbability: raw.hourly.precipitation_probability ? raw.hourly.precipitation_probability[i] : 0,
          precipitation: raw.hourly.precipitation ? raw.hourly.precipitation[i] : 0,
          rain: raw.hourly.rain ? raw.hourly.rain[i] : 0,
          weatherCode: raw.hourly.weather_code[i],
          weatherInfo: utils.getWeatherInfo(raw.hourly.weather_code[i]),
          visibility: raw.hourly.visibility ? raw.hourly.visibility[i] : null,
          windSpeed: raw.hourly.wind_speed_10m[i],
          windDirection: raw.hourly.wind_direction_10m ? raw.hourly.wind_direction_10m[i] : 0,
          windGusts: raw.hourly.wind_gusts_10m ? raw.hourly.wind_gusts_10m[i] : 0,
          uvIndex: raw.hourly.uv_index ? raw.hourly.uv_index[i] : 0,
          isDay: raw.hourly.is_day ? raw.hourly.is_day[i] : 1
        });
      }

      // Daily Weather
      const dTimes = raw.daily.time || [];
      const dailyList = [];

      for (let i = 0; i < dTimes.length; i++) {
        const dateStr = dTimes[i];
        const dateObj = new Date(dateStr);

        dailyList.push({
          dateStr: dateStr,
          dateObj: dateObj,
          dayName: utils.getDayNameKo(dateObj),
          dateFormatted: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
          weatherCode: raw.daily.weather_code[i],
          weatherInfo: utils.getWeatherInfo(raw.daily.weather_code[i]),
          minTemp: raw.daily.temperature_2m_min[i],
          maxTemp: raw.daily.temperature_2m_max[i],
          minApparentTemp: raw.daily.apparent_temperature_min[i],
          maxApparentTemp: raw.daily.apparent_temperature_max[i],
          sunrise: raw.daily.sunrise[i],
          sunset: raw.daily.sunset[i],
          maxUv: raw.daily.uv_index_max[i],
          precipSum: raw.daily.precipitation_sum[i],
          maxRainProb: raw.daily.precipitation_probability_max[i],
          maxWindSpeed: raw.daily.wind_speed_10m_max[i]
        });
      }

      // Add uvIndex and sunrise/sunset from daily to current if available
      if (dailyList.length > 0) {
        currentWeather.uvIndex = dailyList[0].maxUv || 0;
        currentWeather.sunrise = dailyList[0].sunrise;
        currentWeather.sunset = dailyList[0].sunset;
      }

      return {
        current: currentWeather,
        hourly: hourlyList,
        daily: dailyList
      };
    },

    /**
     * Search Places using Open-Meteo Geocoding API
     */
    searchLocations: async function (query) {
      if (!query || query.trim().length < 2) return [];

      const url = `${GEOCODE_URL}?name=${encodeURIComponent(query.trim())}&count=6&language=ko&format=json`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Geocoding failed");
        const json = await res.json();
        if (!json.results || json.results.length === 0) return [];

        return json.results.map(r => {
          const parts = [r.name];
          if (r.admin1 && r.admin1 !== r.name) parts.unshift(r.admin1);
          if (r.country && r.country !== "South Korea" && r.country !== "대한민국") parts.push(r.country);

          return {
            name: parts.join(" "),
            latitude: r.latitude,
            longitude: r.longitude,
            timezone: r.timezone || "Asia/Seoul",
            country: r.country
          };
        });
      } catch (err) {
        console.warn("Geocoding search error", err);
        return [];
      }
    }
  };
});
