const CACHE='runwise-static-v15';
const STATIC=['./','./index.html','./styles.css?v=15','./responsive.css?v=12','./app.js?v=15','./weather.js?v=15','./air-quality.js?v=15','./running-score.js?v=14','./running-coach.js?v=14','./pace-calculator.js','./charts.js?v=12','./storage.js?v=15','./utils.js','./running-score-config.js?v=14','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET') return;
  if(url.origin!==self.location.origin){event.respondWith(fetch(event.request));return;}
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
