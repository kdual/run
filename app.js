import { requestJson, requestFailureLabel } from './request.js?v=39';
import { APP_CONFIG } from './running-score-config.js?v=14';
import { ensureAreaCode, fetchWeather, reverseGeocode, searchLocations } from './weather.js?v=41';
import { fetchAirQuality } from './air-quality.js?v=39';
import { getStored, setStored, getCache, setCache } from './storage.js?v=19';
import { currentConditions, dailyCoverage, hourlySlots, poorAir, dailyScore, findBestRunningTimes, includeCurrentObservation, mergeHourly, rowsForDate, runnableRows, runningScoreDeductions, workoutScores } from './running-score.js?v=40';
import { coachMessage, environmentAlerts, gearAdvice, runNowMessage, temperatureFactorAdvice } from './running-coach.js?v=46';
import { fromPace, fromSpeed, parsePaceInput, renderPace } from './pace-calculator.js?v=30';
import { renderHourlyChart } from './charts.js?v=40';
import { solarTimes } from './solar-times.js?v=39';
import { dateOnly, escapeHtml, formatValue, monthDay, round, secondsToClock, timeOnly, weatherIcon, weekday } from './utils.js?v=44';

const $ = id => document.getElementById(id);
const state = { duration:getStored('runDuration',60), location:getStored('location',APP_CONFIG.defaultLocation), selectedLocation:null, data:null, hourlyDay:0, hourlyKey:null, dateKey:currentSeoulDate(), calcMode:'pace',calcInputs:{pace:'500',speed:'12'}, controller:null, map:null, marker:null };

function setTheme(theme){
 document.documentElement.dataset.theme=theme;
 setStored('theme',theme);
 const button=$('themeButton');
 button.setAttribute('aria-label',theme==='dark'?'라이트 모드 전환':'다크 모드 전환');
 button.textContent=theme==='dark'?'◐ 라이트':'◐ 다크';
}
const designButtons=[...document.querySelectorAll('[data-design]')];
const lightDesigns=new Set(['swiss','paper','modern','ink']);
let lightDesign=getStored('runwiseLightDesign','swiss');
if(!lightDesigns.has(lightDesign))lightDesign='swiss';
function selectDesign(design){
 const night=design==='night';
 if(!night){ lightDesign=design; setStored('runwiseLightDesign',design); }
 document.documentElement.dataset.design=design;
 setTheme(night?'dark':'light');
 for(const button of designButtons) button.setAttribute('aria-pressed',String(button.dataset.design===design));
}
const previousTheme=getStored('theme',matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
selectDesign(previousTheme==='dark'?'night':lightDesign);
const designPicker=$('designPicker');
const designToggle=designPicker.querySelector('summary');
function closeDesignPicker(restoreFocus=false){
 designPicker.open=false;
 if(restoreFocus)designToggle.focus({preventScroll:true});
}
for(const button of designButtons) button.addEventListener('click',()=>{
 selectDesign(button.dataset.design);
 closeDesignPicker(true);
});
designPicker.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&designPicker.open){
   event.preventDefault();
   closeDesignPicker(true);
 }
});
document.addEventListener('click',event=>{
 if(designPicker.open&&!designPicker.contains(event.target))closeDesignPicker();
});

function setLoading(isLoading){
 const button=$('refreshButton');
 button.disabled=isLoading;
 button.setAttribute('aria-busy',String(isLoading));
}
function showError(message,label='일부 자료 갱신 실패'){
 state.dataNotice=message?{message,label}:null;
 renderAdvisory();
}
function renderAdvisory(){
 const offline=!navigator.onLine;
 const report=state.alertReport;
 const notices=[];
 const summary=[];
 if(offline){
   summary.push('오프라인');
   notices.push(state.data?.weather?'오프라인입니다. 마지막 저장 데이터를 표시합니다.':'오프라인입니다. 표시할 저장 날씨가 없습니다.');
 }else if(state.dataNotice){
   summary.push(state.dataNotice.label);
   notices.push(state.dataNotice.message);
 }
 const alerts=report?.alerts||[];
 if(alerts.length){
   summary.push('미세먼지 경보 '+alerts.length+'건');
   notices.push(...alerts.map(a=>['에어코리아',a.pollutant||'미세먼지',a.level||'경보','·',a.region||'해당 권역'].join(' ')));
 }else{
   const label=offline?'미세먼지 경보 미확인':state.alertsPending?'미세먼지 경보 확인 중':report?'미세먼지 경보 없음':'미세먼지 경보 미확인';
   summary.push(label);
   notices.push(label==='미세먼지 경보 미확인'?'미세먼지 경보를 확인할 수 없어 발령 여부를 알 수 없습니다.':label);
 }
 const label=summary.join(' · ');
 if($('advisorySummary').textContent!==label)$('advisorySummary').textContent=label;
 const detail=$('advisoryDetail');
 const text=notices.join('\n');
 if(detail.textContent!==text)detail.textContent=text;
}
function nowSeoul(){return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());}
function currentSeoulDate(date=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function addCalendarDays(date,days){const [year,month,day]=date.split('-').map(Number);return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10);}
function updateClock(){$('headerClock').textContent=nowSeoul();const dateKey=currentSeoulDate(),hourKey=currentSeoulHour(),minuteKey=currentSeoulMinute();if(state.dateKey!==dateKey){state.dateKey=dateKey;state.hourlyDay=0;loadData(true);return;}if(state.data&&state.hourlyKey!==hourKey){render();loadData(true);}if(state.data&&state.minuteKey!==minuteKey){state.minuteKey=minuteKey;render();}}
updateClock();setInterval(updateClock,1000);

async function loadData(force=false){
  if(!force&&state.loading)return;
  state.controller?.abort();const controller=new AbortController();state.controller=controller;state.loading=true;
  state.alertReport=null;state.alertsPending=navigator.onLine;
  setLoading(true);showError('');
  const loc={...state.location};
  try{
    if(!navigator.onLine){
      if(!state.data?.weather){
        const cached=getCache(loc);
        if(cached?.payload?.weather){
          state.data={...cached.payload,airPending:false,fromCache:true,savedAt:cached.savedAt};
          render();
        }
      }
      return;
    }
    if(!loc.areaNo||!loc.region1){
      let timeout;
      try{Object.assign(loc,await Promise.race([ensureAreaCode(loc),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('지역 확인 시간 초과')),8000);})]));}
      catch{}finally{clearTimeout(timeout);}
    }
    if(controller.signal.aborted)return;
    state.location=loc;setStored('location',loc);$('headerLocation').textContent=loc.name;
    const cached=getCache(loc),fresh=cached&&Date.now()-cached.savedAt<APP_CONFIG.cacheMinutes*60000;
    const payload={...(cached?.payload||{}),airPending:true,airError:false,airFailureReason:null,fromCache:Boolean(cached),savedAt:cached?.savedAt||Date.now()};
    if(fresh&&payload.weather){state.data=payload;render();}
    const apply=()=>{if(!controller.signal.aborted&&payload.weather){state.data={...payload};render();}};
    const publicRequest=path=>requestJson(`${APP_CONFIG.apiBaseUrl}${path}`,controller.signal,{retries:0}).then(r=>r.data).catch(()=>null);
    const forecastJob=publicRequest(`/air/forecast?sidoName=${encodeURIComponent(loc.region1||'서울')}`).then(data=>{payload.forecast=data||payload.forecast;apply();});
    const alertsJob=publicRequest(`/air/alerts?sidoName=${encodeURIComponent(loc.region1||'서울')}&districtName=${encodeURIComponent(loc.region2||'')}`).then(data=>{
      if(controller.signal.aborted)return;
      state.alertReport=data;
      state.alertsPending=false;
      renderAdvisory();
    });
    const airJob=fetchAirQuality(loc,controller.signal).then(data=>{payload.air=data;payload.airStale=false;}).catch(error=>{if(error.name!=='AbortError'){payload.airError=true;payload.airFailureReason=requestFailureLabel(error);payload.airStale=Boolean(payload.air);}}).finally(()=>{payload.airPending=false;apply();});
    let weatherError;
    const weatherJob=fetchWeather(loc,controller.signal).then(weather=>{payload.weather=weather;payload.savedAt=Date.now();payload.fromCache=false;apply();}).catch(error=>{weatherError=error;});
    await Promise.all([weatherJob,airJob,forecastJob,alertsJob]);
    if(controller.signal.aborted)return;
    if(!payload.weather)throw weatherError||new Error('날씨 자료 없음');
    apply();if(!weatherError)setCache(loc,payload);
    const warnings=[];
    if(weatherError)warnings.push('최신 날씨 조회에 실패해 저장된 관측을 표시합니다.');
    if(payload.airError)warnings.push(`대기질 최신 조회 실패 (${payload.airFailureReason||'원인 미확인'}). ${payload.airStale?'저장된 측정값을 표시하며, 3시간이 지나면 현재 점수에서 제외합니다.':'대기질 없이 계산하며 새로고침으로 다시 시도할 수 있습니다.'}`);
    if(payload.weather.life_indices?.uv!=='ok'||payload.weather.life_indices?.air_stagnation!=='ok')warnings.push('일부 생활기상지수를 조회하지 못했습니다.');
    showError(warnings.join(' '));
  }catch(error){
    if(error.name!=='AbortError'&&!controller.signal.aborted){
      showError(`날씨를 가져오지 못했습니다. 다시 시도해 주세요. (${error.message})`,'날씨 조회 실패');
      if(!state.data?.weather)$('departureComparisonNote').textContent='날씨를 불러오지 못해 비교할 수 없습니다.';
    }
  }
  finally{if(state.controller===controller){state.loading=false;state.alertsPending=false;state.lastAttempt=Date.now();setLoading(false);renderAdvisory();}}
}

function render(){
  const {weather,air}=state.data;const forecastHourly=mergeHourly(weather,air,state.data.forecast);const current=currentConditions(weather,forecastHourly,air,new Date(),state.location);const hourly=includeCurrentObservation(forecastHourly,current);const today=currentSeoulDate();const nowHour=currentSeoulHour();const todayRows=rowsForDate(hourly,today);const futureTodayRows=todayRows.filter(row=>row.time>=nowHour);const tomorrow=addCalendarDays(today,1);const tomorrowRows=rowsForDate(hourly,tomorrow);const best=findBestRunningTimes(todayRows,3,state.duration);const futureBest=best[0];const todayScore=dailyScore(todayRows);const tomorrowScore=dailyScore(tomorrowRows);
  state.computed={hourly,current,today,todayRows,futureTodayRows,tomorrowRows,best,todayScore,tomorrowScore};
  renderHero(current,futureBest);renderCurrent(current,weather);renderBest(best);renderHourly();renderComparison(todayScore,tomorrowScore);renderCoach(current,futureBest);renderWeekly(weather,hourly);renderWorkouts(current);renderGear(current);
  $('updatedAt').textContent=`업데이트 ${new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit'}).format(new Date(state.data.savedAt))}${state.data.fromCache?' · 저장 데이터':''}`;
  const station=air?.current?.station_name;const measured=air?.current?.measured_at;
  const living=weather.life_indices;const livingReady=living?.uv==='ok'||living?.air_stagnation==='ok';
  const airSource=state.data.airError?` · 에어코리아 최신 조회 실패${station?` · ${station} 저장 측정값`:''}`:state.data.airPending?' · 에어코리아 갱신 중':station?` · 에어코리아 ${station} 측정소${measured?` ${measured} 측정`:''}`:' · 대기질 정보 없음';
  const airState=state.data.airError?'대기질 최신 조회 실패 · '+(Number.isFinite(current.pm2_5)||Number.isFinite(current.pm10)||Number.isFinite(current.air_quality_index)?'저장된 대기질 사용 중 · ':'대기질 미반영 · '):state.data.airPending?'대기질 갱신 중 · ':'';
  $('scoreDataStatus').textContent=airState+(current.score===null?'계산 불가 · '+current.missing.join(' · '):current.missing.length?'일부 정보 미반영: '+current.missing.join(' · '):'확인된 자료로 계산한 추정 점수입니다.');
  $('observationSource').textContent=`기상청 ${timeOnly(current.observation_time)} 관측${livingReady?'·생활기상지수':''}${airSource}`;$('airSourceDetail').textContent=station?`PM 실측: ${station} · ${measured||'측정 시각 없음'}${Number.isFinite(air?.station_distance_km)?` · 약 ${air.station_distance_km}km`:''}. 3시간이 지나면 현재 점수에서 제외합니다.`:'PM 실측 측정소 또는 값이 확인되지 않았습니다.';$('forecastSourceDetail').textContent=state.data.forecast?.daily?.length?`미래 대기질: 에어코리아 ${state.data.forecast.sido_name} 권역 일일 예보 등급 (시간별 농도 아님)`:'미래 대기질: 권역 예보 없음 · 점수에 대기질 반영 안 함';
}

function renderHero(current,best){
 const condition=scoreCondition(current.score);
 $('top').dataset.condition=condition.key;
 $('currentScore').classList.remove('skeleton-text');
 $('currentScore').textContent=current.score??'--';
 $('currentScoreScale').hidden=!Number.isFinite(current.score);
 $('currentScoreScale').dataset.condition=condition.key;
 $('currentScoreMeter').value=current.score??0;
 $('currentGrade').textContent=condition.label;
 $('currentGrade').className='grade-pill condition-'+condition.key;
 $('runNowMessage').textContent=runNowMessage(current,best);
 $('currentScoreFactors').innerHTML=factorChips([current]);
 $('heroTemp').textContent=formatValue(current.temperature_2m,'°C',1);
 $('heroFeels').textContent=formatValue(current.apparent_temperature,'°C',1);
 $('heroHumidity').textContent=formatValue(current.relative_humidity_2m,'%');
 $('heroDew').textContent=formatValue(current.dew_point_2m,'°C',1);
 $('heroWind').textContent=formatValue(current.wind_speed_10m,' km/h',1);
 $('heroUv').textContent=Number.isFinite(current.uv_index)?'UV '+round(current.uv_index,1):'UV 정보 없음';
 $('todayBestTime').textContent=best?timeOnly(best.start)+'–'+endLabel(best):'남은 추천 시간 없음';
 renderDepartureComparison(current,best);
}
function mountDepartureComparison(){
  const weather=document.querySelector('.hero-side');
  const aside=document.createElement('div');
  aside.className='hero-aside';
  weather.before(aside);
  aside.append(weather);
  aside.insertAdjacentHTML('beforeend', `
    <section class="departure-comparison" aria-labelledby="departureComparisonTitle">
      <h2 id="departureComparisonTitle">지금 vs 추천 시간 비교</h2>
      <table aria-labelledby="departureComparisonTitle" aria-describedby="departureComparisonNote">
        <thead><tr><th scope="col">항목</th><th scope="col">지금</th><th scope="col">추천 <span id="departureBestTime"></span></th></tr></thead>
        <tbody>
          <tr><th scope="row">러닝 점수</th><td id="departureCurrentScore">—</td><td><strong id="departureBestScore">—</strong><span id="departureScoreDelta" hidden></span></td></tr>
          <tr><th scope="row">체감온도</th><td id="departureCurrentFeels">—</td><td id="departureBestFeels">—</td></tr>
          <tr><th scope="row">바람</th><td id="departureCurrentWind">—</td><td id="departureBestWind">—</td></tr>
        </tbody>
      </table>
      <p id="departureComparisonNote">러닝 조건을 확인하는 중입니다.</p>
    </section>
  `);
}
function renderDepartureComparison(current,best){
  const recommended=best?.averageWeather;
  const values=[
    ['departureCurrentScore',current?.score,'점',0],
    ['departureBestScore',best?.score,'점',0],
    ['departureCurrentFeels',current?.apparent_temperature,'°C',1],
    ['departureBestFeels',recommended?.apparent_temperature,'°C',1],
    ['departureCurrentWind',current?.wind_speed_10m,' km/h',1],
    ['departureBestWind',recommended?.wind_speed_10m,' km/h',1]
  ];
  for(const [id,value,unit,digits] of values){
    $(id).textContent=Number.isFinite(value)?formatValue(value,unit,digits):'—';
  }
  $('departureBestTime').textContent=best?timeOnly(best.start)+'–'+endLabel(best):'';
  const delta=$('departureScoreDelta');
  const comparable=Number.isFinite(current?.score)&&Number.isFinite(best?.score);
  delta.hidden=!comparable;
  if(comparable){
    const difference=best.score-current.score;
    delta.textContent=difference===0?'동일':(difference>0?'+':'−')+Math.abs(difference)+'점';
  }else{
    delta.textContent='';
  }
  $('departureComparisonNote').textContent=best
    ?`추천 열은 ${best.durationMinutes}분 구간 평균입니다.`
    :current?'오늘 남은 추천 시간대가 없습니다.':'러닝 조건을 확인하는 중입니다.';
}
function endLabel(block){const d=new Date(Date.parse(`${block.start}:00+09:00`)+block.durationMinutes*60000);return String((d.getUTCHours()+9)%24).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');}
function renderBest(best){$('bestTimes').innerHTML=best.length?best.map((b,i)=>`<li><span class="rank-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span><strong>${timeOnly(b.start)}–${endLabel(b)}</strong><small>${b.durationMinutes}분 추천 구간${b.durationMinutes===30?' · 시간별 예보 기반':''}</small></span><span class="point">${b.score}점</span></li>`).join(''):'<li class="best-empty"><span>오늘 남은 추천 시간대가 없습니다.</span></li>';}

function renderCurrent(c,w){const overall=scoreCondition(c.score);$('currentWeatherCard').dataset.condition=overall.key;$('currentWeatherCondition').className=`score-condition-badge condition-${overall.key}`;$('currentWeatherCondition').textContent=`${c.score??'--'}점 · ${overall.label}`;$('weatherIcon').innerHTML=weatherIcon(c.weather_code);const items=[['temperature_2m','기온',formatValue(c.temperature_2m,'°C',1),c.temperature_2m],['apparent_temperature','체감',formatValue(c.apparent_temperature,'°C',1),c.apparent_temperature],['relative_humidity_2m','습도',formatValue(c.relative_humidity_2m,'%'),c.relative_humidity_2m],['dew_point_2m','이슬점',formatValue(c.dew_point_2m,'°C',1),c.dew_point_2m],['precipitation_probability','강수확률',formatValue(c.precipitation_probability,'%'),c.precipitation_probability],['precipitation','강수량',formatValue(c.precipitation,' mm',1),c.precipitation],['wind_speed_10m','바람',formatValue(c.wind_speed_10m,' km/h',1),c.wind_speed_10m],['air_stagnation_index','대기정체',formatValue(c.air_stagnation_index,'',0),c.air_stagnation_index],['pm2_5','PM2.5',formatValue(c.pm2_5,' μg/m³',1),c.pm2_5],['pm10','PM10',formatValue(c.pm10,' μg/m³',1),c.pm10],['air_quality_index','통합대기지수',formatValue(c.air_quality_index,''),c.air_quality_index],['uv_index','UV',formatValue(c.uv_index,'',1),c.uv_index]];const primaryKeys=['temperature_2m','apparent_temperature','air_stagnation_index','precipitation_probability'];
 const airKeys=new Set(['pm2_5','pm10','air_quality_index']);
 const metricTile=([key,label,value,raw])=>{
   const pending=state.data?.airPending&&airKeys.has(key)&&!Number.isFinite(raw);
   const condition=pending?{key:'unknown',label:'갱신 중'}:conditionFor(key,raw);
   const display=Number.isFinite(raw)?value:'—';
   return `<div class="weather-summary-cell">
     <dt>${label}</dt>
     <dd><strong class="weather-summary-value">${display}</strong>
       <span class="weather-summary-badge" data-condition="${condition.key}">${condition.label}</span></dd>
   </div>`;
 };
 const byKey=new Map(items.map(item=>[item[0],item]));
 $('weatherMetrics').innerHTML=primaryKeys.map(key=>metricTile(byKey.get(key))).join('');
 $('weatherDetails').innerHTML=items.filter(([key])=>!primaryKeys.includes(key)).map(metricTile).join('');
 renderSunTimes();
}

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
  const sun=state.todaySun,now=currentSeoulMinute();
  const timeline=$('daylightTimeline');
  const points=[sun?.astronomical_dawn,sun?.sunrise,sun?.sunset,sun?.astronomical_dusk,now];
  timeline.hidden=!points.every(Boolean);
  if(!timeline.hidden){
    const positions=['--dawn','--sunrise','--sunset','--dusk','--now'];
    points.forEach((time,index)=>{
      const [hours,minutes]=timeOnly(time).split(':').map(Number);
      timeline.style.setProperty(positions[index],`${(hours*60+minutes)/14.4}%`);
    });
  }
  if(!sun){$('sunStatus').textContent='일출·일몰 시각을 계산할 수 없습니다.';$('daylightBadge').textContent='정보 없음';return;}
  const phase=now<(sun.astronomical_dawn||sun.sunrise)||now>=(sun.astronomical_dusk||sun.sunset)
    ?'완전한 어둠':now<sun.sunrise?'일출 전 박명':now<sun.sunset?'낮':'일몰 후 박명';
  $('daylightBadge').textContent=phase;
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
function renderHourly(){$('hourlySelection').textContent='';const compact=matchMedia('(max-width:700px)').matches;const allRows=state.hourlyDay===0?state.computed.todayRows:state.computed.tomorrowRows;const nowHour=currentSeoulHour();state.hourlyKey=nowHour;const rows=compact&&state.hourlyDay===0&&dateOnly(nowHour)===state.computed.today?allRows.filter(r=>r.time>=nowHour):allRows;renderHourlyChart($('hourlyChart'),rows,renderHourlyDetail);$('hourlyTextAlternative').textContent=rows.map(r=>`${timeOnly(r.time)} ${r.score??'--'}점${r.observed?` 최신 관측(${timeOnly(r.observation_time)}) 반영`:''}`).join(', ');if(!rows.some(r=>Number.isFinite(r.score))) $('hourlyDetail').innerHTML=`<p class="muted">${state.hourlyDay===0?'오늘 남은 시간대':'선택한 날짜'}의 기상청 예보가 없습니다.</p>`;const observed=state.hourlyDay===0&&rows.find(r=>r.observed&&r.time===nowHour);$('hourlyDataNote').textContent=observed?`현재 시간대는 ${timeOnly(observed.observation_time)} 기상청 관측값과 최신 대기질을 반영합니다. 이후 시간대는 예보 점수입니다.`:'시간대별 점수는 기상청 예보를 바탕으로 계산합니다.';const nextButton=$('hourlyNextDay');nextButton.hidden=!(compact&&state.hourlyDay===0&&rows.length<=3);document.querySelectorAll('[data-hourly-day]').forEach((b,i)=>{b.classList.toggle('active',i===state.hourlyDay);b.setAttribute('aria-pressed',String(i===state.hourlyDay));});}
function conditionFor(key,value){if(!Number.isFinite(value))return{key:'unknown',label:'정보 없음'};if(key==='air_stagnation_index'){if(value<=25)return{key:'good',label:'낮음'};if(value<=50)return{key:'normal',label:'보통'};if(value<=75)return{key:'bad',label:'높음'};return{key:'very-bad',label:'매우 높음'};}if(key==='uv_index'){if(value<=2)return{key:'good',label:'낮음'};if(value<=5)return{key:'normal',label:'보통'};if(value<=7)return{key:'bad',label:'높음'};return{key:'very-bad',label:value>=11?'위험':'매우 높음'};}const rules={temperature_2m:[[5,18],[0,23],[-5,29]],apparent_temperature:[[5,18],[0,23],[-5,29]],relative_humidity_2m:[[30,60],[20,70],[10,82]],dew_point_2m:[[-30,10],[-30,15],[-30,20]],precipitation_probability:[[0,10],[0,30],[0,60]],precipitation:[[0,0],[0,.5],[0,2]],wind_speed_10m:[[0,12],[0,20],[0,30]],wind_gusts_10m:[[0,20],[0,30],[0,45]],pm2_5:[[0,15],[0,35],[0,75]],pm10:[[0,30],[0,80],[0,150]],air_quality_index:[[0,50],[0,100],[0,250]]};const bands=rules[key];if(!bands)return{key:'unknown',label:'참고'};if(value>=bands[0][0]&&value<=bands[0][1])return{key:'good',label:'좋음'};if(value>=bands[1][0]&&value<=bands[1][1])return{key:'normal',label:'보통'};if(value>=bands[2][0]&&value<=bands[2][1])return{key:'bad',label:'안좋음'};return{key:'very-bad',label:'아주 안좋음'};}
function scoreCondition(score){if(!Number.isFinite(score))return{key:'unknown',label:'정보 없음'};if(score>=90)return{key:'good',label:'좋음'};if(score>=75)return{key:'normal',label:'보통'};if(score>=60)return{key:'bad',label:'안좋음'};return{key:'very-bad',label:'아주 안좋음'};}
function scoreFactors(rows){const basis=hourlySlots(rows).sort((a,b)=>b.score-a.score).slice(0,4);if(!basis.length)return [];const keys=[['temperature','체감'],['sunExposure','햇빛 열부담(추정)'],['dewPoint','습기(이슬점)'],['humidity','습기(습도)'],['rain','강수'],['wind','바람'],['airQuality','대기질'],['uv','자외선']];return keys.map(([key,label])=>({label,loss:Math.round(basis.reduce((n,r)=>n+(r.deductions||runningScoreDeductions(r))[key],0)/basis.length)})).filter(f=>f.loss>0).sort((a,b)=>b.loss-a.loss).slice(0,3);}
function factorChips(rows){if(!hourlySlots(rows).length)return '<span class="factor-chip">자료 부족 · 감점 계산 제한</span>';const factors=scoreFactors(rows);return factors.length?factors.map(f=>`<span class="factor-chip">${f.label} −${f.loss}</span>`).join(''):'<span class="factor-chip favorable">큰 감점 없음</span>';}
function renderHourlyDetail(r){$('hourlySelection').textContent=' · '+timeOnly(r.time);const overall=scoreCondition(r.score);const date=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(`${r.time}:00+09:00`));const forecastAir=r.air_quality_estimated;const measuredIndex=forecastAir?null:r.air_quality_index;const metrics=[['temperature_2m','기온',formatValue(r.temperature_2m,'°C',1),r.temperature_2m],['apparent_temperature','체감',formatValue(r.apparent_temperature,'°C',1),r.apparent_temperature],['relative_humidity_2m','습도',formatValue(r.relative_humidity_2m,'%'),r.relative_humidity_2m],['dew_point_2m','이슬점',formatValue(r.dew_point_2m,'°C',1),r.dew_point_2m],['precipitation_probability','강수확률',formatValue(r.precipitation_probability,'%'),r.precipitation_probability],['precipitation','강수량',formatValue(r.precipitation,' mm',1),r.precipitation],['wind_speed_10m','바람',formatValue(r.wind_speed_10m,' km/h',1),r.wind_speed_10m],['uv_index','UV',formatValue(r.uv_index,'',1),r.uv_index],['air_stagnation_index','대기정체',formatValue(r.air_stagnation_index,'',0),r.air_stagnation_index],['pm2_5','PM2.5 실측',formatValue(r.pm2_5,' μg/m³',1),r.pm2_5],['pm10','PM10 실측',formatValue(r.pm10,' μg/m³',1),r.pm10],['air_quality_index','통합대기지수',forecastAir?'미래 실측값 없음':formatValue(measuredIndex,''),measuredIndex]];const missingNote=r.missing?.length?`<p class="hourly-air-note">일부 정보 미반영: ${escapeHtml(r.missing.join(' · '))}</p>`:'';const forecastNote=forecastAir?`<p class="hourly-air-note">권역 PM 일일 예보: <strong>${escapeHtml(r.air_forecast_grade||'정보 없음')}</strong> · 시간별 통합대기지수 예보는 아닙니다.</p>`:'';$('hourlyDetail').innerHTML=`<div class="hourly-detail-heading"><strong>${date} · ${r.observed?`${timeOnly(r.observation_time)} 관측 반영`:'예보'}</strong><span class="hourly-score condition-${overall.key}">${r.score??'--'}점 · ${overall.label}</span></div><div class="hourly-metrics">${metrics.map(([key,label,value,raw])=>{const c=conditionFor(key,raw);return`<span class="condition-${c.key}"><small>${label}</small><strong>${value}</strong><em>${forecastAir&&key==='air_quality_index'?'시간별 값 없음':c.label}</em></span>`;}).join('')}</div>${forecastNote}${missingNote}`;}

function renderComparison(today,tomorrow){
 const diff=Number.isFinite(today)&&Number.isFinite(tomorrow)?tomorrow-today:null;
 $('comparisonMessage').textContent=diff===null?'오늘·내일 비교 예보 없음':diff===0?'오늘과 내일 점수가 같습니다':`내일은 오늘보다 ${Math.abs(diff)}점 ${diff>0?'높습니다':'낮습니다'}`;
 const coverageToday=dailyCoverage(state.computed.todayRows),coverageTomorrow=dailyCoverage(state.computed.tomorrowRows);
 $('comparisonMessage').textContent+=` · 자료 ${coverageToday.hours}/${coverageToday.total}시간 vs ${coverageTomorrow.hours}/${coverageTomorrow.total}시간 · 추정 비교`;
 $('comparisonMessage').dataset.trend=diff===null?'unknown':diff>0?'up':diff<0?'down':'same';
}
function renderCoach(c,best){
 $('coachMessage').textContent=coachMessage(c,best);
 const airPoor=poorAir(c);
 const intensity=!Number.isFinite(c.score)?'자료 확인 후 결정':c.score<40?'실내 운동 또는 휴식':airPoor||c.score<70?'짧고 가벼운 러닝':c.score<85?'대화 가능한 편안한 페이스':'평소 계획한 강도';
 const intensityDetail=!Number.isFinite(c.score)?'최신 날씨가 부족해 강도를 추천할 수 없습니다.':c.score<40?'현재 환경 점수가 낮아 야외 러닝에 신중하세요.':airPoor?'현재 측정된 대기질을 고려하세요.':c.score<70?'강도보다 편안한 움직임을 우선하세요.':c.score<85?'몸 상태에 맞춰 페이스를 조절하세요.':'날씨 외에 몸 상태도 확인하세요.';
 const difference=best&&Number.isFinite(c.score)?best.score-c.score:null;
 const timing=best&&difference===null?'자료 확인 후 결정':best?(difference>=5?`${timeOnly(best.start)} 이후 검토`:difference<=-5?'지금 출발도 고려':'시간 차이 크지 않음'):'남은 예보 없음';
 const timingDetail=best&&difference===null?'최신 현재 점수가 없어 추천 구간과 비교할 수 없습니다.':best?(difference>=5?`선택한 ${state.duration}분 구간의 예보 점수가 현재보다 ${difference}점 높습니다.`:difference<=-5?`현재 점수가 추천 구간보다 ${Math.abs(difference)}점 높습니다.`:`현재와 추천 구간의 예상 점수 차이는 ${Math.abs(difference)}점입니다.`):'남은 러닝 가능 시간대의 예보를 확인할 수 없습니다.';
 const reasons=Object.entries(c.deductions||runningScoreDeductions(c)).sort((a,b)=>b[1]-a[1]);
 const primary=reasons[0],factorInfo={temperature:['체감온도',temperatureFactorAdvice(c)],sunExposure:['햇빛 열부담(추정)','그늘이 적은 코스라면 페이스를 낮추거나 해가 약한 시간대를 선택하세요.'],dewPoint:['이슬점','후반부 체감 부담을 살펴보세요.'],humidity:['습도','땀 배출이 불편한지 살펴보세요.'],rain:['비','노면 상태를 확인하세요.'],wind:['바람','바람이 강한 구간을 확인하세요.'],airQuality:['대기질','측정된 미세먼지 수치를 다시 확인하세요.'],uv:['자외선','노출이 적은 시간대를 고려하세요.']};
 const factor=primary&&primary[1]>=1?factorInfo[primary[0]]:null;
 const insights=[['권장 강도',intensity,intensityDetail],['지금 또는 나중',timing,timingDetail],['가장 큰 환경 변수',factor?`${factor[0]} −${Math.round(primary[1])}점`:'큰 감점 없음',factor?factor[1]:'점수에 큰 영향을 준 날씨 요인이 없습니다.']];
 $('coachInsights').innerHTML=insights.map(([label,value,detail])=>`<div class="coach-insight"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small class="coach-insight-detail">${escapeHtml(detail)}</small></div>`).join('');
 $('alerts').innerHTML=environmentAlerts(c).map(a=>`<span class="alert-chip">${escapeHtml(a)}</span>`).join('');
}

function renderWeekly(w,hourly){
 const today=currentSeoulDate();
 const days=w.daily.time;
 const scores=days.map(date=>dailyScore(rowsForDate(hourly,date)));
 const forecast=days.map((date,index)=>({date,index,score:scores[index]}))
   .filter(({date,score})=>date>=today&&Number.isFinite(score))
   .sort((a,b)=>a.date.localeCompare(b.date))
   .slice(0,4);
 const cards=$('weeklyCards');
 $('weeklyIndex').textContent=forecast.length?'07 / '+forecast.length+'-DAY':'07 / FORECAST';
 if(!forecast.length){
   cards.replaceChildren();
   $('selectedDayDetail').innerHTML='<p class="muted">표시할 수 있는 러닝 예보가 없습니다.</p>';
   return;
 }
 cards.style.setProperty('--forecast-columns',String(forecast.length));
 const selected=(forecast.find(day=>day.date===state.selectedWeekDate)??forecast[0]).index;
 const bestScore=Math.max(...forecast.map(day=>day.score));
 cards.innerHTML=forecast.map(({date,index,score})=>{
   const condition=scoreCondition(score);
   return `<button type="button" class="day-card ${index===selected?'active':''}" data-day-index="${index}"
    aria-pressed="${index===selected}" aria-label="${monthDay(date)} ${score}점 ${condition.label}">
    <span>${date===today?'오늘':weekday(date)} ${Number(date.slice(-2))}</span><strong>${score}</strong>
    <div class="week-score-track" data-score-condition="${condition.key}" aria-hidden="true"><i style="width:${score}%"></i></div>
    <small class="day-condition condition-${condition.key}">${score===bestScore?'BEST':condition.label}</small></button>`;
 }).join('');
 const buttons=cards.querySelectorAll('.day-card');
 for(const button of buttons)button.addEventListener('click',()=>{
   const index=Number(button.dataset.dayIndex);
   state.selectedWeekDate=days[index];
   for(const item of buttons){
     item.classList.toggle('active',item===button);
     item.setAttribute('aria-pressed',String(item===button));
   }
   renderSelectedDay(index,w,hourly,scores);
 });
 renderSelectedDay(selected,w,hourly,scores);
}
function renderSelectedDay(i,w,hourly,scores){
 const date=w.daily.time[i],allRows=rowsForDate(hourly,date),available=Number.isFinite(scores[i]),condition=scoreCondition(scores[i]);
 if(!available){$('selectedDayDetail').innerHTML=`<div class="week-detail-header"><strong>${monthDay(date)} (${weekday(date)})</strong><span>단기예보 범위 밖 · 점수 없음</span></div><p class="muted">중기예보 연결 전까지 점수와 추천 시간은 표시하지 않습니다.</p>`;return;}
 const remaining=date===currentSeoulDate()?allRows.filter(r=>r.time>=currentSeoulHour()):allRows;
 const best=findBestRunningTimes(allRows,1,state.duration)[0],stagnation=conditionFor('air_stagnation_index',w.daily.air_stagnation_index_max?.[i]);
 const missing=[...new Set(allRows.flatMap(r=>r.missing||[]))];
 const tiles=[['기온',`${formatValue(w.daily.temperature_2m_min[i],'°',0)}–${formatValue(w.daily.temperature_2m_max[i],'°C',0)}`],['강수확률',formatValue(w.daily.precipitation_probability_max[i],'%')],['최대 UV',formatValue(w.daily.uv_index_max[i],'',1)],['대기정체',stagnation.label]];
 $('selectedDayDetail').innerHTML=`<div class="week-detail-header"><strong>${monthDay(date)} (${weekday(date)}) <span class="condition-text-${condition.key}">${scores[i]??'—'}점 · ${condition.label}</span></strong><small>기상청 단기예보 · ${dailyCoverage(allRows).hours}/19시간 자료${dailyCoverage(allRows).coarse?' · 3시간 간격 예보를 확장한 추정':''}</small></div><div class="week-detail-tiles">${tiles.map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div><div class="week-best"><span>추천 러닝</span><strong>${best?`${timeOnly(best.start)}–${endLabel(best)}`:'추천 시간 없음'}</strong></div><div class="factor-row">${factorChips(allRows)}</div>${missing.length?`<p class="hourly-air-note">일부 시간대 미반영: ${escapeHtml(missing.join(" · "))}</p>`:""}`;
}
function renderWorkouts(c){const scores=workoutScores(c);$('workoutScores').innerHTML=Object.entries(scores).map(([name,score])=>{const condition=scoreCondition(score);return`<div class="workout-row" data-score-condition="${condition.key}"><span>${name}</span><div class="bar"><i style="width:${score??0}%"></i></div><strong>${score??'—'}</strong></div>`;}).join('');}
function renderGear(c){$('gearAdvice').innerHTML=Object.entries(gearAdvice(c)).map(([k,v])=>`<div class="gear-item"><span>${k}</span><strong>${v}</strong></div>`).join('');}

function calculatorTemplate(){const html=state.calcMode==='pace'?`<div class="field"><label for="paceInput">페이스 (분:초/km)</label><input id="paceInput" type="text" value="500" inputmode="numeric" autocomplete="off" aria-describedby="paceInputHint"><small id="paceInputHint">숫자만 입력: 530 → 5:30, 600 → 6:00 · 5:30도 가능</small></div>`:`<div class="field"><label for="speedInput">속도 (km/h)</label><input id="speedInput" type="text" inputmode="decimal" autocomplete="off" value="12" aria-describedby="speedInputHint"><small id="speedInputHint">소수점 입력 가능: 10.5 km/h</small></div>`;$('calculatorInputs').innerHTML=html;const input=$('calculatorInputs').querySelector('input');
 input.value=state.calcInputs[state.calcMode];
 input.addEventListener('input',()=>{
   state.calcInputs[state.calcMode]=input.value;
   calculate();
 });
 calculate();}
function calculate(){const pace=state.calcMode==='pace'?parsePaceInput($('paceInput')?.value):null;const speed=state.calcMode==='speed'?Number($('speedInput')?.value.trim().replace(',','.')):null;const data=state.calcMode==='pace'?(pace===null?null:fromPace(pace)):(Number.isFinite(speed)?fromSpeed(speed):null);if(!data||data.paceSeconds<120||data.paceSeconds>1800){$('calculatorError').textContent=state.calcMode==='pace'?'페이스를 200–3000 또는 2:00–30:00 형태로 입력해 주세요.':'속도를 2–30 km/h 범위에서 입력해 주세요.';$('resultPace').textContent='--:--/km';$('resultSpeed').textContent='-- km/h';$('splitResults').innerHTML='';return;}$('calculatorError').textContent='';$('resultPace').textContent=renderPace(data.paceSeconds);$('resultSpeed').textContent=`${round(data.speed,1)} km/h`;$('splitResults').innerHTML=Object.entries(data.splits).map(([n,s])=>`<div class="split-item"><span>${n}</span><strong>${secondsToClock(s)}</strong></div>`).join('');}

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
  state.controller?.abort();state.data=null;state.computed=null;state.location=loc;state.selectedWeekDate=null;state.hourlyDay=0;$('currentScore').textContent='--';$('currentGrade').textContent='조회 중';$('currentScoreFactors').innerHTML='';$('scoreDataStatus').textContent='선택한 지역의 자료를 조회하고 있습니다.';$('weatherMetrics').replaceChildren();$('weatherDetails').replaceChildren();$('currentWeatherCondition').textContent='조회 중';$('observationSource').textContent=loc.name+' 조회 중';$('bestTimes').innerHTML='';$('hourlyChart').innerHTML='';$('hourlyDetail').innerHTML='';
  $('locationConfirm').disabled=true;$('locationError').textContent='행정구역과 가까운 대기 측정소를 확인하고 있습니다…';
  for(const id of ['heroTemp','heroFeels','heroHumidity','heroDew','heroWind','heroUv'])$(id).textContent='--';
  renderDepartureComparison();
  $('currentScoreScale').hidden=true;
  $('daylightTimeline').hidden=true;
  $('todayBestTime').textContent='조회 중';$('updatedAt').textContent='조회 중';
  state.selectedLocation=null;setStored('location',state.location);$('locationConfirm').hidden=true;$('locationConfirm').disabled=false;$('locationDialog').close();loadData(true);
}
function locate(){if(!navigator.geolocation){$('locationError').textContent='이 브라우저는 위치 기능을 지원하지 않습니다.';return;}$('locationError').textContent='현재 위치와 주소를 확인하고 있습니다…';navigator.geolocation.getCurrentPosition(async pos=>{const latitude=round(pos.coords.latitude,6),longitude=round(pos.coords.longitude,6);try{chooseLocation(await reverseGeocode(latitude,longitude));}catch{chooseLocation({name:'현재 위치',address:'현재 위치',region1:'',region2:'',latitude,longitude});}},()=>{$('locationError').textContent='위치 권한이 거부되었거나 위치를 확인할 수 없습니다. 지역 검색을 이용해 주세요.';},{timeout:15000,maximumAge:300000,enableHighAccuracy:true});}
async function search(){const q=$('locationSearch').value.trim();if(q.length<2){$('locationError').textContent='주소나 장소명을 두 글자 이상 입력해 주세요.';return;}try{$('locationError').textContent='카카오에서 검색 중…';state.selectedLocation=null;$('locationConfirm').hidden=true;const results=await searchLocations(q);$('locationError').textContent=results.length?'검색 결과를 선택하면 지도에서 위치를 확인할 수 있습니다.':'검색 결과가 없습니다.';$('locationResults').innerHTML=results.map((r,i)=>`<button type="button" class="location-result" data-index="${i}" role="option"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml([r.category,r.roadAddress||r.address].filter(Boolean).join(' · '))}</small></button>`).join('');$('locationResults').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const r=results[Number(b.dataset.index)];previewLocation({name:r.name,address:r.address,roadAddress:r.roadAddress,region1:r.region1,region2:r.region2,region3:r.region3,areaNo:r.areaNo,latitude:r.latitude,longitude:r.longitude},b);}));if(results[0])previewLocation(results[0],$('locationResults').querySelector('button'));}catch(e){$('locationError').textContent=e.message;}}

mountDepartureComparison();
$('locationButton').addEventListener('click',()=>{$('locationDialog').showModal();setTimeout(()=>{initLocationMap();state.map?.relayout();showLocationOnMap(state.location);$('locationSearch').focus();},0);});$('locationConfirm').addEventListener('click',()=>{if(state.selectedLocation)chooseLocation(state.selectedLocation);});$('useMyLocation').addEventListener('click',locate);$('searchLocation').addEventListener('click',search);$('locationSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search();}});$('refreshButton').addEventListener('click',()=>loadData(true));$('themeButton').addEventListener('click',()=>selectDesign(document.documentElement.dataset.theme==='dark'?lightDesign:'night'));document.querySelectorAll('[data-hourly-day]').forEach((b,i)=>b.addEventListener('click',()=>{if(state.computed){state.hourlyDay=i;renderHourly();}}));$('hourlyNextDay').addEventListener('click',()=>{state.hourlyDay=1;renderHourly();});document.querySelectorAll('[data-duration]').forEach(b=>b.addEventListener('click',()=>{state.duration=Number(b.dataset.duration);setStored('runDuration',state.duration);document.querySelectorAll('[data-duration]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});if(state.data)render();}));document.querySelectorAll('[data-duration]').forEach(b=>{const active=Number(b.dataset.duration)===state.duration;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});const modeTabs=[...document.querySelectorAll('[data-calc-mode]')];
for (const [index, tab] of modeTabs.entries()) {
  tab.addEventListener('click',()=>{
    state.calcMode=tab.dataset.calcMode;
    for (const option of modeTabs) {
      const selected=option===tab;
      option.classList.toggle('active',selected);
      option.setAttribute('aria-selected',String(selected));
      option.tabIndex=selected?0:-1;
    }
    $('calculatorPanel').setAttribute('aria-labelledby',tab.id);
    calculatorTemplate();
  });
  tab.addEventListener('keydown',event=>{
    const next={ArrowLeft:(index+modeTabs.length-1)%modeTabs.length,
      ArrowRight:(index+1)%modeTabs.length,Home:0,End:modeTabs.length-1}[event.key];
    if(next===undefined)return;
    event.preventDefault();
    modeTabs[next].focus();
    modeTabs[next].click();
  });
}
addEventListener('online',()=>loadData(true));
addEventListener('offline',()=>loadData(true));

calculatorTemplate();loadData();
setInterval(()=>{if(document.visibilityState==='visible'&&!state.loading&&Date.now()-(state.lastAttempt||0)>=10*60000)loadData();},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(state.data)render();if(!state.loading&&Date.now()-(state.lastAttempt||0)>60000)loadData();}});
if('serviceWorker'in navigator)addEventListener('load',async()=>{try{const registration=await navigator.serviceWorker.register('./service-worker.js?v=58',{updateViaCache:'none'});registration.update();let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload();}});}catch{}});
