import { APP_CONFIG, SCORE_GRADES } from './running-score-config.js';
import { clamp, safe, dateOnly } from './utils.js';

function bandPenalty(value, idealLow, idealHigh, outerLow, outerHigh) {
  if (!Number.isFinite(value)) return 0;
  if (value >= idealLow && value <= idealHigh) return 0;
  if (value < idealLow) return clamp((idealLow - value) / Math.max(1, idealLow - outerLow), 0, 1);
  return clamp((value - idealHigh) / Math.max(1, outerHigh - idealHigh), 0, 1);
}

export function getGrade(score) { return SCORE_GRADES.find(g => score >= g.min) || SCORE_GRADES.at(-1); }

export function runningScoreDeductions(c = {}) {
  const w = APP_CONFIG.weights;
  const temp = safe(c.apparent_temperature, safe(c.temperature_2m));
  const tempP = bandPenalty(temp, 5, 16, -12, 34);
  const dewP = Number.isFinite(c.dew_point_2m) ? (c.dew_point_2m <= 10 ? 0 : clamp((c.dew_point_2m - 10) / 14)) : 0;
  const humidityP = Number.isFinite(c.relative_humidity_2m) ? (c.relative_humidity_2m <= 65 ? 0 : clamp((c.relative_humidity_2m - 65) / 35)) : 0;
  const rainP = Math.max(Number.isFinite(c.precipitation_probability) ? clamp((c.precipitation_probability - 15) / 75) : 0, Number.isFinite(c.precipitation) ? clamp(c.precipitation / 3) : 0);
  const windP = Math.max(Number.isFinite(c.wind_speed_10m) ? clamp((c.wind_speed_10m - 14) / 28) : 0, Number.isFinite(c.wind_gusts_10m) ? clamp((c.wind_gusts_10m - 25) / 40) : 0);
  const airP = Math.max(Number.isFinite(c.pm2_5) ? clamp((c.pm2_5 - 15) / 60) : 0, Number.isFinite(c.european_aqi) ? clamp((c.european_aqi - 20) / 100) : 0);
  const uvP = Number.isFinite(c.uv_index) && c.is_day !== 0 ? clamp((c.uv_index - 3) / 7) : 0;
  return { temperature:tempP*w.temperature, dewPoint:dewP*w.dewPoint, humidity:humidityP*w.humidity, rain:rainP*w.rain, wind:windP*w.wind, airQuality:airP*w.airQuality, uv:uvP*w.uv };
}

export function calculateRunningScore(c = {}) {
  const penalty = Object.values(runningScoreDeductions(c)).reduce((sum,value)=>sum+value,0);
  return Math.round(clamp(100 - penalty));
}

export function mergeHourly(weather, air) {
  const airIndex = new Map((air?.hourly?.time || []).map((t, i) => [t, i]));
  return (weather.hourly.time || []).map((time, i) => {
    const row = { time };
    for (const [key, values] of Object.entries(weather.hourly)) if (key !== 'time') row[key] = values[i];
    const ai = airIndex.get(time);
    if (ai !== undefined) for (const key of ['pm2_5','pm10','european_aqi']) row[key] = air.hourly[key]?.[ai] ?? null;
    row.score = calculateRunningScore(row);
    return row;
  });
}

export function currentConditions(weather, hourly) {
  const c = { ...weather.current };
  const nearest = hourly.reduce((best, row) => Math.abs(new Date(row.time) - new Date(weather.current.time)) < Math.abs(new Date(best.time) - new Date(weather.current.time)) ? row : best, hourly[0]);
  for (const key of ['precipitation_probability','uv_index','pm2_5','pm10','european_aqi','visibility']) c[key] = nearest?.[key] ?? null;
  c.score = calculateRunningScore(c);
  return c;
}

export function rowsForDate(hourly, date) { return hourly.filter(r => dateOnly(r.time) === date); }
export function runnableRows(rows) { return rows.filter(r => { const h = Number(r.time.slice(11,13)); return h >= APP_CONFIG.runningHours.start && h <= APP_CONFIG.runningHours.end; }); }

export function dailyScore(rows) {
  const eligible = runnableRows(rows).sort((a,b) => b.score-a.score).slice(0,4);
  return eligible.length ? Math.round(eligible.reduce((s,r)=>s+r.score,0)/eligible.length) : null;
}

export function findBestRunningTimes(rows, count = 3) {
  const eligible = runnableRows(rows);
  const blocks = eligible.map((row, i) => {
    const next = eligible[i+1];
    const consecutive = next && new Date(next.time)-new Date(row.time) === 3600000;
    const score = consecutive ? Math.round((row.score + next.score)/2) : row.score;
    return { start: row.time, end: consecutive ? next.time : row.time, score, duration: consecutive ? 2 : 1 };
  }).sort((a,b)=>b.score-a.score || b.duration-a.duration);
  const chosen=[];
  for (const block of blocks) {
    const overlap = chosen.some(c => dateOnly(c.start) === dateOnly(block.start) && Math.abs(new Date(c.start)-new Date(block.start)) < 7200000);
    if (!overlap) chosen.push(block);
    if (chosen.length === count) break;
  }
  return chosen;
}

export function workoutScores(c) {
  const base = calculateRunningScore(c);
  const heat = Math.max(0, (safe(c.apparent_temperature, 15)-18) * 1.4);
  const dew = Math.max(0, (safe(c.dew_point_2m, 8)-13) * 1.2);
  const rain = Math.max(0, safe(c.precipitation_probability,0)-40) * .08;
  return {
    Recovery: Math.round(clamp(base + 5 - rain*.4)),
    Easy: Math.round(clamp(base + 3 - rain*.5)),
    'Long Run': Math.round(clamp(base - heat*.35 - dew*.35 - rain)),
    Tempo: Math.round(clamp(base - heat*.7 - dew*.7 - rain*.8)),
    Interval: Math.round(clamp(base - heat - dew - rain*.7)),
    Race: Math.round(clamp(base - heat*1.15 - dew*1.1 - rain*.8))
  };
}
