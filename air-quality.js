import { APP_CONFIG } from './running-score-config.js';
export async function fetchAirQuality({ latitude, longitude }, signal) {
  const p = new URLSearchParams({ latitude, longitude, timezone: APP_CONFIG.timezone, forecast_days: '5', hourly: 'pm10,pm2_5,european_aqi' });
  const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${p}`, { signal });
  if (!response.ok) throw new Error(`대기질 API 오류 (${response.status})`);
  return response.json();
}
