const PREFIX = 'runwise:v2:';
export function getStored(key, fallback = null) { try { const v = localStorage.getItem(PREFIX + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
export function setStored(key, value) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* private mode/full storage */ } }
export function getCache(location) {
  const cached = getStored('weather-cache-v4');
  if (!cached || Math.abs(cached.latitude - location.latitude) > .0001 || Math.abs(cached.longitude - location.longitude) > .0001) return null;
  return cached;
}
export function setCache(location, payload) { setStored('weather-cache-v4', { ...location, savedAt: Date.now(), payload }); }
