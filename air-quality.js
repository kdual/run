import { APP_CONFIG } from './running-score-config.js?v=11';
export async function fetchAirQuality(location, signal) {
  const p = new URLSearchParams({
    sidoName: location.region1 || location.name?.split(' ')[0] || '서울',
    stationName: location.region2 || ''
  });
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/air?${p}`, { signal });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.message || `에어코리아 API 오류 (${response.status})`);
  return data;
}
