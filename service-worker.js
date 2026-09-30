const CACHE='runwise-static-v38';
const STATIC=['./','./index.html','./styles.css?v=38','./responsive.css?v=20','./app.js?v=38','./weather.js?v=38','./air-quality.js?v=38','./request.js?v=38','./running-score.js?v=38','./running-coach.js?v=38','./pace-calculator.js?v=30','./charts.js?v=38','./storage.js?v=19','./solar-times.js?v=38','./utils.js','./running-score-config.js?v=14','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('runwise-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 const navigation=event.request.mode==='navigate';
 if(!navigation&&!STATIC.some(path=>new URL(path,self.location.href).href===url.href))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
  return response;
 }).catch(async()=>await caches.match(event.request)||(navigation?await caches.match('./index.html'):null)||Response.error()));
});
