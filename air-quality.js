import { requestJson } from './request.js?v=39';
import { getStored, setStored } from './storage.js?v=19';
import { APP_CONFIG } from './running-score-config.js?v=14';
export async function fetchAirQuality(location, signal) {
  if(!location.region1){const error=new Error('시·도 행정구역을 확인할 수 없습니다.');error.code='REGION';throw error;}
  const stationKey=[location.region1,location.region2||'',Number(location.latitude).toFixed(3),Number(location.longitude).toFixed(3)].join('|');
  const stations=getStored('air-stations-v1',{});
  const known=stations[stationKey];
  const preferred=known&&Date.now()-known.verifiedAt<86400000?known.stationName:null;
  const p = new URLSearchParams({
    sidoName: location.region1,
    stationName: preferred || location.region3 || location.region2 || '',
    districtName: location.region2 || '',
    latitude: String(location.latitude || ''),
    longitude: String(location.longitude || '')
  });
  const url = `${APP_CONFIG.apiBaseUrl}/air?${p}`;
  // Station resolution can take longer than weather requests. A single bounded request avoids overlapping retries.
  const {data}=await requestJson(url,signal,{timeoutMs:45000,retries:0});
  if(!data?.current)throw new Error('대기질 자료를 확인할 수 없습니다.');
  if(data.current.station_name){
    stations[stationKey]={stationName:data.current.station_name,verifiedAt:Date.now()};
    const retained=Object.fromEntries(Object.entries(stations).sort((a,b)=>(b[1]?.verifiedAt||0)-(a[1]?.verifiedAt||0)).slice(0,30));
    setStored('air-stations-v1',retained);
  }
  return data;
}
