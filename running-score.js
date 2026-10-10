import { APP_CONFIG } from './running-score-config.js?v=14';
import { clamp, safe, dateOnly } from './utils.js';
import { solarTimes, solarAltitude } from './solar-times.js?v=39';

const kst = date => new Date(date.getTime()+9*3600000).toISOString().slice(0,16);
const stamp = value => Date.parse(String(value||'').replace(' ','T').slice(0,16)+':00+09:00');
export const poorAir = c => (c.pm2_5>35)||(c.pm10>80)||(c.air_quality_index>100);
export function scoreMissing(c={}) {
  const missing=[];
  if(!Number.isFinite(c.apparent_temperature)&&!Number.isFinite(c.temperature_2m))missing.push('기온');
  for(const [key,label] of [['relative_humidity_2m','습도'],['wind_speed_10m','바람'],['dew_point_2m','이슬점'],['uv_index','UV']])if(!Number.isFinite(c[key]))missing.push(label);
  if(!Number.isFinite(c.precipitation)&&!Number.isFinite(c.precipitation_probability))missing.push('강수');
  if(!Number.isFinite(c.pm2_5)&&!Number.isFinite(c.pm10)&&!Number.isFinite(c.air_quality_index))missing.push('대기질');
  if(c.is_day===1&&!Number.isFinite(c.cloud_cover))missing.push('구름량(햇빛 추정 제한)');
  return missing;
}
function assessed(c) { return {...c,deductions:runningScoreDeductions(c),score:calculateRunningScore(c),missing:scoreMissing(c)}; }

function bandPenalty(value, idealLow, idealHigh, outerLow, outerHigh) {
  if (!Number.isFinite(value)) return 0;
  if (value >= idealLow && value <= idealHigh) return 0;
  if (value < idealLow) return clamp((idealLow - value) / Math.max(1, idealLow - outerLow), 0, 1);
  return clamp((value - idealHigh) / Math.max(1, outerHigh - idealHigh), 0, 1);
}

export function runningScoreDeductions(c = {}) {
  const w = APP_CONFIG.weights;
  const temp = safe(c.apparent_temperature, safe(c.temperature_2m));
  // Preserve the existing comfort band; severe heat/cold must continue worsening, not plateau.
  const extreme=Number.isFinite(temp)?Math.max(clamp((temp-34)/6,0,1),clamp((-12-temp)/12,0,1)):0;
  const tempP = bandPenalty(temp, 5, 16, -12, 34)+extreme;
  const dewP = Number.isFinite(c.dew_point_2m) ? (c.dew_point_2m <= 10 ? 0 : clamp((c.dew_point_2m - 10) / 14,0,1)) : 0;
  const humidityP = Number.isFinite(c.relative_humidity_2m) ? clamp((c.relative_humidity_2m-65)/35,0,1)*clamp((temp-10)/15,0,1) : 0;
  // Moisture is one component: never add dew-point and RH penalties together.
  // Apparent temperature already incorporates humidity; this residual remains a heuristic for running evaporation.
  const dewPenalty=dewP*w.dewPoint,humidityPenalty=humidityP*w.humidity;
  const moisture=Math.max(dewPenalty,humidityPenalty);
  const rainP = Math.max(Number.isFinite(c.precipitation_probability) ? clamp((c.precipitation_probability - 15) / 75,0,1) : 0, Number.isFinite(c.precipitation) ? clamp(c.precipitation / 3,0,1) : 0);
  const windP = Math.max(Number.isFinite(c.wind_speed_10m) ? clamp((c.wind_speed_10m - 14) / 28,0,1) : 0, Number.isFinite(c.wind_gusts_10m) ? clamp((c.wind_gusts_10m - 25) / 40,0,1) : 0);
  const airP = Math.max(Number.isFinite(c.pm10) ? clamp((c.pm10 - 30) / 120,0,1) : 0, Number.isFinite(c.pm2_5) ? clamp((c.pm2_5 - 15) / 60,0,1) : 0, Number.isFinite(c.air_quality_index) ? clamp((c.air_quality_index - 50) / 200,0,1) : 0);
  const uvP = Number.isFinite(c.uv_index) && c.is_day !== 0 ? clamp((c.uv_index - 3) / 7,0,1) : 0;
  // UV reflects skin exposure, not all solar heat. Estimate heat exposure on an unshaded route
  // from solar geometry/cloud conditions; UV is only a fallback when location is absent.
  const altitude=solarAltitude(c.time,c.latitude,c.longitude);
  const daylightFactor=Number.isFinite(altitude)?Math.max(0,Math.sin(altitude*Math.PI/180)):0;
  const uvSun=Number.isFinite(c.uv_index)?clamp((c.uv_index-1)/7,0,1):0;
  const skySun=Number.isFinite(c.cloud_cover)?clamp((100-c.cloud_cover)/90,0,1)*daylightFactor*.8:uvSun;
  const sunlight=Number.isFinite(altitude)?skySun:uvSun;
  const exposure=1-clamp(Number.isFinite(c.route_shade)?c.route_shade:0,0,1);
  const sunExposure=c.is_day===1&&Number.isFinite(temp)?18*clamp((temp-20)/10,0,1)*sunlight*exposure:0;
  return { temperature:tempP*w.temperature, sunExposure, dewPoint:dewPenalty>=humidityPenalty?moisture:0, humidity:humidityPenalty>dewPenalty?moisture:0, rain:rainP*w.rain, wind:windP*w.wind, airQuality:airP*w.airQuality, uv:uvP*w.uv };
}

export function calculateRunningScore(c = {}) {
  if(scoreMissing(c).some(label=>['기온','습도','바람'].includes(label)))return null;
  const penalty = Object.values(runningScoreDeductions(c)).reduce((sum,value)=>sum+value,0);
  return Math.round(clamp(100 - penalty));
}

export function mergeHourly(weather, air, forecastData = null, options = {}) {
  const airDate=air?.current?.measured_at?.slice(0,10);
  const airForecast=new Map((forecastData?.daily||air?.daily||[]).map(row=>[row.date,row]));
  return (weather.hourly.time || []).map((time, i) => {
    const row = { time, latitude:weather.latitude,longitude:weather.longitude,route_shade:options.routeShade??0 };
    for (const [key, values] of Object.entries(weather.hourly)) if (key !== 'time') row[key] = values[i];
    const nextGap=(stamp(weather.hourly.time[i+1])-stamp(time))/3600000;
    row.forecast_interval_hours=nextGap>=1&&nextGap<=3?nextGap:1;
    const date=dateOnly(time);
    const sun=solarTimes(date,Number(row.latitude),Number(row.longitude));
    if(sun){row.is_day=time>=sun.sunrise&&time<sun.sunset?1:0;if(row.is_day===0)row.uv_index=0;}
    const measuredHour=Date.parse(String(air?.current?.measured_at||'').replace(' ','T')+':00+09:00');
    const forecastHour=Date.parse(`${time}:00+09:00`);
    if(air?.current&&date===airDate&&Number.isFinite(measuredHour)&&Math.abs(forecastHour-measuredHour)<=3600000){
      row.pm2_5=air.current.pm2_5;row.pm10=air.current.pm10;row.air_quality_index=air.current.air_quality_index;row.air_quality_estimated=false;
    }else{
      const forecast=airForecast.get(date);
      row.pm2_5=null;row.pm10=null;row.air_quality_index=airGradeIndex(forecast?.pm2_5_grade,forecast?.pm10_grade);row.air_quality_estimated=Boolean(forecast?.pm2_5_grade||forecast?.pm10_grade);
      row.air_forecast_grade=forecast?.pm2_5_grade||forecast?.pm10_grade||null;
    }
    return assessed(row);
  });
}

function airGradeIndex(pm25,pm10){
  const grade={좋음:25,보통:75,나쁨:125,매우나쁨:200};
  const values=[grade[pm25],grade[pm10]].filter(Number.isFinite);
  return values.length?Math.max(...values):null;
}

export function currentConditions(weather, hourly, air = null, now = new Date(), location = weather, options = {}) {
  const c = { ...weather.current,latitude:location.latitude,longitude:location.longitude,route_shade:options.routeShade??0, observation_time:weather.current.time, time:kst(now) };
  const hour=c.time.slice(0,13)+':00';
  const nearest=hourly.find(row=>row.time===hour);
  for(const key of ['precipitation_probability','uv_index','air_stagnation_index','visibility']) {
    if(!Number.isFinite(c[key]))c[key]=nearest?.[key]??null;
  }
  const sun=solarTimes(dateOnly(c.time),Number(location.latitude),Number(location.longitude));
  if(sun)c.is_day=c.time>=sun.sunrise&&c.time<sun.sunset?1:0;
  if(c.is_day===0)c.uv_index=0;
  const measured=stamp(air?.current?.measured_at),age=now.getTime()-measured;
  const fresh=Number.isFinite(age)&&age>=-5*60000&&age<3*3600000;
  for(const key of ['pm2_5','pm10','air_quality_index'])c[key]=fresh?air?.current?.[key]??null:null;
  c.air_quality_estimated=false;
  const result=assessed(c),weatherAge=now.getTime()-stamp(c.observation_time);
  if(!Number.isFinite(weatherAge)||weatherAge>2*3600000||weatherAge<0){result.score=null;result.missing.push('최신 기상 관측');}
  return result;
}

export function includeCurrentObservation(hourly, current, now = new Date()) {
  const observationTime=String(current?.observation_time||current?.time||'');
  const measuredAt=Date.parse(`${observationTime}:00+09:00`);
  const age=now.getTime()-measuredAt;
  if(!Number.isFinite(age)||age<0||age>2*3600000)return hourly;
  const currentHour=new Date(now.getTime()+9*3600000).toISOString().slice(0,13)+':00';
  return hourly.map(row=>row.time===currentHour?{
    ...row,...current,time:row.time,score:current.score,
    observed:true,observation_time:observationTime,
    air_quality_estimated:false,air_forecast_grade:null
  }:row);
}

export function rowsForDate(hourly, date) { return hourly.filter(r => dateOnly(r.time) === date); }
export function runnableRows(rows) { return rows.filter(r => { const h = Number(r.time.slice(11,13)); return h >= APP_CONFIG.runningHours.start && h <= APP_CONFIG.runningHours.end; }); }

// Apply each forecast to its stated interval (up to 3 hours), without interpolating weather values.
export function hourlySlots(rows) {
  const sorted=[...rows].sort((a,b)=>a.time.localeCompare(b.time)),slots=[];
  sorted.forEach((r,i)=>{
    const gap=(stamp(sorted[i+1]?.time)-stamp(r.time))/3600000;
    const hours=gap>=1&&gap<=3?gap:(r.forecast_interval_hours>=1&&r.forecast_interval_hours<=3?r.forecast_interval_hours:1);
    for(let h=0;h<hours;h++)slots.push({...r,time:kst(new Date(stamp(r.time)+h*3600000)),forecast_interval_hours:hours});
  });
  return runnableRows(slots).filter(r=>Number.isFinite(r.score));
}
export function dailyCoverage(rows) { return {hours:hourlySlots(rows).length,total:19,coarse:rows.some((r,i)=>r.forecast_interval_hours>1||stamp(rows[i+1]?.time)-stamp(r.time)>3600000)}; }
export function dailyScore(rows) {
  const eligible=hourlySlots(rows).sort((a,b)=>b.score-a.score).slice(0,4);
  return eligible.length?Math.round(eligible.reduce((s,r)=>s+r.score,0)/eligible.length):null;
}
export function findBestRunningTimes(rows, count = 3, durationMinutes = 120, now = new Date()) {
  const eligible=hourlySlots(rows),nowStamp=now.getTime();
  const candidates=new Set(eligible.map(r=>stamp(r.time)));
  const soon=Math.ceil(nowStamp/(5*60000))*5*60000;
  if(eligible.some(r=>stamp(r.time)<=soon&&soon<stamp(r.time)+3600000))candidates.add(soon);
  const blocks=[];
  for(const start of candidates){
    if(start<nowStamp)continue;
    const end=start+durationMinutes*60000;
    let covered=0,weighted=0;
    for(const r of eligible){const overlap=Math.max(0,Math.min(end,stamp(r.time)+3600000)-Math.max(start,stamp(r.time)));covered+=overlap;weighted+=overlap*r.score;}
    if(covered!==end-start)continue;
    blocks.push({start:kst(new Date(start)),end:kst(new Date(end)),score:Math.round(weighted/covered),durationMinutes,duration:durationMinutes/60});
  }
  blocks.sort((a,b)=>b.score-a.score||a.start.localeCompare(b.start));
  const chosen=[];
  for(const block of blocks){
    if(!chosen.some(c=>stamp(block.start)<stamp(c.end)&&stamp(c.start)<stamp(block.end)))chosen.push(block);
    if(chosen.length===count)break;
  }
  return chosen;
}

export function workoutScores(c) {
  const base = calculateRunningScore(c);
  if(!Number.isFinite(base))return Object.fromEntries(['Recovery','Easy','Long Run','Tempo','Interval','Race'].map(key=>[key,null]));
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
