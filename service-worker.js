const CACHE='runwise-static-v8';
const STATIC=['./','./index.html','./styles.css?v=8','./responsive.css?v=8','./app.js?v=8','./weather.js?v=8','./air-quality.js','./running-score.js?v=8','./running-coach.js','./pace-calculator.js','./charts.js?v=8','./storage.js','./utils.js','./running-score-config.js','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.hostname.includes('open-meteo.com')) return;
  if(event.request.method!=='GET') return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
