import { APP_CONFIG } from './running-score-config.js';

const HOURLY = ['temperature_2m','apparent_temperature','relative_humidity_2m','dew_point_2m','precipitation_probability','precipitation','rain','weather_code','cloud_cover','visibility','wind_speed_10m','wind_direction_10m','wind_gusts_10m','uv_index','is_day'];
const CURRENT = ['temperature_2m','apparent_temperature','relative_humidity_2m','dew_point_2m','precipitation','rain','weather_code','cloud_cover','wind_speed_10m','wind_direction_10m','wind_gusts_10m','is_day'];

const LOCAL_KR_LOCATIONS = [
  {
    id: 'local-kr-songpa',
    name: '송파구',
    latitude: 37.5145,
    longitude: 127.1059,
    country: '대한민국',
    country_code: 'KR',
    admin1: '서울특별시',
    feature_code: 'ADM2',
    aliases: ['송파', '송파구', '서울송파', '서울송파구', '서울특별시송파구']
  }
];

const normalizedLocationQuery = value => value.replace(/\s+/g, '').toLowerCase();

export async function fetchWeather({ latitude, longitude }, signal) {
  const p = new URLSearchParams({ latitude, longitude, timezone: APP_CONFIG.timezone, forecast_days: '7', current: CURRENT.join(','), hourly: HOURLY.join(','), daily: 'weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max,temperature_2m_max,temperature_2m_min' });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`, { signal });
  if (!response.ok) throw new Error(`날씨 API 오류 (${response.status})`);
  return response.json();
}

export async function searchLocations(query, signal) {
  const normalizedQuery=normalizedLocationQuery(query);
  const localMatches=LOCAL_KR_LOCATIONS.filter(location=>location.aliases.includes(normalizedQuery));
  const isKorean=/[가-힣]/.test(query);
  const terms=isKorean&&!/[구군시도]$/.test(query)?[query,`${query}구`,`${query}시`]:[query];
  const batches=await Promise.all(terms.map(async name=>{
    const p=new URLSearchParams({name,count:'30',language:'ko',format:'json'});
    if(isKorean)p.set('countryCode','KR');
    const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?${p}`,{signal});
    if(!response.ok)throw new Error('지역 검색에 실패했습니다.');
    return (await response.json()).results||[];
  }));
  const results=[...new Map([...localMatches,...batches.flat()].map(r=>[r.id,r])).values()];
  return results.sort((a,b)=>{
    const rank=r=>(r.id?.startsWith('local-kr-')?1000:0)+(r.country_code==='KR'?100:0)+(r.name===query?35:0)+(r.name===`${query}구`?50:0)+(r.name===`${query}시`?45:0)+(r.feature_code?.startsWith('ADM')?40:0)+(r.admin1?.includes('서울')?25:0)+Math.min(20,Math.log10((r.population||1)+1)*3);
    return rank(b)-rank(a);
  }).slice(0,8);
}
