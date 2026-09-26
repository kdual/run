import { APP_CONFIG } from './running-score-config.js?v=14';
import { ensureAreaCode, fetchWeather, reverseGeocode, searchLocations } from './weather.js?v=19';
import { fetchAirQuality } from './air-quality.js?v=19';
import { getStored, setStored, getCache, setCache } from './storage.js?v=19';
import { currentConditions, dailyScore, findBestRunningTimes, mergeHourly, rowsForDate, runnableRows, runningScoreDeductions, workoutScores } from './running-score.js?v=20';
import { coachMessage, environmentAlerts, gearAdvice, runNowMessage } from './running-coach.js?v=14';
import { fromPace, fromSpeed, paceTableRows, renderPace } from './pace-calculator.js';
import { renderHourlyChart } from './charts.js?v=12';
import { solarTimes } from './solar-times.js?v=21';
import { dateOnly, escapeHtml, formatValue, monthDay, parseClock, round, secondsToClock, timeOnly, weatherSymbol, weekday } from './utils.js';

const $ = id => document.getElementById(id);
const state = { duration:getStored('runDuration',60), location:getStored('location',APP_CONFIG.defaultLocation), selectedLocation:null, data:null, hourlyDay:0, hourlyKey:null, dateKey:currentSeoulDate(), calcMode:'pace', controller:null, map:null, marker:null };

function setTheme(theme){document.documentElement.dataset.theme=theme;setStored('theme',theme);$('themeButton').setAttribute('aria-label',theme==='dark'?'라이트 모드 전환':'다크 모드 전환');}
setTheme(getStored('theme',matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));

function setLoading(isLoading){$('refreshButton').disabled=isLoading;$('refreshButton').textContent=isLoading?'…':'↻';}
function showError(message){$('errorBanner').textContent=message;$('errorBanner').hidden=!message;}
function nowSeoul(){return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());}
function currentSeoulDate(date=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function addCalendarDays(date,days){const [year,month,day]=date.split('-').map(Number);return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10);}
function updateClock(){$('headerClock').textContent=nowSeoul();const dateKey=currentSeoulDate(),hourKey=currentSeoulHour(),minuteKey=currentSeoulMinute();if(state.dateKey!==dateKey){state.dateKey=dateKey;state.hourlyDay=0;loadData(true);return;}if(state.data&&state.hourlyKey!==hourKey)renderHourly();if(state.data&&state.minuteKey!==minuteKey){state.minuteKey=minuteKey;renderSunStatus();}}
updateClock();setInterval(updateClock,1000);

async function loadData(force=false){
  state.controller?.abort();const controller=new AbortController();state.controller=controller;setLoading(true);showError('');
  if(!state.location.areaNo){try{state.location=await ensureAreaCode(state.location);setStored('location',state.location);}catch{/* 일반 날씨는 행정구역코드 없이도 조회 가능 */}}
  $('headerLocation').textContent=state.location.name;
  const cached=getCache(state.location);const fresh=cached&&currentSeoulDate(new Date(cached.savedAt))===currentSeoulDate()&&Date.now()-cached.savedAt<APP_CONFIG.cacheMinutes*60000;
  if(!force&&fresh){state.data={...cached.payload,airPending:false,savedAt:cached.savedAt,fromCache:true};render();}
  const forecastPromise=fetch(`${APP_CONFIG.apiBaseUrl}/air/forecast?sidoName=${encodeURIComponent(state.location.region1||'서울')}`,{signal:controller.signal}).then(r=>r.ok?r.json():null).catch(()=>null);
  const alertsPromise=fetch(`${APP_CONFIG.apiBaseUrl}/air/alerts?sidoName=${encodeURIComponent(state.location.region1||'서울')}&districtName=${encodeURIComponent(state.location.region2||'')}`,{signal:controller.signal}).then(r=>r.ok?r.json():null).catch(()=>null);
  const airPromise=fetchAirQuality(state.location,controller.signal).then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}));
  try{
    const weather=await fetchWeather(state.location,controller.signal);if(controller.signal.aborted)return;
    const interimAir=cached?.payload?.air||null;
    state.data={weather,air:interimAir,forecast:cached?.payload?.forecast||null,officialAlerts:cached?.payload?.officialAlerts||null,airError:false,airPending:true,savedAt:Date.now(),fromCache:false};render();
    const airResult=await airPromise;if(controller.signal.aborted)return;
    const payload={weather,air:airResult.status==='fulfilled'?airResult.value:interimAir,forecast:state.data.forecast,officialAlerts:state.data.officialAlerts,airError:airResult.status==='rejected',airStale:airResult.status==='rejected'&&Boolean(interimAir)};
    setCache(state.location,payload);state.data={...payload,airPending:false,savedAt:Date.now(),fromCache:false};render();
    Promise.all([forecastPromise,alertsPromise]).then(([forecast,officialAlerts])=>{if(controller.signal.aborted)return;payload.forecast=forecast||payload.forecast;payload.officialAlerts=officialAlerts||payload.officialAlerts;setCache(state.location,payload);state.data={...payload,airPending:false,savedAt:Date.now(),fromCache:false};render();});
    const warnings=[];
    if(payload.airError)warnings.push(payload.airStale?'에어코리아 최신 조회에 실패해 저장된 대기질을 표시합니다.':'에어코리아 대기질 데이터를 가져오지 못했습니다.');
    if(payload.weather.life_indices?.uv!=='ok'||payload.weather.life_indices?.air_stagnation!=='ok')warnings.push('기상청 UV 또는 대기정체지수를 가져오지 못했습니다. 생활기상지수 승인 상태와 지역코드를 확인해 주세요.');
    if(warnings.length)showError(`일반 날씨는 정상 표시 중입니다. ${warnings.join(' ')}`);
  }catch(error){
    if(error.name==='AbortError')return;
    if(cached){state.data={...cached.payload,airPending:false,savedAt:cached.savedAt,fromCache:true};render();showError('새 데이터를 가져오지 못해 마지막 저장 데이터를 표시합니다.');}
    else showError(`날씨 데이터를 가져오지 못했습니다. 네트워크 연결을 확인해 주세요. (${error.message})`);
  }finally{if(state.controller===controller)setLoading(false);}
}

function render(){
  const {weather,air}=state.data;const hourly=mergeHourly(weather,air,state.data.forecast);const current=currentConditions(weather,hourly,air);const today=currentSeoulDate();const nowHour=currentSeoulHour();const todayRows=rowsForDate(hourly,today);const futureTodayRows=todayRows.filter(row=>row.time>=nowHour);const tomorrow=addCalendarDays(today,1);const tomorrowRows=rowsForDate(hourly,tomorrow);const best=findBestRunningTimes(futureTodayRows,3,state.duration);const futureBest=best[0];const todayScore=dailyScore(todayRows);const tomorrowScore=dailyScore(tomorrowRows);
  state.computed={hourly,current,today,todayRows,futureTodayRows,tomorrowRows,best,todayScore,tomorrowScore};
  renderHero(current,best,todayScore,futureBest);renderCurrent(current,weather);renderBest(best);renderHourly();renderComparison(todayScore,tomorrowScore,todayRows,tomorrowRows);renderCoach(current,futureBest);renderWeekly(weather,hourly);renderWorkouts(current);renderGear(current);
  $('updatedAt').textContent=`업데이트 ${new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit'}).format(new Date(state.data.savedAt))}${state.data.fromCache?' · 저장 데이터':''}`;
  const station=air?.current?.station_name;const measured=air?.current?.measured_at;
  const living=weather.life_indices;const livingReady=living?.uv==='ok'||living?.air_stagnation==='ok';
  const airSource=state.data.airPending?' · 에어코리아 갱신 중':station?` · 에어코리아 ${station} 측정소${measured?` ${measured} 측정`:''}`:' · 대기질 정보 없음';
  $('observationSource').textContent=`기상청 관측${livingReady?'·생활기상지수':''}${airSource}`;$('airSourceDetail').textContent=station?`PM 실측: ${station} · ${measured||'측정 시각 없음'}${Number.isFinite(air?.station_distance_km)?` · 약 ${air.station_distance_km}km`:''}. 3시간이 지나면 현재 점수에서 제외합니다.`:'PM 실측 측정소 또는 값이 확인되지 않았습니다.';$('forecastSourceDetail').textContent=state.data.forecast?.daily?.length?`미래 대기질: 에어코리아 ${state.data.forecast.sido_name} 권역 일일 예보 등급 (시간별 농도 아님)`:'미래 대기질: 권역 예보 없음 · 점수에 대기질 반영 안 함';
  $('offlineBanner').hidden=navigator.onLine;
}

function renderHero(c,best,todayScore,futureBest){const condition=scoreCondition(c.score),todayCondition=scoreCondition(todayScore);$('top').dataset.condition=condition.key;$('currentScore').classList.remove('skeleton-text');$('currentScore').textContent=c.score;$('currentGrade').textContent=condition.label;$('currentGrade').className=`grade-pill condition-${condition.key}`;$('runNowMessage').textContent=runNowMessage(c,futureBest);$('currentScoreFactors').innerHTML=factorChips([{...c,time:currentSeoulHour()}]);$('heroTemp').textContent=formatValue(c.temperature_2m,'°C',1);$('heroFeels').textContent=formatValue(c.apparent_temperature,'°C',1);$('heroHumidity').textContent=formatValue(c.relative_humidity_2m,'%',0);$('heroDew').textContent=formatValue(c.dew_point_2m,'°C',1);$('todayBestScore').textContent=best[0]?`${best[0].score}점`:'--점';$('todayBestTime').textContent=best[0]?`BEST TIME ${timeOnly(best[0].start)}–${endLabel(best[0])}`:'오늘 남은 추천 시간 없음';$('todayScore').textContent=todayScore??'--';$('todayGrade').textContent=todayCondition.label;$('todayGrade').className=`condition-text-${todayCondition.key}`;$('todaySummary').textContent=best[0]?`앞으로는 ${timeOnly(best[0].start)} 전후가 가장 유리합니다.`:'오늘 남은 추천 시간대가 없습니다.';$('scoreRing').style.setProperty('--score',todayScore??0);}
function endLabel(block){const d=new Date(Date.parse(`${block.start}:00+09:00`)+block.durationMinutes*60000);return String((d.getUTCHours()+9)%24).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');}
function renderBest(best){const medals=['🥇','🥈','🥉'];$('bestTimes').innerHTML=best.length?best.map((b,i)=>`<li><span class="medal">${medals[i]}</span><span><strong>${timeOnly(b.start)}–${endLabel(b)}</strong><small>${b.durationMinutes}분 추천 구간${b.durationMinutes===30?' · 시간별 예보 기반':''}</small></span><span class="point">${b.score}점</span></li>`).join(''):'<li class="best-empty"><span>오늘 남은 추천 시간대가 없습니다.</span></li>';}

function renderCurrent(c,w){const overall=scoreCondition(c.score);$('currentWeatherCard').dataset.condition=overall.key;$('currentWeatherCondition').className=`score-condition-badge condition-${overall.key}`;$('currentWeatherCondition').textContent=`${c.score}점 · ${overall.label}`;$('weatherIcon').textContent=weatherSymbol(c.weather_code);const items=[['temperature_2m','기온',formatValue(c.temperature_2m,'°C',1),c.temperature_2m],['apparent_temperature','체감',formatValue(c.apparent_temperature,'°C',1),c.apparent_temperature],['relative_humidity_2m','습도',formatValue(c.relative_humidity_2m,'%'),c.relative_humidity_2m],['dew_point_2m','이슬점',formatValue(c.dew_point_2m,'°C',1),c.dew_point_2m],['precipitation_probability','강수확률',formatValue(c.precipitation_probability,'%'),c.precipitation_probability],['precipitation','강수량',formatValue(c.precipitation,' mm',1),c.precipitation],['wind_speed_10m','바람',formatValue(c.wind_speed_10m,' km/h',1),c.wind_speed_10m],['air_stagnation_index','대기정체',formatValue(c.air_stagnation_index,'',0),c.air_stagnation_index],['pm2_5','PM2.5',formatValue(c.pm2_5,' μg/m³',1),c.pm2_5],['pm10','PM10',formatValue(c.pm10,' μg/m³',1),c.pm10],['air_quality_index','통합대기지수',formatValue(c.air_quality_index,''),c.air_quality_index],['uv_index','UV',formatValue(c.uv_index,'',1),c.uv_index]];const airKeys=new Set(['pm2_5','pm10','air_quality_index']);$('weatherMetrics').innerHTML=items.map(([key,label,value,raw])=>{const pending=state.data?.airPending&&airKeys.has(key)&&!Number.isFinite(raw);const condition=pending?{key:'unknown',label:'갱신 중'}:conditionFor(key,raw);return`<div class="metric condition-${condition.key}"><span>${label}</span><strong>${pending?'불러오는 중':value}</strong><em>${condition.label}</em></div>`;}).join('');renderSunTimes();}

function sunForDate(date){
  const computed=solarTimes(date,Number(state.location.latitude),Number(state.location.longitude));
  if(!computed)return null;
  return computed;
}
function renderSunTimes(){
  const today=currentSeoulDate(),sun=sunForDate(today);state.todaySun=sun;
  const ids={astronomical_dawn:'astronomicalDawn',nautical_dawn:'nauticalDawn',sunrise:'sunrise',sunset:'sunset',nautical_dusk:'nauticalDusk',astronomical_dusk:'astronomicalDusk'};
  for(const [key,id] of Object.entries(ids))$(id).textContent=sun?.[key]?timeOnly(sun[key]):'--:--';
  renderSunStatus();
}
function renderSunStatus(){
  const sun=state.todaySun,now=currentSeoulMinute();if(!sun){$('sunStatus').textContent='일출·일몰 시각을 계산할 수 없습니다.';return;}
  const countdown=target=>{const minutes=Math.max(0,Math.ceil((Date.parse(`${target}:00+09:00`)-Date.parse(`${now}:00+09:00`))/60000));return `${Math.floor(minutes/60)}시간 ${minutes%60}분`;};
  const nextDawn=sunForDate(addCalendarDays(currentSeoulDate(),1))?.astronomical_dawn;
  let message;
  if(now<(sun.astronomical_dawn||sun.sunrise))message=`첫빛까지 ${countdown(sun.astronomical_dawn||sun.sunrise)} · 새벽 러닝에는 조명을 준비하세요.`;
  else if(now<(sun.nautical_dawn||sun.sunrise))message=`새벽빛이 시작됐습니다 · 일출까지 ${countdown(sun.sunrise)}.`;
  else if(now<sun.sunrise)message=`항해박명(BMNT) 이후 · 일출까지 ${countdown(sun.sunrise)}.`;
  else if(now<sun.sunset)message=`일몰까지 ${countdown(sun.sunset)} · 어두워지기 전 안전 장비를 확인하세요.`;
  else if(now<(sun.nautical_dusk||sun.astronomical_dusk))message=`일몰 후 박명 · 완전한 어둠까지 ${countdown(sun.astronomical_dusk||sun.nautical_dusk)}.`;
  else if(now<sun.astronomical_dusk)message=`항해박명 종료(EENT) 이후 · 완전한 어둠까지 ${countdown(sun.astronomical_dusk)}.`;
  else message=nextDawn?`완전한 어둠 · 내일 첫빛까지 ${countdown(nextDawn)}. 반사 장비와 조명을 챙기세요.`:'완전한 어둠 · 반사 장비와 조명을 챙기세요.';
  $('sunStatus').textContent=message;
}


function currentSeoulMinute(){return new Date().toLocaleString('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).replace(' ','T');}
function currentSeoulHour(){return currentSeoulMinute().slice(0,13)+':00';}
function renderHourly(){const compact=matchMedia('(max-width:700px)').matches;const allRows=state.hourlyDay===0?state.computed.todayRows:state.computed.tomorrowRows;const nowHour=currentSeoulHour();state.hourlyKey=nowHour;const rows=compact&&state.hourlyDay===0&&dateOnly(nowHour)===state.computed.today?allRows.filter(r=>r.time>=nowHour):allRows;renderHourlyChart($('hourlyChart'),rows,renderHourlyDetail,{compact});$('hourlyTextAlternative').textContent=rows.map(r=>`${timeOnly(r.time)} ${r.score}점`).join(', ');if(rows.length)renderHourlyDetail(rows[0]);else $('hourlyDetail').innerHTML=`<p class="muted">${state.hourlyDay===0?'오늘 남은 시간대':'선택한 날짜'}의 기상청 예보가 없습니다.</p>`;const nextButton=$('hourlyNextDay');nextButton.hidden=!(compact&&state.hourlyDay===0&&rows.length<=3);document.querySelectorAll('[data-hourly-day]').forEach((b,i)=>{b.classList.toggle('active',i===state.hourlyDay);b.setAttribute('aria-selected',String(i===state.hourlyDay));});}
function conditionFor(key,value){if(!Number.isFinite(value))return{key:'unknown',label:'정보 없음'};if(key==='air_stagnation_index'){if(value<=25)return{key:'good',label:'낮음'};if(value<=50)return{key:'normal',label:'보통'};if(value<=75)return{key:'bad',label:'높음'};return{key:'very-bad',label:'매우 높음'};}if(key==='uv_index'){if(value<=2)return{key:'good',label:'낮음'};if(value<=5)return{key:'normal',label:'보통'};if(value<=7)return{key:'bad',label:'높음'};return{key:'very-bad',label:value>=11?'위험':'매우 높음'};}const rules={temperature_2m:[[5,18],[0,23],[-5,29]],apparent_temperature:[[5,18],[0,23],[-5,29]],relative_humidity_2m:[[30,60],[20,70],[10,82]],dew_point_2m:[[-30,10],[-30,15],[-30,20]],precipitation_probability:[[0,10],[0,30],[0,60]],precipitation:[[0,0],[0,.5],[0,2]],wind_speed_10m:[[0,12],[0,20],[0,30]],wind_gusts_10m:[[0,20],[0,30],[0,45]],pm2_5:[[0,15],[0,35],[0,75]],pm10:[[0,30],[0,50],[0,100]],air_quality_index:[[0,50],[0,100],[0,250]]};const bands=rules[key];if(!bands)return{key:'unknown',label:'참고'};if(value>=bands[0][0]&&value<=bands[0][1])return{key:'good',label:'좋음'};if(value>=bands[1][0]&&value<=bands[1][1])return{key:'normal',label:'보통'};if(value>=bands[2][0]&&value<=bands[2][1])return{key:'bad',label:'안좋음'};return{key:'very-bad',label:'아주 안좋음'};}
function scoreCondition(score){if(!Number.isFinite(score))return{key:'unknown',label:'정보 없음'};if(score>=90)return{key:'good',label:'좋음'};if(score>=75)return{key:'normal',label:'보통'};if(score>=60)return{key:'bad',label:'안좋음'};return{key:'very-bad',label:'아주 안좋음'};}
function scoreFactors(rows){const basis=runnableRows(rows).sort((a,b)=>b.score-a.score).slice(0,4);if(!basis.length)return [];const keys=[['temperature','체감'],['dewPoint','이슬점'],['humidity','습도'],['rain','강수'],['wind','바람'],['airQuality','대기질'],['uv','자외선']];return keys.map(([key,label])=>({label,loss:Math.round(basis.reduce((n,r)=>n+runningScoreDeductions(r)[key],0)/basis.length)})).filter(f=>f.loss>0).sort((a,b)=>b.loss-a.loss).slice(0,3);}
function factorChips(rows){const factors=scoreFactors(rows);return factors.length?factors.map(f=>`<span class="factor-chip">${f.label} −${f.loss}</span>`).join(''):'<span class="factor-chip favorable">큰 감점 없음</span>';}
function renderHourlyDetail(r){const overall=scoreCondition(r.score);const date=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(`${r.time}:00+09:00`));const metrics=[['temperature_2m','기온',formatValue(r.temperature_2m,'°C',1),r.temperature_2m],['apparent_temperature','체감',formatValue(r.apparent_temperature,'°C',1),r.apparent_temperature],['relative_humidity_2m','습도',formatValue(r.relative_humidity_2m,'%'),r.relative_humidity_2m],['dew_point_2m','이슬점',formatValue(r.dew_point_2m,'°C',1),r.dew_point_2m],['precipitation_probability','강수확률',formatValue(r.precipitation_probability,'%'),r.precipitation_probability],['wind_speed_10m','바람',formatValue(r.wind_speed_10m,' km/h',1),r.wind_speed_10m],['uv_index','UV',formatValue(r.uv_index,'',1),r.uv_index],['air_stagnation_index','대기정체',formatValue(r.air_stagnation_index,'',0),r.air_stagnation_index],['pm2_5','PM2.5 실측',formatValue(r.pm2_5,' μg/m³',1),r.pm2_5],['air_quality_index',r.air_quality_estimated?'권역 PM 예보 등급':'통합대기지수',r.air_quality_estimated?r.air_forecast_grade||'정보 없음':formatValue(r.air_quality_index,''),r.air_quality_estimated?null:r.air_quality_index]];$('hourlyDetail').innerHTML=`<div class="hourly-detail-heading"><strong>${date} ${timeOnly(r.time)} 상세 지표</strong><span class="hourly-score condition-${overall.key}">${r.score}점 · ${overall.label}</span></div><div class="condition-legend"><span class="condition-good">좋음·낮음</span><span class="condition-normal">보통</span><span class="condition-bad">안좋음·높음</span><span class="condition-very-bad">아주 안좋음·매우 높음</span></div><div class="hourly-metrics">${metrics.map(([key,label,value,raw])=>{const c=conditionFor(key,raw);return`<span class="condition-${r.air_quality_estimated&&key==='air_quality_index'?'unknown':c.key}"><small>${label}</small><strong>${value}</strong><em>${c.label}</em></span>`;}).join('')}</div>`;}

function renderComparison(today,tomorrow,todayRows,tomorrowRows){
 const scores=[today,tomorrow],rows=[todayRows,tomorrowRows];
 ['Today','Tomorrow'].forEach((key,i)=>{const score=scores[i],condition=scoreCondition(score);$('compare'+key).textContent=score??'--';$('compare'+key+'Grade').textContent=condition.label;$('compare'+key+'Grade').className=`condition-text-${condition.key}`;$('compare'+key+'Reason').innerHTML=factorChips(rows[i]);$('compare'+key+'Bar').style.width=`${score??0}%`;});
 const diff=Number.isFinite(today)&&Number.isFinite(tomorrow)?tomorrow-today:null;
 $('comparisonMessage').textContent=diff===null?'비교할 단기예보가 부족합니다.':Math.abs(diff)<=3?'오늘과 내일의 점수가 비슷합니다.':`${diff>0?'내일':'오늘'}이 ${Math.abs(diff)}점 높습니다.`;
}
function renderCoach(c,best){$('coachMessage').textContent=coachMessage(c,best);const official=state.data?.officialAlerts?.alerts||[];$('officialAlerts').innerHTML=official.length?official.map(a=>`<span class="alert-chip">에어코리아 ${escapeHtml(a.pollutant||'미세먼지')} ${escapeHtml(a.level||'경보')} · ${escapeHtml(a.region||'해당 권역')}</span>`).join(''):state.data?.officialAlerts?'<span class="muted">조회된 미세먼지 경보 없음 (에어코리아)</span>':'<span class="muted">미세먼지 경보 조회 불가 · 발령 여부 미확인</span>';$('alerts').innerHTML=environmentAlerts(c).map(a=>`<span class="alert-chip">${a}</span>`).join('');}

function renderWeekly(w,hourly){
 const today=currentSeoulDate(),todayIndex=Math.max(0,w.daily.time.indexOf(today)),scores=w.daily.time.map(date=>dailyScore(rowsForDate(hourly,date))),finite=scores.filter(Number.isFinite),max=finite.length?Math.max(...finite):null;
 const selected=state.selectedWeekDate&&w.daily.time.includes(state.selectedWeekDate)?w.daily.time.indexOf(state.selectedWeekDate):todayIndex;
 $('weeklyCards').innerHTML=w.daily.time.map((date,i)=>{const score=scores[i],available=Number.isFinite(score),condition=scoreCondition(score);return `<button type="button" class="day-card ${i===selected?'active':''} ${available?'':'unavailable'}" data-day-index="${i}" aria-pressed="${i===selected}" aria-label="${monthDay(date)} ${available?`${score}점 ${condition.label}`:'예보 없음'}"><span>${date===today?'오늘':weekday(date)}</span><small>${monthDay(date)}</small><div class="day-icon">${available?weatherSymbol(w.daily.weather_code[i]):'◌'}</div><strong>${score??'—'}</strong><div class="week-score-track"><i style="width:${score??0}%"></i></div><small class="day-condition condition-${condition.key}">${available?condition.label:'예보 없음'}</small>${available&&score===max?'<small class="best-badge">BEST</small>':''}</button>`;}).join('');
 document.querySelectorAll('.day-card').forEach(btn=>btn.addEventListener('click',()=>{state.selectedWeekDate=w.daily.time[Number(btn.dataset.dayIndex)];document.querySelectorAll('.day-card').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn));});renderSelectedDay(Number(btn.dataset.dayIndex),w,hourly,scores);}));renderSelectedDay(selected,w,hourly,scores);
}
function renderSelectedDay(i,w,hourly,scores){
 const date=w.daily.time[i],allRows=rowsForDate(hourly,date),available=allRows.length>0,condition=scoreCondition(scores[i]);
 if(!available){$('selectedDayDetail').innerHTML=`<div class="week-detail-header"><strong>${monthDay(date)} (${weekday(date)})</strong><span>단기예보 범위 밖 · 점수 없음</span></div><p class="muted">중기예보 연결 전까지 점수와 추천 시간은 표시하지 않습니다.</p>`;return;}
 const remaining=date===currentSeoulDate()?allRows.filter(r=>r.time>=currentSeoulHour()):allRows;
 const best=findBestRunningTimes(remaining,1,state.duration)[0],stagnation=conditionFor('air_stagnation_index',w.daily.air_stagnation_index_max?.[i]);
 const tiles=[['기온',`${formatValue(w.daily.temperature_2m_min[i],'°',0)}–${formatValue(w.daily.temperature_2m_max[i],'°C',0)}`],['강수확률',formatValue(w.daily.precipitation_probability_max[i],'%')],['최대 UV',formatValue(w.daily.uv_index_max[i],'',1)],['대기정체',stagnation.label]];
 $('selectedDayDetail').innerHTML=`<div class="week-detail-header"><strong>${monthDay(date)} (${weekday(date)}) <span class="condition-text-${condition.key}">${scores[i]??'—'}점 · ${condition.label}</span></strong><small>기상청 단기예보</small></div><div class="week-detail-tiles">${tiles.map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div><div class="week-best"><span>추천 러닝</span><strong>${best?`${timeOnly(best.start)}–${endLabel(best)}`:'추천 시간 없음'}</strong></div><div class="factor-row">${factorChips(allRows)}</div>`;
}
function renderWorkouts(c){const scores=workoutScores(c);$('workoutScores').innerHTML=Object.entries(scores).map(([name,score])=>{const condition=scoreCondition(score);return`<div class="workout-row workout-condition-${condition.key}"><span>${name}</span><div class="bar"><i style="width:${score}%"></i></div><strong>${score}</strong></div>`;}).join('');}
function renderGear(c){$('gearAdvice').innerHTML=Object.entries(gearAdvice(c)).map(([k,v])=>`<div class="gear-item"><span>${k}</span><strong>${v}</strong></div>`).join('');}

function calculatorTemplate(){const html=state.calcMode==='pace'?`<div class="field"><label for="paceInput">페이스 (분:초/km)</label><input id="paceInput" value="5:00" inputmode="numeric"></div>`:`<div class="field"><label for="speedInput">속도 (km/h)</label><input id="speedInput" type="number" min="0.1" step="0.1" value="12"></div>`;$('calculatorInputs').innerHTML=html;$('calculatorInputs').querySelectorAll('input').forEach(el=>el.addEventListener('input',calculate));calculate();}
function calculate(){const data=state.calcMode==='pace'?fromPace(parseClock($('paceInput')?.value)):fromSpeed(Number($('speedInput')?.value));if(!data||data.paceSeconds<120||data.paceSeconds>1800){$('calculatorError').textContent='올바른 값을 입력해 주세요. 페이스는 2:00–30:00/km 범위에서 계산합니다.';$('resultPace').textContent='--:--/km';$('resultSpeed').textContent='-- km/h';$('splitResults').innerHTML='';return;}$('calculatorError').textContent='';$('resultPace').textContent=renderPace(data.paceSeconds);$('resultSpeed').textContent=`${round(data.speed,1)} km/h`;$('splitResults').innerHTML=Object.entries(data.splits).map(([n,s])=>`<div class="split-item"><span>${n}</span><strong>${secondsToClock(s)}</strong></div>`).join('');}
function renderPaceTable(){const {startSeconds,endSeconds,stepSeconds}=APP_CONFIG.paceTable;$('paceTableBody').innerHTML=paceTableRows(startSeconds,endSeconds,stepSeconds).map(r=>`<tr><td>${renderPace(r.pace)}</td><td>${round(r.speed,1)}</td><td>${secondsToClock(r.splits['5K'])}</td><td>${secondsToClock(r.splits['10K'])}</td><td>${secondsToClock(r.splits.Half)}</td><td>${secondsToClock(r.splits.Marathon)}</td></tr>`).join('');}

function initLocationMap(){
  if(state.map||!window.kakao?.maps)return;
  const center=new kakao.maps.LatLng(state.location.latitude,state.location.longitude);
  state.map=new kakao.maps.Map($('locationMap'),{center,level:5});
  state.marker=new kakao.maps.Marker({position:center,map:state.map});
}
function showLocationOnMap(loc){
  initLocationMap();if(!state.map)return;
  const position=new kakao.maps.LatLng(loc.latitude,loc.longitude);
  state.map.relayout();state.map.setCenter(position);state.map.setLevel(4);state.marker.setPosition(position);
}
function previewLocation(loc,button){
  state.selectedLocation=loc;showLocationOnMap(loc);$('locationConfirm').hidden=false;
  $('locationResults').querySelectorAll('.location-result').forEach(item=>item.classList.toggle('selected',item===button));
  $('locationError').textContent=`${loc.address||loc.name} 위치를 확인한 뒤 사용 버튼을 눌러주세요.`;
}
async function chooseLocation(loc){
  $('locationConfirm').disabled=true;$('locationError').textContent='행정구역과 가까운 대기 측정소를 확인하고 있습니다…';
  try{state.location=await ensureAreaCode(loc);}catch{state.location=loc;}
  state.selectedLocation=null;setStored('location',state.location);$('locationConfirm').hidden=true;$('locationConfirm').disabled=false;$('locationDialog').close();loadData(true);
}
function locate(){if(!navigator.geolocation){$('locationError').textContent='이 브라우저는 위치 기능을 지원하지 않습니다.';return;}$('locationError').textContent='현재 위치와 주소를 확인하고 있습니다…';navigator.geolocation.getCurrentPosition(async pos=>{const latitude=round(pos.coords.latitude,6),longitude=round(pos.coords.longitude,6);try{chooseLocation(await reverseGeocode(latitude,longitude));}catch{chooseLocation({name:'현재 위치',address:'현재 위치',region1:'',region2:'',latitude,longitude});}},()=>{$('locationError').textContent='위치 권한이 거부되었거나 위치를 확인할 수 없습니다. 지역 검색을 이용해 주세요.';},{timeout:15000,maximumAge:300000,enableHighAccuracy:true});}
async function search(){const q=$('locationSearch').value.trim();if(q.length<2){$('locationError').textContent='주소나 장소명을 두 글자 이상 입력해 주세요.';return;}try{$('locationError').textContent='카카오에서 검색 중…';state.selectedLocation=null;$('locationConfirm').hidden=true;const results=await searchLocations(q);$('locationError').textContent=results.length?'검색 결과를 선택하면 지도에서 위치를 확인할 수 있습니다.':'검색 결과가 없습니다.';$('locationResults').innerHTML=results.map((r,i)=>`<button type="button" class="location-result" data-index="${i}" role="option"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml([r.category,r.roadAddress||r.address].filter(Boolean).join(' · '))}</small></button>`).join('');$('locationResults').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const r=results[Number(b.dataset.index)];previewLocation({name:r.name,address:r.address,roadAddress:r.roadAddress,region1:r.region1,region2:r.region2,region3:r.region3,areaNo:r.areaNo,latitude:r.latitude,longitude:r.longitude},b);}));if(results[0])previewLocation(results[0],$('locationResults').querySelector('button'));}catch(e){$('locationError').textContent=e.message;}}

$('locationButton').addEventListener('click',()=>{$('locationDialog').showModal();setTimeout(()=>{initLocationMap();state.map?.relayout();showLocationOnMap(state.location);$('locationSearch').focus();},0);});$('locationConfirm').addEventListener('click',()=>{if(state.selectedLocation)chooseLocation(state.selectedLocation);});$('useMyLocation').addEventListener('click',locate);$('searchLocation').addEventListener('click',search);$('locationSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search();}});$('refreshButton').addEventListener('click',()=>loadData(true));$('themeButton').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));document.querySelectorAll('[data-hourly-day]').forEach((b,i)=>b.addEventListener('click',()=>{state.hourlyDay=i;renderHourly();}));$('hourlyNextDay').addEventListener('click',()=>{state.hourlyDay=1;renderHourly();});document.querySelectorAll('[data-duration]').forEach(b=>b.addEventListener('click',()=>{state.duration=Number(b.dataset.duration);setStored('runDuration',state.duration);document.querySelectorAll('[data-duration]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});if(state.data)render();}));document.querySelectorAll('[data-duration]').forEach(b=>{const active=Number(b.dataset.duration)===state.duration;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelectorAll('[data-calc-mode]').forEach(b=>b.addEventListener('click',()=>{state.calcMode=b.dataset.calcMode;document.querySelectorAll('[data-calc-mode]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',x===b);});calculatorTemplate();}));addEventListener('online',()=>{$('offlineBanner').hidden=true;loadData();});addEventListener('offline',()=>{$('offlineBanner').hidden=false;});

calculatorTemplate();renderPaceTable();loadData();
if('serviceWorker'in navigator)addEventListener('load',async()=>{try{const registration=await navigator.serviceWorker.register('./service-worker.js?v=21',{updateViaCache:'none'});registration.update();let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload();}});}catch{}});
