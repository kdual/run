const PREFIX = 'runwise:v2:';
// Keep the previous preference and feedback values before the first v40 write.
// Old weather-cache-v4 remains untouched for a v39 rollback.
const BACKUP_KEY='runwise:rollback:v39:20261010';
try {
 if(!localStorage.getItem(BACKUP_KEY)) {
  const values={};
  for(const key of ['location','theme','routeShade','runDuration','feelLog','paceSeconds','preferences','courses']) {
   const value=localStorage.getItem(PREFIX+key);if(value!==null)values[key]=value;
  }
  localStorage.setItem(BACKUP_KEY,JSON.stringify({savedAt:new Date().toISOString(),values}));
 }
} catch { /* Storage may be disabled; existing values are never removed. */ }

export function getStored(key, fallback = null) { try { const v = localStorage.getItem(PREFIX + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
export function setStored(key, value) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* private mode/full storage */ } }
const cacheKey=loc=>[Number(loc.latitude).toFixed(4),Number(loc.longitude).toFixed(4)].join(',');
export function getCache(location){return getStored('weather-cache-map-v40',{})[cacheKey(location)]||null;}
export function setCache(location,payload){const all=getStored('weather-cache-map-v40',{});all[cacheKey(location)]={...location,savedAt:Date.now(),payload};setStored('weather-cache-map-v40',Object.fromEntries(Object.entries(all).sort((a,b)=>b[1].savedAt-a[1].savedAt).slice(0,8)));}
