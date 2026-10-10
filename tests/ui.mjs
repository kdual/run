import assert from 'node:assert/strict';import fs from 'node:fs';import {parseHTML} from 'linkedom';
import {scenarioData} from './fixtures.mjs';
const {window,document}=parseHTML(fs.readFileSync('index.html','utf8'));
const memory=new Map([['runwise:v2:location',JSON.stringify({name:'기존 지역',latitude:37.5145,longitude:127.1059,region1:'서울',region2:'송파구',areaNo:'1171000000'})],['runwise:v2:theme','\"dark\"'],['runwise:v2:feelLog',JSON.stringify([{model:'39',feel:'similar'}])]]);const media=()=>({matches:false,addEventListener(){},removeEventListener(){}});
Object.assign(globalThis,{window,document,localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},matchMedia:media,addEventListener:()=>{},setInterval:()=>0,requestAnimationFrame:f=>f()});
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
window.matchMedia=media;window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.scrollTo=function(){};
window.HTMLElement.prototype.close=function(){};window.HTMLElement.prototype.showModal=function(){};
Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get(){return 960;}});
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.getAttribute('value')??this.querySelector('option[selected]')?.textContent??this.querySelector('option')?.getAttribute('value')??this.querySelector('option')?.textContent??'';},set(value){this.querySelectorAll('option').forEach(o=>{if((o.getAttribute('value')??o.textContent)===String(value))o.setAttribute('selected','');else o.removeAttribute('selected');});},configurable:true});
const fixture=scenarioData(process.env.RUNWISE_SCENARIO||'normal',{latitude:37.5145,longitude:127.1059});delete fixture.scenario;
globalThis.fetch=async url=>{const p=String(url).split('?')[0];return Response.json(p.endsWith('/weather')?fixture.weather:p.endsWith('/air')?fixture.air:p.endsWith('/forecast')?{daily:[]}:{alerts:[]});};
const errors=[];process.on('unhandledRejection',e=>errors.push(e));
await import('../app.js');await new Promise(r=>setTimeout(r,60));
const $=id=>document.getElementById(id);const event=(id,kind='change')=>$(id).dispatchEvent(new window.Event(kind,{bubbles:true}));
assert.equal(errors.length,0,errors.map(String).join('\n'));
assert.match($('planResult').textContent,/km/);if(process.env.RUNWISE_SCENARIO!=='missing')assert.equal($('errorBanner').textContent,'');
assert.equal($('reviewScenario'),null);
assert.equal(document.documentElement.dataset.theme,'dark');
assert.equal($('headerLocation').textContent,'기존 지역');
const backup=JSON.parse(memory.get('runwise:rollback:v39:20261010'));assert.equal(JSON.parse(backup.values.feelLog)[0].model,'39');
if(process.env.RUNWISE_SCENARIO==='pollution'){assert.equal($('currentScore').textContent,'39');assert.match($('workoutScores').textContent,/추천 제한/);}
if(process.env.RUNWISE_SCENARIO==='cold'){assert.equal($('currentScore').textContent,'39');assert.match($('coachMessage').textContent,/추위/);}
if(process.env.RUNWISE_SCENARIO==='missing'){assert.match($('currentGrade').textContent,/미확인/);assert.match($('runNowMessage').textContent,/확인/);}
$('paceMinutes').value='6';$('paceSeconds').value='00';event('paceMinutes','input');assert.equal($('resultSpeed').textContent,'10 km/h');assert.match($('planPace').textContent,/6:00/);
$('paceSeconds').value='99';event('paceSeconds','input');assert.match($('calculatorError').textContent,/유효/);assert.match($('planResult').textContent,/—/);
$('paceSeconds').value='00';event('paceSeconds','input');
document.querySelector('[data-calc-mode="speed"]').click();$('speedInput').value='10,5';event('speedInput','input');assert.equal($('resultSpeed').textContent,'10.5 km/h');$('speedPlus').onclick();assert.equal($('resultSpeed').textContent,'10.6 km/h');
$('windowEnabled').checked=true;$('weekdayStart').value='20';$('weekdayEnd').value='23';$('weekendStart').value='20';$('weekendEnd').value='23';$('saveWindow').onclick();assert.match($('windowStatus').textContent,/저장/);
$('courseName').value='테스트 코스';$('saveCourse').onclick();assert.match($('courseList').textContent,/테스트 코스/);
$('feelClothes').value='반팔';$('feelThermal').value='hot';document.querySelector('[data-feel="harder"]').click();assert.match($('feelSummary').textContent,/더웠음 1회/);
assert.equal(errors.length,0,errors.map(String).join('\n'));
console.log('PASS: production DOM — '+(process.env.RUNWISE_SCENARIO||'normal')+', v39 preference/feedback retention, pace/speed, preferences, course and feedback');

