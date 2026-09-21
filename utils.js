export const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
export const round = (value, digits = 0) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
export const safe = (value, fallback = null) => Number.isFinite(value) ? value : fallback;
export const timeOnly = iso => iso?.slice(11, 16) || '--:--';
export const dateOnly = iso => iso?.slice(0, 10) || '';
export const escapeHtml = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const formatValue = (value, suffix = '', digits = 0) => Number.isFinite(value) ? `${round(value, digits)}${suffix}` : '정보 없음';
export const weatherSymbol = code => {
  if (code === 0) return '☀';
  if ([1,2].includes(code)) return '🌤';
  if (code === 3) return '☁';
  if ([45,48].includes(code)) return '🌫';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧';
  if (code >= 71 && code <= 77) return '🌨';
  if (code >= 95) return '⛈';
  return '◌';
};
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
