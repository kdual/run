import { APP_CONFIG } from './running-score-config.js?v=11';
export async function fetchAirQuality(location, signal) {
  const p = new URLSearchParams({
    sidoName: location.region1 || location.name?.split(' ')[0] || '서울',
    stationName: location.region2 || ''
  });
  const url = `${APP_CONFIG.apiBaseUrl}/air?${p}`;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.message || `에어코리아 API 오류 (${response.status})`);
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
  throw lastError;
}
