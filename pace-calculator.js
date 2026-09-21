import { APP_CONFIG } from './running-score-config.js';
import { secondsToClock } from './utils.js';

export function fromGoal(distanceKm, finishSeconds) { if (!(distanceKm>0) || !(finishSeconds>0)) return null; return fromPace(finishSeconds/distanceKm); }
export function fromPace(paceSeconds) { if (!(paceSeconds>0)) return null; return { paceSeconds, speed:3600/paceSeconds, splits:makeSplits(paceSeconds) }; }
export function fromSpeed(speed) { if (!(speed>0)) return null; return fromPace(3600/speed); }
export function makeSplits(paceSeconds) { return Object.fromEntries(Object.entries(APP_CONFIG.distances).map(([name,km])=>[name,paceSeconds*km])); }
export function renderPace(paceSeconds) { return `${secondsToClock(paceSeconds,false)}/km`; }
export function paceTableRows(start, end, step=10) {
  const rows=[]; for(let p=start;p<=end;p+=step){const data=fromPace(p);rows.push({pace:p,speed:data.speed,splits:data.splits});} return rows;
}
