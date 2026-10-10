const CACHE='runwise-static-v40';
const STATIC=["./", "./index.html", "./enhancements.css?v=40", "./responsive.css?v=40", "./styles.css?v=40", "./air-quality.js?v=40", "./app.js?v=40", "./charts.js?v=40", "./enhancements.js?v=40", "./pace-calculator.js?v=40", "./request.js?v=40", "./running-coach.js?v=40", "./running-score-config.js?v=40", "./running-score.js?v=40", "./solar-times.js?v=40", "./storage.js?v=40", "./utils.js?v=40", "./weather.js?v=40", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('runwise-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 const navigation=event.request.mode==='navigate';
 if(!navigation&&!STATIC.some(path=>new URL(path,self.location.href).href===url.href))return;
 event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
  return response;
 }).catch(async()=>await caches.match(event.request)||(navigation?await caches.match('./index.html'):null)||Response.error()));
});
