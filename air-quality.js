import { requestJson } from './request.js?v=38';
import { APP_CONFIG } from './running-score-config.js?v=14';
export async function fetchAirQuality(location, signal) {
  if(!location.region1){const error=new Error('시·도 행정구역을 확인할 수 없습니다.');error.code='REGION';throw error;}
  const p = new URLSearchParams({
    sidoName: location.region1,
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
