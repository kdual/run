import { requestJson } from './request.js?v=36';
import { APP_CONFIG } from './running-score-config.js?v=14';
export async function fetchAirQuality(location, signal) {
  const p = new URLSearchParams({
    sidoName: location.region1 || location.name?.split(' ')[0] || '서울',
    stationName: location.region3 || location.region2 || '',
    districtName: location.region2 || '',
    latitude: String(location.latitude || ''),
    longitude: String(location.longitude || '')
  });
  const url = `${APP_CONFIG.apiBaseUrl}/air?${p}`;
  const {data}=await requestJson(url,signal);
  if(!data?.current)throw new Error('대기질 자료를 확인할 수 없습니다.');
  return data;
}
