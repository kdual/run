import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../cloudflare-worker.js',import.meta.url),'utf8');
const gov=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {fetchAirStations, fetchJson, cachedPublicRoute};').toString('base64'));
let calls=0, active=0, peak=0;
globalThis.fetch=async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return Response.json({response:{header:{resultCode:'00'},body:{items:[{stationName:'test',dmX:37,dmY:127}]}}});};
await Promise.all([gov.fetchAirStations('경기','분당구','dummy'),gov.fetchAirStations('경기','분당구','dummy')]);
assert.equal(calls,2);assert.equal(peak,2);
await gov.fetchAirStations('경기','분당구','dummy');assert.equal(calls,2);
await gov.fetchAirStations('경기','시흥시','dummy');assert.equal(calls,3,'province metadata reused across districts');
const realNow=Date.now;Date.now=()=>realNow()+86400001;
await gov.fetchAirStations('경기','분당구','dummy');assert.equal(calls,5);Date.now=realNow;
let attempts=0;
globalThis.fetch=async()=>{attempts++;return new Response('',{status:403});};
await assert.rejects(gov.fetchJson('https://test','API'),/403/);assert.equal(attempts,1);
globalThis.fetch=()=>new Promise(()=>{});
let start=Date.now();await assert.rejects(gov.fetchJson('https://test','API',{timeoutMs:10,deadlineMs:Date.now()+25}),/응답 시간 초과/);assert(Date.now()-start<200);
globalThis.fetch=async()=>({ok:true,text:()=>new Promise(()=>{})});
await assert.rejects(gov.fetchJson('https://test','API',{timeoutMs:10,deadlineMs:Date.now()+25}),/응답 시간 초과/);
const entries=new Map();globalThis.caches={default:{match:async r=>entries.get(r.url)?.clone(),put:async(r,res)=>entries.set(r.url,res.clone())}};
let routeCalls=0;const request=new Request('https://test/air?sidoName=서울');const url=new URL(request.url);
const handler=async()=>{routeCalls++;return Response.json({current:{pm2_5:10,measured_at:'2026-10-10 13:00'}},{headers:{'Cache-Control':'public, max-age=60, s-maxage=60'}});};
await gov.cachedPublicRoute(request,url,{}, {},handler);
const cached=await gov.cachedPublicRoute(request,url,{}, {},handler);assert.equal(routeCalls,1);assert.equal((await cached.json()).current.measured_at,'2026-10-10 13:00');assert.match(cached.headers.get('Cache-Control'),/max-age=60/);
for(const failure of [()=>Response.json({error:'failed'},{status:500}),()=>Response.json({current:null})]){entries.clear();for(let i=0;i<2;i++)await gov.cachedPublicRoute(request,url,{}, {},failure);assert.equal(entries.size,0);}
// Verify actual air route cache header, not just the cache helper.
entries.clear();globalThis.fetch=async()=>Response.json({response:{header:{resultCode:'00'},body:{items:[{stationName:'송파구',dataTime:'2026-10-10 13:00',pm25Value:'10',pm10Value:'20',khaiValue:'30'}]}}});
const actual=await gov.default.fetch(new Request('https://test/air?sidoName=서울&stationName=송파구'),{DATA_GO_KR_SERVICE_KEY:'dummy'});assert.equal(actual.status,200);assert.match(actual.headers.get('Cache-Control'),/max-age=60/);assert.equal((await actual.json()).current.pm2_5,10);
const context=vm.createContext({window:{}});const weather=new vm.SourceTextModule(fs.readFileSync(new URL('../weather.js',import.meta.url),'utf8'),{context});
await weather.link(spec=>new vm.SourceTextModule(spec.includes('request')?'export const requestJson=()=>{};':'export const APP_CONFIG={};',{context}));await weather.evaluate();
const place={id:'1',place_name:'야탑',address_name:'경기 성남시 분당구',x:'127.1',y:'37.4'};
const address={address_name:'서울 송파구',x:'127.2',y:'37.5'};
function mock(p,a){context.window.kakao={maps:{services:{Status:{OK:'OK',ZERO_RESULT:'ZERO'},Places:class{keywordSearch(q,cb){cb([place],p);}},Geocoder:class{addressSearch(q,cb){cb([address],a);}}}}};}
mock('ERROR','OK');assert.equal((await weather.namespace.searchLocations('test'))[0].category,'주소');
mock('OK','ERROR');assert.equal((await weather.namespace.searchLocations('test'))[0].name,'야탑');
mock('ERROR','ERROR');await assert.rejects(weather.namespace.searchLocations('test'),/검색에 실패/);
mock('ZERO','ZERO');assert.equal((await weather.namespace.searchLocations('test')).length,0);
console.log('PASS: parallel station lookup, 24h metadata and in-flight reuse, cross-district reuse, bounded fetch/body, no retry on 403, 60s success cache, no failure cache, measured timestamp, partial location search');
