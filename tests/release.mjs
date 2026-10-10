import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');assert.match(html,/data-version="40"/);assert.match(html,/dapi.kakao.com/);assert.match(html,/manifest.json/);assert.doesNotMatch(html,/RUNWISE LAB|noindex/);
for(const name of fs.readdirSync('.').filter(n=>n.endsWith('.js')&&n!=='service-worker.js'&&n!=='cloudflare-worker.js')){
 const source=fs.readFileSync(name,'utf8');assert.doesNotMatch(source,/review-scenarios|reviewScenario/);
 for(const match of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g)){assert(match[1].endsWith('?v=40'),name+' release import');assert(fs.existsSync(match[1].split('?')[0]));}
 await import('../'+name+'?v=40').catch(e=>{if(name!=='app.js')throw e;});
}
const sw=fs.readFileSync('service-worker.js','utf8'),staticList=JSON.parse(sw.match(/const STATIC=(.*);/)[1]);for(const resource of staticList){if(resource!=='./')assert(fs.existsSync(resource.split('?')[0]),resource);}
const listeners={};const previous=['runwise-static-v39','runwise-static-v40','other-app-cache'];const removed=[];
vm.runInNewContext(sw,{self:{addEventListener:(kind,f)=>listeners[kind]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}},location:{origin:'https://kdual.github.io',href:'https://kdual.github.io/run/service-worker.js?v=40'}},caches:{keys:async()=>previous,delete:async key=>removed.push(key)},URL});
let activated;listeners.activate({waitUntil:p=>activated=p});await activated;assert.deepEqual(removed,['runwise-static-v39']);
const workerSource=fs.readFileSync('cloudflare-worker.js','utf8')+'\nexport {fetchAirStations};';const worker=await import('data:text/javascript;base64,'+Buffer.from(workerSource).toString('base64'));
let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({response:{header:{resultCode:'00'},body:{items:[{stationName:'test',dmX:37,dmY:127}]}}});};await Promise.all([worker.fetchAirStations('경기','성남','dummy'),worker.fetchAirStations('경기','성남','dummy')]);assert.equal(calls,2);await worker.fetchAirStations('경기','성남','dummy');assert.equal(calls,2);
console.log('PASS: production assets/imports, Kakao/PWA, service-worker upgrade, server station cache/coalescing');
