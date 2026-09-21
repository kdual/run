import { timeOnly } from './utils.js';

export function renderHourlyChart(container, rows, onSelect) {
  const visible = rows.filter((_,i)=>i%2===0 || rows.length<=14);
  if (!visible.length) { container.innerHTML='<p class="muted">표시할 시간대 데이터가 없습니다.</p>'; return; }
  const w=900,h=210,pad={l:34,r:18,t:20,b:35};
  const x=i=>pad.l+(i/(visible.length-1||1))*(w-pad.l-pad.r);
  const y=s=>pad.t+(100-s)/100*(h-pad.t-pad.b);
  const points=visible.map((r,i)=>`${x(i)},${y(r.score)}`).join(' ');
  const area=`${x(0)},${h-pad.b} ${points} ${x(visible.length-1)},${h-pad.b}`;
  container.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    ${[40,60,80,100].map(v=>`<line class="grid-line" x1="${pad.l}" y1="${y(v)}" x2="${w-pad.r}" y2="${y(v)}"></line><text x="2" y="${y(v)+4}">${v}</text>`).join('')}
    <polygon class="score-area" points="${area}"></polygon><polyline class="score-line" points="${points}"></polyline>
    ${visible.map((r,i)=>`<circle class="point" tabindex="0" role="button" aria-label="${timeOnly(r.time)} ${r.score}점" data-index="${rows.indexOf(r)}" cx="${x(i)}" cy="${y(r.score)}" r="5"></circle>`).join('')}
    ${visible.map((r,i)=>`<text text-anchor="middle" x="${x(i)}" y="${h-10}">${timeOnly(r.time)}</text>`).join('')}
  </svg>`;
  container.querySelectorAll('.point').forEach(point=>{
    const activate=()=>onSelect(rows[Number(point.dataset.index)]);
    point.addEventListener('click',activate); point.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
  });
}
