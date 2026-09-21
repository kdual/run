import { APP_CONFIG } from './running-score-config.js';

const HOURLY = ['temperature_2m','apparent_temperature','relative_humidity_2m','dew_point_2m','precipitation_probability','precipitation','rain','weather_code','cloud_cover','visibility','wind_speed_10m','wind_direction_10m','wind_gusts_10m','uv_index','is_day'];
const CURRENT = ['temperature_2m','apparent_temperature','relative_humidity_2m','dew_point_2m','precipitation','rain','weather_code','cloud_cover','wind_speed_10m','wind_direction_10m','wind_gusts_10m','is_day'];

export async function fetchWeather({ latitude, longitude }, signal) {
  const p = new URLSearchParams({ latitude, longitude, timezone: APP_CONFIG.timezone, forecast_days: '7', current: CURRENT.join(','), hourly: HOURLY.join(','), daily: 'weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max,temperature_2m_max,temperature_2m_min' });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`, { signal });
  if (!response.ok) throw new Error(`날씨 API 오류 (${response.status})`);
  return response.json();
}

export async function searchLocations(query, signal) {
  const p = new URLSearchParams({ name: query, count: '8', language: 'ko', format: 'json' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${p}`, { signal });
  if (!response.ok) throw new Error('지역 검색에 실패했습니다.');
  const data = await response.json();
  return data.results || [];
}
