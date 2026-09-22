import { APP_CONFIG } from './running-score-config.js?v=14';

export async function fetchWeather({ latitude, longitude, areaNo }, signal) {
  const params = new URLSearchParams({ latitude, longitude });
  if (/^\d{10}$/.test(String(areaNo || ''))) params.set('areaNo', areaNo);
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/weather?${params}`, { signal, cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.hourly || !data?.current) {
    throw new Error(data?.message || `기상청 날씨 API 오류 (${response.status})`);
  }
  return data;
}

function kakaoServices() {
  if (!window.kakao?.maps?.services) throw new Error('카카오 지도 서비스를 불러오지 못했습니다. Kakao Developers의 카카오맵 사용 설정과 웹 도메인을 확인해 주세요.');
  return window.kakao.maps.services;
}

function keywordSearch(query) {
  return new Promise((resolve, reject) => {
    const services = kakaoServices();
    new services.Places().keywordSearch(query, (results, status) => {
      if (status === services.Status.OK) resolve(results);
      else if (status === services.Status.ZERO_RESULT) resolve([]);
      else reject(new Error('카카오 장소 검색에 실패했습니다.'));
    }, { size: 10 });
  });
}

function addressSearch(query) {
  return new Promise((resolve, reject) => {
    const services = kakaoServices();
    new services.Geocoder().addressSearch(query, (results, status) => {
      if (status === services.Status.OK) resolve(results);
      else if (status === services.Status.ZERO_RESULT) resolve([]);
      else reject(new Error('카카오 주소 검색에 실패했습니다.'));
    });
  });
}

const splitAddress = value => {
  const parts = String(value || '').trim().split(/\s+/);
  return { region1: parts[0] || '', region2: parts[1] || '', region3: parts[2] || '' };
};

export async function searchLocations(query) {
  const [places, addresses] = await Promise.all([keywordSearch(query), addressSearch(query)]);
  const normalized = [];
  for (const place of places) {
    const address = place.road_address_name || place.address_name;
    normalized.push({
      id: `place-${place.id}`,
      name: place.place_name,
      address,
      roadAddress: place.road_address_name || '',
      latitude: Number(place.y),
      longitude: Number(place.x),
      ...splitAddress(place.address_name),
      category: place.category_group_name || place.category_name || '장소'
    });
  }
  for (const item of addresses) {
    const address = item.road_address?.address_name || item.address_name;
    normalized.push({
      id: `address-${item.x}-${item.y}`,
      name: address,
      address,
      roadAddress: item.road_address?.address_name || '',
      latitude: Number(item.y),
      longitude: Number(item.x),
      areaNo: item.address?.b_code || '',
      ...splitAddress(item.address_name),
      category: '주소'
    });
  }
  return [...new Map(normalized.map(item => [`${item.latitude.toFixed(6)},${item.longitude.toFixed(6)}`, item])).values()].slice(0, 8);
}

export function reverseGeocode(latitude, longitude) {
  return new Promise((resolve, reject) => {
    const services = kakaoServices();
    new services.Geocoder().coord2Address(longitude, latitude, (results, status) => {
      if (status !== services.Status.OK || !results[0]) {
        reject(new Error('현재 위치의 주소를 확인하지 못했습니다.'));
        return;
      }
      const result = results[0];
      const address = result.road_address?.address_name || result.address?.address_name || '현재 위치';
      const region = result.address || {};
      resolve({
        name: [region.region_1depth_name, region.region_2depth_name].filter(Boolean).join(' '),
        address,
        roadAddress: result.road_address?.address_name || '',
        latitude,
        longitude,
        region1: region.region_1depth_name || '',
        region2: region.region_2depth_name || '',
        region3: region.region_3depth_name || '',
        areaNo: region.b_code || ''
      });
    });
  });
}

export async function ensureAreaCode(location) {
  if (/^\d{10}$/.test(String(location?.areaNo || ''))) return location;
  const resolved = await reverseGeocode(location.latitude, location.longitude);
  return {
    ...location,
    region1: location.region1 || resolved.region1,
    region2: location.region2 || resolved.region2,
    region3: location.region3 || resolved.region3,
    areaNo: resolved.areaNo || ''
  };
}
