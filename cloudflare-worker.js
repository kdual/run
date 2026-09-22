/**
 * RUNWISE Cloudflare Worker
 *
 * Required bindings
 * - Secret: DATA_GO_KR_SERVICE_KEY
 * - Variable: ALLOWED_ORIGIN=https://kdual.github.io
 *
 * Public routes
 * - GET /health
 * - GET /weather/current?nx=62&ny=126
 * - GET /weather?latitude=37.5145&longitude=127.1059&areaNo=1171000000
 * - GET /air?sidoName=서울&stationName=송파구
 */

const KMA_BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';
const KMA_LIVING_BASE = 'https://apis.data.go.kr/1360000/LivingWthrIdxServiceV5';
const AIR_BASE = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc';
const AIR_STATION_BASE = 'https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405, headers);

    try {
      if (url.pathname === '/' || url.pathname === '/health') {
        return json({ ok: true, service: 'Runwise Weather API', timestamp: new Date().toISOString() }, 200, headers);
      }
      if (!env.DATA_GO_KR_SERVICE_KEY) throw new Error('공공데이터 인증키가 설정되지 않았습니다.');

      if (url.pathname === '/weather/current') return currentRoute(url, env, headers);
      if (url.pathname === '/weather') return weatherRoute(url, env, headers);
      if (url.pathname === '/air') return airRoute(url, env, headers);

      return json({ ok: false, error: 'NOT_FOUND' }, 404, headers);
    } catch (error) {
      return json({ ok: false, error: 'WORKER_ERROR', message: error?.message || String(error) }, 500, headers);
    }
  }
};

async function currentRoute(url, env, headers) {
  const nx = Number(url.searchParams.get('nx'));
  const ny = Number(url.searchParams.get('ny'));
  if (!Number.isInteger(nx) || !Number.isInteger(ny)) {
    return json({ ok: false, error: 'INVALID_GRID', message: 'nx와 ny가 필요합니다.' }, 400, headers);
  }
  const current = await fetchKmaCurrent(nx, ny, env.DATA_GO_KR_SERVICE_KEY);
  return json({ ok: true, source: '기상청 초단기실황', grid: { nx, ny }, observedAt: current.time.replace('T', ' '), current: current.values, rawCategories: current.raw }, 200, headers);
}

async function weatherRoute(url, env, headers) {
  const latitude = Number(url.searchParams.get('latitude'));
  const longitude = Number(url.searchParams.get('longitude'));
  const areaNo = normalizeAreaNo(url.searchParams.get('areaNo'));
  if (!isKoreanCoordinate(latitude, longitude)) {
    return json({ ok: false, error: 'INVALID_LOCATION', message: '대한민국 범위의 위도·경도가 필요합니다.' }, 400, headers);
  }

  const grid = latLonToGrid(latitude, longitude);
  const [observation, forecast, uvResult, stagnationResult] = await Promise.all([
    fetchKmaCurrent(grid.nx, grid.ny, env.DATA_GO_KR_SERVICE_KEY),
    fetchKmaForecast(grid.nx, grid.ny, env.DATA_GO_KR_SERVICE_KEY),
    fetchLivingIndexSafely('getUVIdxV5', areaNo, env.DATA_GO_KR_SERVICE_KEY, '자외선지수'),
    fetchLivingIndexSafely('getAirDiffusionIdxV5', areaNo, env.DATA_GO_KR_SERVICE_KEY, '대기정체지수')
  ]);
  const weather = buildWeatherPayload({
    latitude, longitude, grid, areaNo, observation, forecast,
    uvIndex: uvResult.data,
    airStagnation: stagnationResult.data,
    lifeStatus: {
      uv: uvResult.status,
      air_stagnation: stagnationResult.status,
      uv_error: uvResult.message || null,
      air_stagnation_error: stagnationResult.message || null
    }
  });
  return json(weather, 200, { ...headers, 'Cache-Control': 'public, max-age=300' });
}

async function airRoute(url, env, headers) {
  const sidoName = normalizeSido(url.searchParams.get('sidoName') || '서울');
  const stationName = String(url.searchParams.get('stationName') || '').trim();
  const districtName = String(url.searchParams.get('districtName') || '').trim();
  const latitude = Number(url.searchParams.get('latitude'));
  const longitude = Number(url.searchParams.get('longitude'));
  const key = env.DATA_GO_KR_SERVICE_KEY;

  const currentUrl = dataGoUrl(`${AIR_BASE}/getCtprvnRltmMesureDnsty`, key, {
    returnType: 'json', numOfRows: 200, pageNo: 1, sidoName, ver: '1.3'
  });
  const currentData = await fetchJson(currentUrl, '에어코리아 실시간 측정정보');
  assertPublicData(currentData, '에어코리아 실시간 측정정보');
  const items = normalizeItems(currentData?.response?.body?.items);
  let match = selectStation(items, stationName, districtName);
  let nearestStation = null;
  let stationListResult = { status: 'skipped' };
  if (!match.item && isKoreanCoordinate(latitude, longitude)) {
    stationListResult = await fetchAirStations(sidoName, districtName, key)
      .then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));
  }
  if (!match.item && stationListResult.status === 'fulfilled') {
    const stations = stationListResult.value;
    nearestStation = findNearestStation(stations, latitude, longitude);
    if (nearestStation) {
      const nearestMatch = selectStation(items, nearestStation.stationName, districtName);
      if (nearestMatch.item) match = { ...nearestMatch, type: 'nearest-coordinate' };
    }
  }
  const selected = match.item;

  const current = selected ? {
    station_name: selected.stationName,
    measured_at: selected.dataTime,
    pm10: numberOrNull(selected.pm10Value),
    pm2_5: numberOrNull(selected.pm25Value),
    air_quality_index: numberOrNull(selected.khaiValue),
    pm10_grade: selected.pm10Grade1h || selected.pm10Grade || null,
    pm2_5_grade: selected.pm25Grade1h || selected.pm25Grade || null,
    data_status: selected.pm10Flag || selected.pm25Flag || null
  } : null;

  return json({
    source: '에어코리아 측정소 실측',
    sido_name: sidoName,
    requested_station: stationName || null,
    requested_district: districtName || null,
    station_match: match.type,
    nearest_station: nearestStation?.stationName || null,
    station_lookup: stationListResult.status,
    current,
    daily: []
  }, 200, { ...headers, 'Cache-Control': 'public, max-age=900' });
}

async function fetchAirStations(sidoName, districtName, key) {
  const addresses = [...new Set([districtName, sidoName].map(value => String(value || '').trim()).filter(Boolean))];
  let lastError = null;
  for (const addr of addresses) {
    const stationListUrl = dataGoUrl(`${AIR_STATION_BASE}/getMsrstnList`, key, {
      returnType: 'json', numOfRows: addr === sidoName ? 400 : 100, pageNo: 1, addr
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const data = await fetchJson(stationListUrl, '에어코리아 측정소 정보');
        assertPublicData(data, '에어코리아 측정소 정보');
        const stations = normalizeItems(data?.response?.body?.items);
        if (stations.length) return stations;
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }
  throw lastError || new Error('주변 에어코리아 측정소를 찾지 못했습니다.');
}

async function fetchKmaCurrent(nx, ny, rawKey) {
  const base = ultraBaseTime();
  const url = dataGoUrl(`${KMA_BASE}/getUltraSrtNcst`, rawKey, {
    pageNo: 1, numOfRows: 1000, dataType: 'JSON', base_date: base.date, base_time: base.time, nx, ny
  });
  const data = await fetchJson(url, '기상청 초단기실황');
  assertKma(data);
  const items = normalizeItems(data?.response?.body?.items?.item);
  const raw = Object.fromEntries(items.map(item => [item.category, numberOrText(item.obsrValue)]));
  return {
    time: compactToIso(base.date, base.time),
    raw,
    values: {
      temperature: numberOrNull(raw.T1H), humidity: numberOrNull(raw.REH),
      precipitation1h: parsePrecipitation(raw.RN1), precipitationType: numberOrNull(raw.PTY),
      windSpeed: numberOrNull(raw.WSD), windDirection: numberOrNull(raw.VEC),
      windEastWest: numberOrNull(raw.UUU), windNorthSouth: numberOrNull(raw.VVV)
    }
  };
}

async function fetchKmaForecast(nx, ny, rawKey) {
  const base = villageBaseTime();
  const url = dataGoUrl(`${KMA_BASE}/getVilageFcst`, rawKey, {
    pageNo: 1, numOfRows: 2000, dataType: 'JSON', base_date: base.date, base_time: base.time, nx, ny
  });
  const data = await fetchJson(url, '기상청 단기예보');
  assertKma(data);
  return { base, items: normalizeItems(data?.response?.body?.items?.item) };
}

async function fetchLivingIndexSafely(endpoint, areaNo, rawKey, label) {
  if (!areaNo) return { status: 'missing_area_code', data: null };
  try {
    return { status: 'ok', data: await fetchLivingIndex(endpoint, areaNo, rawKey, label) };
  } catch (error) {
    return { status: 'unavailable', data: null, message: error?.message || String(error) };
  }
}

async function fetchLivingIndex(endpoint, areaNo, rawKey, label) {
  const base = endpoint.includes('AirDiffusion') ? airStagnationBaseTime() : livingIndexBaseTime();
  const requestTime = `${base.date}${base.time.slice(0, 2)}`;
  const url = dataGoUrl(`${KMA_LIVING_BASE}/${endpoint}`, rawKey, {
    pageNo: 1, numOfRows: 10, dataType: 'JSON', areaNo, time: requestTime
  });
  const data = await fetchJson(url, `기상청 ${label}`);
  assertPublicData(data, `기상청 ${label}`);
  const item = normalizeItems(data?.response?.body?.items?.item)[0];
  if (!item) throw new Error(`기상청 ${label} 응답에 예측값이 없습니다.`);

  const issued = String(item.date || requestTime).replace(/\D/g, '').slice(0, 10);
  if (issued.length !== 10) throw new Error(`기상청 ${label} 기준시각을 확인할 수 없습니다.`);
  const points = [];
  for (let offset = 0; offset <= 78; offset += 3) {
    const value = numberOrNull(item[`h${offset}`]);
    if (!Number.isFinite(value)) continue;
    points.push({ time: addHoursCompact(issued, offset), value });
  }
  if (!points.length) throw new Error(`기상청 ${label} 시간대 자료가 없습니다.`);
  return { issued_at: compactDateHourToIso(issued), interval_hours: 3, points };
}

async function fetchAirForecast(code, rawKey) {
  const url = dataGoUrl(`${AIR_BASE}/getMinuDustFrcstDspth`, rawKey, {
    returnType: 'json', numOfRows: 100, pageNo: 1, searchDate: kstDateParts().dateDashed, InformCode: code
  });
  const data = await fetchJson(url, `에어코리아 ${code} 예보`);
  assertPublicData(data, `에어코리아 ${code} 예보`);
  return normalizeItems(data?.response?.body?.items);
}

function buildWeatherPayload({ latitude, longitude, grid, areaNo, observation, forecast, uvIndex, airStagnation, lifeStatus }) {
  const grouped = new Map();
  for (const item of forecast.items) {
    if (!item.fcstDate || !item.fcstTime) continue;
    const time = compactToIso(item.fcstDate, item.fcstTime);
    const row = grouped.get(time) || { time };
    row[item.category] = numberOrText(item.fcstValue);
    grouped.set(time, row);
  }

  const rows = [...grouped.values()].sort((a, b) => a.time.localeCompare(b.time)).map(kmaRowToWeather);
  for (const row of rows) {
    row.is_day = isDaylight(row.time, latitude, longitude) ? 1 : 0;
    row.uv_index = row.is_day ? livingIndexValueAt(uvIndex, row.time) : 0;
    row.air_stagnation_index = livingIndexValueAt(airStagnation, row.time);
  }
  const nearest = rows.reduce((best, row) => !best || Math.abs(Date.parse(`${row.time}:00+09:00`) - Date.parse(`${observation.time}:00+09:00`)) < Math.abs(Date.parse(`${best.time}:00+09:00`) - Date.parse(`${observation.time}:00+09:00`)) ? row : best, null);
  const t = observation.values.temperature;
  const rh = observation.values.humidity;
  const windKmh = Number.isFinite(observation.values.windSpeed) ? observation.values.windSpeed * 3.6 : nearest?.wind_speed_10m ?? null;
  const dew = dewPoint(t, rh);
  const lifeIndexTime = currentKstHour();
  const current = {
    time: observation.time,
    temperature_2m: t,
    apparent_temperature: apparentTemperature(t, rh, Number.isFinite(windKmh) ? windKmh / 3.6 : null),
    relative_humidity_2m: rh,
    dew_point_2m: dew,
    precipitation: observation.values.precipitation1h,
    rain: observation.values.precipitationType > 0 ? observation.values.precipitation1h : 0,
    precipitation_probability: nearest?.precipitation_probability ?? null,
    weather_code: kmaWeatherCode(nearest?.SKY, observation.values.precipitationType),
    cloud_cover: nearest?.cloud_cover ?? null,
    wind_speed_10m: windKmh,
    wind_direction_10m: observation.values.windDirection,
    wind_gusts_10m: null,
    visibility: null,
    uv_index: isDaylight(lifeIndexTime, latitude, longitude) ? livingIndexValueAt(uvIndex, lifeIndexTime) : 0,
    air_stagnation_index: livingIndexValueAt(airStagnation, lifeIndexTime),
    is_day: isDaylight(lifeIndexTime, latitude, longitude) ? 1 : 0
  };

  const hourly = rowsToColumns(rows);
  const daily = buildDaily(rows, latitude, longitude, 7);
  return {
    source: '기상청 초단기실황·단기예보·생활기상지수',
    source_updated_at: `${forecast.base.date}T${forecast.base.time.slice(0, 2)}:00`,
    latitude, longitude, grid, area_no: areaNo, timezone: 'Asia/Seoul', current, hourly, daily,
    life_indices: {
      uv: lifeStatus.uv,
      air_stagnation: lifeStatus.air_stagnation,
      uv_error: lifeStatus.uv_error,
      air_stagnation_error: lifeStatus.air_stagnation_error,
      uv_issued_at: uvIndex?.issued_at || null,
      air_stagnation_issued_at: airStagnation?.issued_at || null,
      interval_hours: 3
    },
    limitations: {
      forecast_days: 4,
      uv_index: uvIndex ? '기상청 생활기상지수 3시간 단위 예측값' : '생활기상지수 조회 실패 또는 행정구역코드 없음',
      air_stagnation_index: airStagnation ? '기상청 생활기상지수 3시간 단위 예측값' : '생활기상지수 조회 실패 또는 행정구역코드 없음',
      wind_gusts: '단기예보 조회서비스에서 제공하지 않아 정보 없음으로 표시',
      days_5_to_7: '기상청 중기예보 API 추가 승인 전까지 정보 없음으로 표시'
    }
  };
}

function kmaRowToWeather(raw) {
  const temperature = numberOrNull(raw.TMP);
  const humidity = numberOrNull(raw.REH);
  const windMs = numberOrNull(raw.WSD);
  const precipitation = parsePrecipitation(raw.PCP);
  const pty = numberOrNull(raw.PTY);
  return {
    time: raw.time,
    temperature_2m: temperature,
    apparent_temperature: apparentTemperature(temperature, humidity, windMs),
    relative_humidity_2m: humidity,
    dew_point_2m: dewPoint(temperature, humidity),
    precipitation_probability: numberOrNull(raw.POP),
    precipitation,
    rain: pty > 0 ? precipitation : 0,
    weather_code: kmaWeatherCode(raw.SKY, pty),
    cloud_cover: skyToCloudCover(raw.SKY),
    visibility: null,
    wind_speed_10m: Number.isFinite(windMs) ? round(windMs * 3.6, 1) : null,
    wind_direction_10m: numberOrNull(raw.VEC),
    wind_gusts_10m: null,
    uv_index: null,
    air_stagnation_index: null,
    is_day: null,
    SKY: numberOrNull(raw.SKY),
    PTY: pty
  };
}

function rowsToColumns(rows) {
  const keys = ['time', 'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m', 'precipitation_probability', 'precipitation', 'rain', 'weather_code', 'cloud_cover', 'visibility', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'uv_index', 'air_stagnation_index', 'is_day'];
  return Object.fromEntries(keys.map(key => [key, rows.map(row => row[key] ?? null)]));
}

function buildDaily(rows, latitude, longitude, days) {
  const today = kstDateParts().dateDashed;
  const dates = Array.from({ length: days }, (_, index) => addDays(today, index));
  const grouped = new Map(dates.map(date => [date, rows.filter(row => row.time.startsWith(date))]));
  const columns = { time: [], weather_code: [], sunrise: [], sunset: [], uv_index_max: [], air_stagnation_index_max: [], precipitation_probability_max: [], temperature_2m_max: [], temperature_2m_min: [] };
  for (const date of dates) {
    const dayRows = grouped.get(date) || [];
    const temps = dayRows.map(row => row.temperature_2m).filter(Number.isFinite);
    const pops = dayRows.map(row => row.precipitation_probability).filter(Number.isFinite);
    const uvValues = dayRows.map(row => row.uv_index).filter(Number.isFinite);
    const stagnationValues = dayRows.map(row => row.air_stagnation_index).filter(Number.isFinite);
    const noon = dayRows.reduce((best, row) => !best || Math.abs(Number(row.time.slice(11, 13)) - 12) < Math.abs(Number(best.time.slice(11, 13)) - 12) ? row : best, null);
    const sun = sunriseSunset(date, latitude, longitude);
    columns.time.push(date);
    columns.weather_code.push(noon?.weather_code ?? null);
    columns.sunrise.push(sun.sunrise);
    columns.sunset.push(sun.sunset);
    columns.uv_index_max.push(uvValues.length ? Math.max(...uvValues) : null);
    columns.air_stagnation_index_max.push(stagnationValues.length ? Math.max(...stagnationValues) : null);
    columns.precipitation_probability_max.push(pops.length ? Math.max(...pops) : null);
    columns.temperature_2m_max.push(temps.length ? Math.max(...temps) : null);
    columns.temperature_2m_min.push(temps.length ? Math.min(...temps) : null);
  }
  return columns;
}

function latLonToGrid(latitude, longitude) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0;
  const OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136, DEGRAD = Math.PI / 180;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + latitude * DEGRAD * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = longitude * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

function ultraBaseTime() {
  const now = kstShiftedDate();
  if (now.getUTCMinutes() < 40) now.setUTCHours(now.getUTCHours() - 1);
  now.setUTCMinutes(0, 0, 0);
  return compactParts(now);
}

function villageBaseTime() {
  const now = kstShiftedDate();
  const candidates = [2, 5, 8, 11, 14, 17, 20, 23];
  const decimal = now.getUTCHours() + now.getUTCMinutes() / 60;
  const available = candidates.filter(hour => decimal >= hour + 0.35);
  if (available.length) {
    now.setUTCHours(available.at(-1), 0, 0, 0);
  } else {
    now.setUTCDate(now.getUTCDate() - 1);
    now.setUTCHours(23, 0, 0, 0);
  }
  return compactParts(now);
}

function livingIndexBaseTime() {
  const now = kstShiftedDate();
  let baseHour = Math.floor(now.getUTCHours() / 3) * 3;
  if (now.getUTCHours() % 3 === 0 && now.getUTCMinutes() < 40) baseHour -= 3;
  if (baseHour < 0) {
    now.setUTCDate(now.getUTCDate() - 1);
    baseHour += 24;
  }
  now.setUTCHours(baseHour, 0, 0, 0);
  return compactParts(now);
}

function airStagnationBaseTime() {
  const now = kstShiftedDate();
  let baseHour = Math.floor(now.getUTCHours() / 3) * 3 - 3;
  if (baseHour < 0) {
    now.setUTCDate(now.getUTCDate() - 1);
    baseHour += 24;
  }
  now.setUTCHours(baseHour, 0, 0, 0);
  return compactParts(now);
}

function kstShiftedDate() { return new Date(Date.now() + 9 * 60 * 60 * 1000); }
function currentKstHour() {
  const now = kstShiftedDate();
  now.setUTCMinutes(0, 0, 0);
  const parts = compactParts(now);
  return compactToIso(parts.date, parts.time);
}
function compactParts(date) {
  return {
    date: `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`,
    time: `${String(date.getUTCHours()).padStart(2, '0')}00`
  };
}
function kstDateParts() {
  const now = kstShiftedDate();
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return { date, dateDashed: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` };
}

function dataGoUrl(endpoint, rawKey, params) {
  const url = new URL(endpoint);
  url.searchParams.set('serviceKey', normalizeKey(rawKey));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url.toString();
}

async function fetchJson(url, label) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} HTTP 오류 (${response.status})`);
  try { return JSON.parse(text); }
  catch { throw new Error(`${label}가 JSON이 아닌 응답을 반환했습니다: ${text.slice(0, 180)}`); }
}

function assertKma(data) {
  const header = data?.response?.header;
  if (header?.resultCode !== '00') throw new Error(`기상청 API 오류: ${header?.resultMsg || header?.resultCode || '응답 형식 오류'}`);
}
function assertPublicData(data, label) {
  const header = data?.response?.header;
  const code = String(header?.resultCode ?? '');
  if (code && code !== '00' && code !== '0') throw new Error(`${label} API 오류: ${header?.resultMsg || code}`);
}

function corsHeaders(request, env) {
  const allowed = env.ALLOWED_ORIGIN || 'https://kdual.github.io';
  const origin = request.headers.get('Origin');
  const responseOrigin = origin === allowed || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '') ? origin : allowed;
  return { 'Access-Control-Allow-Origin': responseOrigin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}
function json(value, status, headers) { return new Response(JSON.stringify(value, null, 2), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } }); }
function normalizeKey(value) { try { return decodeURIComponent(String(value || '').trim()); } catch { return String(value || '').trim(); } }
function normalizeAreaNo(value) { const areaNo = String(value || '').replace(/\D/g, ''); return /^\d{10}$/.test(areaNo) ? areaNo : null; }
function normalizeItems(value) { if (Array.isArray(value)) return value; if (Array.isArray(value?.item)) return value.item; if (value && typeof value === 'object') return [value]; return []; }
function numberOrText(value) { if (value === null || value === undefined || value === '') return null; const number = Number(value); return Number.isFinite(number) ? number : String(value); }
function numberOrNull(value) { const number = Number(value); return value !== null && value !== '' && Number.isFinite(number) ? number : null; }
function round(value, digits = 1) { return Number.isFinite(value) ? Number(value.toFixed(digits)) : null; }
function compactToIso(date, time) { return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}`; }
function compactDateHourToIso(value) { return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:00`; }
function addHoursCompact(value, hours) {
  const base = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)), Number(value.slice(8, 10))));
  base.setUTCHours(base.getUTCHours() + hours);
  return base.toISOString().slice(0, 16);
}
function livingIndexValueAt(series, time) {
  if (!series?.points?.length) return null;
  const target = Date.parse(`${time}:00+09:00`);
  let selected = null;
  for (const point of series.points) {
    const pointTime = Date.parse(`${point.time}:00+09:00`);
    if (pointTime <= target && target < pointTime + series.interval_hours * 3600000) selected = point.value;
    if (pointTime > target) break;
  }
  return selected;
}
function isKoreanCoordinate(lat, lon) { return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 32 && lat <= 39.5 && lon >= 123 && lon <= 132; }
function parsePrecipitation(value) {
  if (value === null || value === undefined || value === '' || value === '강수없음') return 0;
  if (typeof value === 'number') return value;
  const text = String(value);
  if (text.includes('미만')) return 0.5;
  const numbers = text.match(/[\d.]+/g)?.map(Number).filter(Number.isFinite) || [];
  if (!numbers.length) return 0;
  return numbers.length > 1 ? round((numbers[0] + numbers[1]) / 2, 1) : numbers[0];
}
function dewPoint(temp, humidity) {
  if (!Number.isFinite(temp) || !Number.isFinite(humidity) || humidity <= 0) return null;
  const a = 17.625, b = 243.04;
  const gamma = Math.log(humidity / 100) + (a * temp) / (b + temp);
  return round((b * gamma) / (a - gamma), 1);
}
function apparentTemperature(temp, humidity, windMs) {
  if (!Number.isFinite(temp)) return null;
  const rh = Number.isFinite(humidity) ? humidity : 50;
  const wind = Number.isFinite(windMs) ? windMs : 0;
  const vapor = (rh / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
  return round(temp + 0.33 * vapor - 0.7 * wind - 4, 1);
}
function skyToCloudCover(sky) { const value = Number(sky); return value === 1 ? 10 : value === 3 ? 60 : value === 4 ? 100 : null; }
function kmaWeatherCode(sky, pty) {
  const precipitation = Number(pty);
  if ([3, 7].includes(precipitation)) return 71;
  if ([2, 6].includes(precipitation)) return 68;
  if ([1, 4, 5].includes(precipitation)) return 61;
  const cloud = Number(sky);
  return cloud === 1 ? 0 : cloud === 3 ? 2 : cloud === 4 ? 3 : null;
}
function normalizeSido(value) {
  const aliases = { 서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남', 전북특별자치도: '전북', 전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주' };
  return aliases[value] || value.replace(/[특별광역자치도시]/g, '') || '서울';
}
function selectStation(items, requested, district = '') {
  const clean = value => String(value || '')
    .replace(/\s+/g, '')
    .replace(/측정소$/, '')
    .replace(/[0-9·.\-]/g, '')
    .replace(/본동$/, '동');
  const target = clean(requested);
  if (!items.length) return { item: null, type: 'none' };
  if (!target) return { item: items[0], type: 'sido-first' };
  const exact = items.find(item => clean(item.stationName) === target);
  if (exact) return { item: exact, type: 'exact' };
  const fuzzy = items.find(item => clean(item.stationName).includes(target) || target.includes(clean(item.stationName)));
  if (fuzzy) return { item: fuzzy, type: 'fuzzy' };
  const aliases = { 시흥시: ['정왕동', '대야동', '배곧동', '장현동', '목감동'] };
  for (const alias of aliases[clean(district)] || []) {
    const item = items.find(candidate => clean(candidate.stationName) === clean(alias));
    if (item) return { item, type: 'district-fallback' };
  }
  return { item: null, type: 'none' };
}
function findNearestStation(stations, latitude, longitude) {
  let nearest = null;
  for (const station of stations) {
    const lat = Number(station.dmX), lon = Number(station.dmY);
    if (!isKoreanCoordinate(lat, lon) || !station.stationName) continue;
    const distance = haversineKm(latitude, longitude, lat, lon);
    if (!nearest || distance < nearest.distance_km) nearest = { ...station, distance_km: round(distance, 2) };
  }
  return nearest;
}
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function gradeForRegion(text, sido) {
  const target = normalizeSido(sido);
  for (const part of String(text || '').split(',')) {
    const [region, grade] = part.split(':').map(value => value.trim());
    if (normalizeSido(region || '') === target) return grade || null;
  }
  return null;
}
function representativeAirValue(pollutant, grade) {
  const table = pollutant === 'pm2_5'
    ? { 좋음: 8, 보통: 25, 나쁨: 55, 매우나쁨: 100 }
    : { 좋음: 20, 보통: 40, 나쁨: 80, 매우나쁨: 160 };
  return table[grade] ?? null;
}
function addDays(date, amount) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

// NOAA solar calculation. It is an astronomical calculation, not another weather provider.
function sunriseSunset(date, latitude, longitude) {
  const day = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.UTC(new Date(date).getUTCFullYear(), 0, 0)) / 86400000);
  const gamma = 2 * Math.PI / 365 * (day - 1);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const latRad = latitude * Math.PI / 180;
  const zenith = 90.833 * Math.PI / 180;
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, (Math.cos(zenith) / (Math.cos(latRad) * Math.cos(declination))) - Math.tan(latRad) * Math.tan(declination))));
  const delta = hourAngle * 180 / Math.PI * 4;
  const solarNoon = 720 - 4 * longitude - equation + 540;
  return { sunrise: minutesToIso(date, solarNoon - delta), sunset: minutesToIso(date, solarNoon + delta) };
}
function minutesToIso(date, minutes) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${date}T${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}
function isDaylight(time, latitude, longitude) {
  const date = time.slice(0, 10);
  const sun = sunriseSunset(date, latitude, longitude);
  return time >= sun.sunrise && time < sun.sunset;
}
