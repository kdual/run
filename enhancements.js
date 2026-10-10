import {getStored,setStored,setCache} from './storage.js?v=40';
import {hourlySlots,riskAssessment,weatherOnlyScore,comparableDays,findBestRunningTimes,inRunningWindow} from './running-score.js?v=40';
import {gearAdvice} from './running-coach.js?v=40';
import {solarTimes} from './solar-times.js?v=40';
import {escapeHtml as esc,timeOnly,formatValue} from './utils.js?v=40';
import {fetchAirQuality} from './air-quality.js?v=40';
const $=id=>document.getElementById(id);
export const QUICK_REGIONS=[
 {name:'서울 송파구',region1:'서울',region2:'송파구',region3:'송파구',areaNo:'1171000000',latitude:37.5145,longitude:127.1059},
 {name:'올림픽공원',region1:'서울',region2:'송파구',region3:'방이동',areaNo:'1171000000',latitude:37.5207,longitude:127.1215},
 {name:'잠실한강공원',region1:'서울',region2:'송파구',region3:'잠실동',areaNo:'1171000000',latitude:37.5176,longitude:127.0823},
 {name:'성남 야탑',region1:'경기',region2:'성남시 분당구',region3:'야탑동',areaNo:'4113500000',latitude:37.412,longitude:127.128},
 {name:'시흥 정왕동',region1:'경기',region2:'시흥시',region3:'정왕동',areaNo:'4139000000',latitude:37.346,longitude:126.738},
 {name:'부산 해운대',region1:'부산',region2:'해운대구',region3:'우동',areaNo:'2635000000',latitude:35.163,longitude:129.163},
 {name:'대전 둔산동',region1:'대전',region2:'서구',region3:'둔산동',areaNo:'3017000000',latitude:36.351,longitude:127.378}
];
const defaultPrefs={weekdayStart:20,weekdayEnd:23,weekendStart:7,weekendEnd:23,enabled:false};
export function windowFor(prefs,date){const weekend=[0,6].includes(new Date(date+'T12:00:00+09:00').getUTCDay());return prefs.enabled?{start:weekend?prefs.weekendStart:prefs.weekdayStart,end:weekend?prefs.weekendEnd:prefs.weekdayEnd}:{start:5,end:24};}
export function evaluatePlan(rows,start,duration,paceSeconds){
 const begin=Date.parse(start+':00+09:00'),end=begin+duration*60000;
 const selected=hourlySlots(rows).map(r=>{const t=Date.parse(r.time+':00+09:00');return {r,overlap:Math.max(0,Math.min(end,t+3600000)-Math.max(begin,t))};}).filter(x=>x.overlap>0);
 const coverage=selected.reduce((s,x)=>s+x.overlap,0),complete=coverage===end-begin;
 const risks=[...new Set(selected.flatMap(x=>riskAssessment(x.r).reasons))];
 return {rows:selected.map(x=>x.r),complete,score:complete?Math.round(selected.reduce((s,x)=>s+x.overlap*weatherOnlyScore(x.r),0)/coverage):null,distance:Number.isFinite(paceSeconds)&&paceSeconds>0?duration*60/paceSeconds:null,risks,conditional:selected.some(x=>riskAssessment(x.r).conditional),end};
}
export function createEnhancements({state,render,loadData,chooseLocation}){
 const prefs={...defaultPrefs,...getStored('preferences',{})};let retrying=false;let planStart='',lastPlan=null;const scenario='live';
 const hours=Array.from({length:20},(_,i)=>i+5);
 const options=(end=false)=>hours.filter(h=>end||h<24).map(h=>`<option value="${h}">${String(h).padStart(2,'0')}:00</option>`).join('');
 const banner=document.createElement('div');banner.className='region-toolbar';banner.innerHTML='<div><b>RUNWISE <span>40</span></b><small>자주 찾는 지역으로 빠르게 이동</small></div>';document.querySelector('main').prepend(banner);
 const nav=document.createElement('nav');nav.className='quick-nav';nav.innerHTML='<a href="#top">지금</a><a href="#runPlan">러닝 계획</a><a href="#hourlyTitle">시간별</a><a href="#weeklyTitle">예보</a><a href="#pace">페이스</a>';banner.after(nav);
 const plan=document.createElement('section');plan.className='card planning-card';plan.id='runPlan';plan.innerHTML=`<div class="section-heading"><div><p class="eyebrow">MY RUN PLAN</p><h2>나의 다음 러닝</h2></div><span class="rule-badge">출발부터 도착까지</span></div>
 <div class="plan-controls"><label>출발 날짜<input type="date" id="planDate"></label><label>출발 시각<select id="planTime"></select></label><label>러닝 시간<select id="planDuration"><option value="30">30분</option><option value="60">60분</option><option value="120">120분</option></select></label><label>페이스<span id="planPace">5:00/km</span><a href="#pace">변경하기 ↗</a></label></div>
 <div id="planResult" class="plan-result" aria-live="polite">날씨를 확인한 뒤 출발 시간을 선택하세요.</div>
 <details class="review-details"><summary>러닝 가능한 시간 설정</summary><p>이 시간 안에서만 추천합니다. 05:00–24:00 범위이며 종료 시각은 출발 제한이 아니라 러닝을 마칠 시각입니다.</p><label class="check-row"><input type="checkbox" id="windowEnabled"> 내 러닝 시간 적용</label><div class="preference-grid"><label>평일 시작<select id="weekdayStart">${options()}</select></label><label>평일 종료<select id="weekdayEnd">${options(true)}</select></label><label>주말 시작<select id="weekendStart">${options()}</select></label><label>주말 종료<select id="weekendEnd">${options(true)}</select></label></div><button id="saveWindow" type="button">시간 설정 저장</button><p id="windowStatus" role="status"></p></details>
 <details class="review-details"><summary>내 코스 저장 · 불러오기</summary><p>현재 선택한 지역과 직접 입력한 코스 조건을 저장합니다. 그늘·조명은 현장 실측 정보가 아닙니다.</p><div id="courseList" class="course-list"></div><div class="preference-grid"><label>코스 이름<input id="courseName" maxlength="30" placeholder="예: 주말 올림픽공원"></label><label>조명<select id="courseLight"><option value="unknown">확인 안 함</option><option value="yes">있음 · 직접 확인</option><option value="no">적음 / 없음</option></select></label><label>바람 노출<select id="courseWind"><option value="unknown">확인 안 함</option><option value="open">노출 구간 많음</option><option value="sheltered">가려진 구간 많음</option></select></label></div><p>그늘은 상단 ‘코스 그늘 조건’을 함께 저장합니다.</p><button id="saveCourse" type="button">현재 지역을 코스로 저장</button><p id="courseStatus" role="status"></p></details>`;
 $('top').after(plan);
 const dataPanel=document.createElement('details');dataPanel.className='card review-details data-panel';dataPanel.innerHTML='<summary>자료 시각 · 갱신 상태 확인</summary><div id="dataHealth"></div><button id="retryAir" type="button">대기질만 다시 조회</button><p id="retryAirStatus" role="status"></p>';plan.after(dataPanel);
 $('windowEnabled').checked=prefs.enabled;for(const id of ['weekdayStart','weekdayEnd','weekendStart','weekendEnd'])$(id).value=prefs[id];
 $('saveWindow').onclick=()=>{const next={enabled:$('windowEnabled').checked};for(const id of ['weekdayStart','weekdayEnd','weekendStart','weekendEnd'])next[id]=Number($(id).value);if(next.weekdayEnd<=next.weekdayStart||next.weekendEnd<=next.weekendStart){$('windowStatus').textContent='종료 시각을 시작보다 늦게 선택하세요.';return;}Object.assign(prefs,next);setStored('preferences',prefs);$('windowStatus').textContent='저장했습니다. 추천 시간과 오늘·내일 비교에 반영합니다.';if(state.data)render();};
 const regionSelect=document.createElement('select');regionSelect.id='quickRegion';regionSelect.setAttribute('aria-label','빠른 지역 선택');regionSelect.innerHTML='<option value="">지역 선택</option>'+QUICK_REGIONS.map((l,i)=>`<option value="${i}">${l.name}</option>`).join('');const label=document.createElement('label');label.textContent='지역 ';label.append(regionSelect);banner.append(label);regionSelect.onchange=()=>{if(regionSelect.value==='')return;planStart='';state.course=null;chooseLocation(QUICK_REGIONS[+regionSelect.value]);};
 $('planDate').onchange=()=>{planStart='';renderPlan();};$('planTime').onchange=()=>{planStart=$('planDate').value+'T'+$('planTime').value;renderPlan();};$('planDuration').value=state.duration;$('planDuration').onchange=()=>{state.duration=+$('planDuration').value;setStored('runDuration',state.duration);render();};
 $('retryAir').onclick=async()=>{if(retrying)return;if(scenario!=='live'){$('retryAirStatus').textContent='검증 데이터입니다. 실제 데이터 조회로 전환해 주세요.';return;}retrying=true;$('retryAir').disabled=true;const controller=new AbortController(),loc={...state.location};$('retryAirStatus').textContent='대기질만 조회 중입니다…';try{const air=await fetchAirQuality(loc,controller.signal);if(state.location.latitude!==loc.latitude||state.location.longitude!==loc.longitude||scenario!=='live')return;if(!state.data?.weather)throw new Error('먼저 날씨를 불러와 주세요.');state.data={...state.data,air,airError:false,airPending:false,airStale:false};setCache(loc,state.data);render();$('retryAirStatus').textContent='대기질 조회를 마쳤습니다.';$('errorBanner').textContent=[state.data.weatherError?'최신 날씨 조회에 실패해 저장된 관측을 표시합니다.':'',state.data.weather?.life_indices?.uv!=='ok'||state.data.weather?.life_indices?.air_stagnation!=='ok'?'일부 생활기상지수를 조회하지 못했습니다.':''].filter(Boolean).join(' ');$('errorBanner').hidden=!$('errorBanner').textContent;}catch(e){$('retryAirStatus').textContent='조회 실패: '+e.message;}finally{retrying=false;$('retryAir').disabled=false;}};
 const courseRender=()=>{const list=getStored('courses',[]);$('courseList').innerHTML=list.length?list.map((c,i)=>`<div><button type="button" data-course="${i}">${esc(c.name)}</button><button type="button" data-remove-course="${i}" aria-label="${esc(c.name)} 삭제">×</button></div>`).join(''):'<small>저장한 코스가 없습니다.</small>';$('courseList').querySelectorAll('[data-course]').forEach(b=>b.onclick=()=>{const c=list[+b.dataset.course];state.course=c;state.routeShade=c.shade;$('routeShade').value=c.shade;setStored('routeShade',c.shade);planStart='';chooseLocation(c.location);});$('courseList').querySelectorAll('[data-remove-course]').forEach(b=>b.onclick=()=>{list.splice(+b.dataset.removeCourse,1);setStored('courses',list);courseRender();});};
 $('saveCourse').onclick=()=>{const name=$('courseName').value.trim();if(!name){$('courseStatus').textContent='코스 이름을 입력하세요.';return;}const list=getStored('courses',[]);const course={name,location:{...state.location},shade:state.routeShade,light:$('courseLight').value,wind:$('courseWind').value};const same=list.findIndex(c=>c.name===name);if(same>=0)list[same]=course;else list.push(course);setStored('courses',list.slice(-12));state.course=course;$('courseStatus').textContent='현재 지역·그늘·조명·바람 노출을 저장했습니다.';courseRender();renderPlan();};courseRender();
 // Expand existing feedback with context, retaining local-only storage.
 const feelExtra=document.createElement('div');feelExtra.className='preference-grid';feelExtra.innerHTML='<label>활동 강도<select id="feelEffort"><option value="easy">가벼운 러닝</option><option value="steady">보통 강도</option><option value="hard">높은 강도</option></select></label><label>온도 체감<select id="feelThermal"><option value="comfortable">적당함</option><option value="hot">더웠음</option><option value="cold">추웠음</option></select></label><label>복장<input id="feelClothes" maxlength="50" placeholder="예: 반팔 · 쇼츠"></label>';
 document.querySelector('.feel-buttons').before(feelExtra);
 const exportButton=document.createElement('button');exportButton.textContent='체감 기록 내보내기';exportButton.type='button';exportButton.onclick=()=>{const records=getStored('feelLog',[]);const blob=new Blob([JSON.stringify(records,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='runwise-feel-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);};$('clearFeels').before(exportButton);
 // Compact secondary content without hiding active primary controls.
 for(const id of ['tableTitle','coachTitle']){const title=$(id),section=title.closest('section');const details=document.createElement('details');details.className='card review-details secondary-section';details.innerHTML=`<summary>${title.textContent}</summary>`;while(section.firstChild)details.append(section.firstChild);section.replaceWith(details);}
 document.querySelector('.score-method p:nth-of-type(2)').textContent='점수 상한과 권고는 보수적인 설계 규칙이며 개인 체감·의학적 안전을 검증한 척도가 아닙니다. 환경 점수와 자료 확인 상태를 함께 보세요. 위험 조건은 현재·시간별·추천·훈련 화면에 동일하게 적용합니다.';
 function renderPlan(){
  if(!state.computed)return;const {hourly,today,best}=state.computed;
  const dates=[...new Set(hourly.map(r=>r.time.slice(0,10)))].filter(d=>d>=today);
  if(!dates.includes($('planDate').value))$('planDate').value=dates[0]||today;$('planDate').min=today;$('planDate').max=dates.at(-1)||today;
  const date=$('planDate').value,now=new Date(),nowText=new Date(+now+9*3600000).toISOString().slice(0,16);
  const candidates=hourlySlots(hourly.filter(r=>r.time.startsWith(date))).filter(r=>r.time>=nowText);
  if(date===today&&best?.[0])candidates.unshift({time:best[0].start});
  const times=[...new Set(candidates.map(r=>timeOnly(r.time)))].sort();
  $('planTime').innerHTML=times.map(t=>`<option>${t}</option>`).join('')||'<option value="">남은 시간 없음</option>';
  if(!planStart.startsWith(date)||!times.includes(timeOnly(planStart)))planStart=times.length?date+'T'+times[0]:'';
  if(planStart)$('planTime').value=timeOnly(planStart);$('planDuration').value=state.duration;
  $('planPace').textContent=$('resultPace').textContent;
  if(!planStart){$('planResult').textContent='이 날짜에 선택할 출발 시간이 없습니다. 다음 날짜를 선택하세요.';lastPlan=null;return;}
  const result=evaluatePlan(hourly,planStart,state.duration,state.paceSeconds??NaN);lastPlan=result;
  const selected=result.rows,first=selected[0],last=selected.at(-1);const sun=solarTimes(date,state.location.latitude,state.location.longitude);
  const dark=first&& (planStart<sun.sunrise||new Date(result.end+9*3600000).toISOString().slice(0,16)>sun.sunset);
  const gear=first?gearAdvice(first):null,risks=result.risks;
  const condition=risks.length?'주의 조건 포함':result.conditional?'대기질 확인 필요':'확인된 자료 기준';
  const end=new Date(result.end+9*3600000).toISOString().slice(11,16);
  $('planResult').innerHTML=`<div class="plan-lead"><div><small>${esc(state.course?.name||state.location.name)} · ${date}</small><h3>${timeOnly(planStart)} <span>→</span> ${end}</h3></div><div><strong>${result.distance?.toFixed(1)||'—'}<small> km</small></strong><p>일정 페이스 기준 예상 거리</p></div></div><div class="plan-tags"><span>${result.complete?'기상 기준 '+result.score+'점 · 대기질·UV 제외':'전체 구간 자료 부족'}</span><span>${condition}</span>${dark?'<span>야간 포함 · 조명 필요</span>':''}</div>${risks.length?`<p class="plan-warning">${esc(risks.join(' · '))} — 점수보다 이 조건을 먼저 확인하세요.</p>`:''}<div class="plan-facts"><div><small>체감 변화</small><b>${first?formatValue(first.apparent_temperature,'°C'): '—'} → ${last?formatValue(last.apparent_temperature,'°C'):'—'}</b></div><div><small>구간 최대 강수확률</small><b>${selected.length?Math.max(...selected.map(r=>r.precipitation_probability||0))+'%':'—'}</b></div><div><small>추천 복장 · 출발 기준</small><b>${esc(gear?.상의||'자료 없음')}</b></div><div><small>코스 조건</small><b>${dark?(state.course?.light==='yes'?'조명 있음 · 직접 확인':state.course?.light==='no'?'조명 적음 · 장비 확인':'조명 정보 확인 필요'):'주간 구간'}${state.course?.wind==='open'?' · 바람 노출 많음':''}</b></div></div><small>${result.complete?'':'일부 예보만 있어 전체 러닝 조건은 확정할 수 없습니다. '}${result.conditional?'미래 대기질 실측은 없습니다. 출발 전 다시 확인하세요.':'예보는 실제 출발 전에 다시 확인하세요.'}</small>`;
 }
 function update(c){
  const r=riskAssessment(c),label=r.level==='avoid'?'야외 추천 제한':r.level==='caution'?'주의':r.conditional?'대기질 미확인':null;
  if(label){$('currentGrade').textContent=label;$('currentGrade').className='grade-pill '+(r.level==='avoid'?'condition-very-bad':r.level==='caution'?'condition-bad':'condition-unknown');$('currentWeatherCondition').textContent=(c.score??'—')+'점 · '+label;$('top').dataset.condition=r.level==='avoid'?'very-bad':r.level==='caution'?'bad':'unknown';$('currentWeatherCard').dataset.condition=$('top').dataset.condition;}
  $('todaySummary').textContent='설정한 시간 안에서 오늘 남은 구간의 상위 최대 4시간 평균 · 과거 시간 제외';
  $('todayGrade').textContent=state.computed.best.some(b=>b.conditional)?'대기질 확인 필요':$('todayGrade').textContent;
  const tomorrow=state.computed.tomorrowRows.filter(r=>inRunningWindow(r.time,windowFor(prefs,r.time.slice(0,10))));const comparison=comparableDays(state.computed.futureTodayRows,tomorrow,windowFor(prefs,state.computed.today));
  $('comparisonMessage').textContent=comparison?`같은 ${comparison.count}개 시간대 비교 · 기상 기준 오늘 ${comparison.today} / 내일 ${comparison.tomorrow}점 · 대기질·UV 제외`:'공통 시간대 자료가 없어 비교할 수 없습니다.';
  const best=state.computed.best;$('bestTimes').innerHTML=best.length?best.map((b,i)=>`<li><span class="medal">${['①','②','③'][i]}</span><span><strong>${timeOnly(b.start)}–${timeOnly(b.end)}</strong><small>${b.durationMinutes}분 · ${b.basis==='weather'?'기상 기준 비교':'확인된 항목 기준'}${b.conditional?' · 대기질 확인 필요':''}</small></span><button type="button" data-plan="${b.start}" class="plan-use">${b.score}점<br><small>계획 보기</small></button></li>`).join(''):'<li class="best-empty"><span>설정 시간과 러닝 길이에 맞는 추천이 없습니다. 위험 조건 또는 자료 부족 여부도 확인해 주세요.</span></li>';$('bestTimes').querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{planStart=b.dataset.plan;$('planDate').value=planStart.slice(0,10);renderPlan();$('runPlan').scrollIntoView({behavior:'smooth',block:'start'});});
  const factors=document.querySelectorAll('.coach-insight');if(r.reasons.length&&factors[0]){factors[0].querySelector('strong').textContent=r.level==='avoid'?'야외 추천 제한':'주의 조건 확인';factors[0].querySelector('small').textContent=r.reasons.join(' · ');}if(!r.airKnown&&factors[0])factors[0].querySelector('small').textContent='대기질 확인 전에는 강도를 확정하지 않습니다.';
  if(c.apparent_temperature<5&&factors[2])factors[2].querySelector('small').textContent='추위 · 보온과 바람, 젖은 노면을 확인하세요.';
  $('workoutScores').innerHTML=['회복주','이지런','롱런','템포','인터벌','레이스'].map((n,i)=>{const stateLabel=!Number.isFinite(c.score)?'자료 부족':r.level==='avoid'?'추천 제한':r.conditional?'대기질 확인 후':r.level==='caution'?(i>=2?'고강도·장시간 주의':'조건 확인 후 판단'):(i>=2&&c.score<80?'강도 조절':'환경상 무난');return `<div class="workout-row"><span>${n}</span><strong class="suitability">${stateLabel}</strong></div>`;}).join('');
  const air=state.data.air?.current,weather=state.data.weather;
  $('dataHealth').innerHTML=`<div class="health-grid"><div><small>기상 관측</small><b>${esc(weather.current.time.replace('T',' '))}</b></div><div><small>대기질 측정</small><b>${esc(air?.measured_at||'확인 안 됨')}</b></div><div><small>조회 상태</small><b>${state.data.airPending?'대기질 갱신 중':state.data.airError?'최신 조회 실패':r.airKnown?'측정값 사용':'대기질 미반영'}</b></div><div><small>예보 자료</small><b>${esc(weather.source_updated_at||'발표 시각 미제공')}</b></div></div><p>화면 조회 시각과 측정 시각은 다릅니다. 오래된 대기질은 종합 판단에 사용하지 않습니다.</p>`;
  const sun=solarTimes(state.computed.today,state.location.latitude,state.location.longitude);
  if(sun){$('civilDawn').textContent=timeOnly(sun.civil_dawn);$('civilDusk').textContent=timeOnly(sun.civil_dusk);}
  renderPlan();
 }
 return {update,renderPlan,getWindow:(date)=>windowFor(prefs,date||state.computed?.today||new Date().toISOString().slice(0,10)),getFeelContext:()=>({effort:$('feelEffort').value,thermal:$('feelThermal').value,clothes:$('feelClothes').value.trim(),course:state.course?.name||null}),scenario:()=>scenario};
}
