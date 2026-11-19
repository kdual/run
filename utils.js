export const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
export const round = (value, digits = 0) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
export const safe = (value, fallback = null) => Number.isFinite(value) ? value : fallback;
export const timeOnly = iso => iso?.slice(11, 16) || '--:--';
export const dateOnly = iso => iso?.slice(0, 10) || '';
export const escapeHtml = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const formatValue = (value, suffix = '', digits = 0) => Number.isFinite(value) ? `${round(value, digits)}${suffix}` : '정보 없음';
const weatherPaths = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  partly: '<path d="M3 8h1m4-5v1M4 4l1 1m0 7a4 4 0 0 1 6-5M7 18a3.5 3.5 0 0 1 0-7 5 5 0 0 1 9 0h1a3.5 3.5 0 0 1 0 7Z"/>',
  cloud: '<path d="M6 17a4 4 0 0 1-.3-8 6 6 0 0 1 11.5 1h.8a3.5 3.5 0 0 1 0 7Z"/>',
  fog: '<path d="M5 9h14m-17 4h20M5 17h14"/>',
  rain: '<path d="M6 15a4 4 0 0 1-.3-8 6 6 0 0 1 11.5 1h.8a3.5 3.5 0 0 1 0 7ZM7 18l-1 2m6-2-1 2m6-2-1 2"/>',
  snow: '<path d="M6 14a4 4 0 0 1-.3-8 6 6 0 0 1 11.5 1h.8a3.5 3.5 0 1 1 0 7ZM12 16v6m-3-3h6"/>',
  storm: '<path d="M6 15a4 4 0 0 1-.3-8 6 6 0 0 1 11.5 1h.8a3.5 3.5 0 0 1 0 7h-3m-2-3-4 5h4l-2 4"/>',
  unknown: '<path d="M8 12h8"/>',
};
export function weatherIcon(code) {
  let icon = 'unknown';
  if (code === 0) icon = 'sun';
  else if ([1,2].includes(code)) icon = 'partly';
  else if (code === 3) icon = 'cloud';
  else if ([45,48].includes(code)) icon = 'fog';
  else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) icon = 'rain';
  else if (code >= 71 && code <= 77) icon = 'snow';
  else if (code >= 95) icon = 'storm';
  return '<svg class="journal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+weatherPaths[icon]+'</svg>';
}
export const weekday = date => new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));
export const monthDay = date => new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));
export function secondsToClock(seconds, showHours = true) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const total = Math.round(seconds); const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60;
  return h > 0 || showHours ? (h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`) : `${m}:${String(s).padStart(2,'0')}`;
}
export function parseClock(value) {
  const parts = String(value || '').trim().split(':').map(Number);
  if (parts.some(v => !Number.isFinite(v) || v < 0) || parts.length < 2 || parts.length > 3) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
