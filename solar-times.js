/** Local astronomical estimates in Asia/Seoul (UTC+09). These are not KMA observations. */
export function solarTimes(date, latitude, longitude) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const year = Number(date.slice(0,4));
  const day = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.UTC(year, 0, 0)) / 86400000);
  const gamma = 2 * Math.PI / (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365) * (day - 1);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const latRad = latitude * Math.PI / 180;
  const solarNoon = 720 - 4 * longitude - equation + 540;
  function boundary(zenithDegrees, morning) {
    const zenith = zenithDegrees * Math.PI / 180;
    const cosine = Math.cos(zenith) / (Math.cos(latRad) * Math.cos(declination)) - Math.tan(latRad) * Math.tan(declination);
    if (cosine < -1 || cosine > 1) return null;
    const delta = Math.acos(cosine) * 4 * 180 / Math.PI;
    const minutes = ((Math.round(solarNoon + (morning ? -delta : delta)) % 1440) + 1440) % 1440;
    return `${date}T${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
  }
  return {
    astronomical_dawn: boundary(108,true),
    nautical_dawn: boundary(102,true),
    sunrise: boundary(90.833,true),
    sunset: boundary(90.833,false),
    nautical_dusk: boundary(102,false),
    astronomical_dusk: boundary(108,false)
  };
}
