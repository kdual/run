import { timeOnly } from './utils.js';

function gradeKey(score) {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'normal';
  if (score >= 60) return 'caution';
  if (score >= 40) return 'bad';
  return 'danger';
}

export function renderHourlyChart(container, rows, onSelect) {
  if (!rows.length) { container.innerHTML='<p class="muted">표시할 시간대 데이터가 없습니다.</p>'; return; }
  const w=960,h=236,pad={l:38,r:18,t:25,b:38};
  const x=i=>pad.l+(i/(rows.length-1||1))*(w-pad.l-pad.r);
  const y=s=>pad.t+(100-s)/100*(h-pad.t-pad.b);
  const points=rows.map((r,i)=>`${x(i)},${y(r.score)}`).join(' ');
  const area=`${x(0)},${h-pad.b} ${points} ${x(rows.length-1)},${h-pad.b}`;
  container.innerHTML=`<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <defs><linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--primary)" stop-opacity=".23"></stop><stop offset="100%" stop-color="var(--primary)" stop-opacity=".02"></stop></linearGradient></defs>
    ${[40,60,80,100].map(v=>`<line class="grid-line" x1="${pad.l}" y1="${y(v)}" x2="${w-pad.r}" y2="${y(v)}"></line><text class="axis-label" x="3" y="${y(v)+4}">${v}</text>`).join('')}
    ${rows.filter((_,i)=>i%2===0).map((r,i)=>`<line class="hour-guide" x1="${x(i*2)}" y1="${pad.t}" x2="${x(i*2)}" y2="${h-pad.b}"></line>`).join('')}
    <polygon class="score-area" points="${area}"></polygon><polyline class="score-line-shadow" points="${points}"></polyline><polyline class="score-line" points="${points}"></polyline>
    <line class="selection-guide" x1="0" y1="${pad.t}" x2="0" y2="${h-pad.b}" hidden></line>
    ${rows.map((r,i)=>`<circle class="point point-${gradeKey(r.score)}" tabindex="0" role="button" aria-label="${timeOnly(r.time)} ${r.score}점" data-index="${i}" cx="${x(i)}" cy="${y(r.score)}" r="4.5"></circle>`).join('')}
    ${rows.filter((_,i)=>i%2===0).map((r,i)=>`<text class="time-label" text-anchor="middle" x="${x(i*2)}" y="${h-12}">${timeOnly(r.time)}</text>`).join('')}
  </svg><div class="chart-tooltip" role="status" hidden></div>`;
  const tooltip=container.querySelector('.chart-tooltip');
  const guide=container.querySelector('.selection-guide');
  const activate=point=>{
    const index=Number(point.dataset.index),row=rows[index];
    container.querySelectorAll('.point').forEach(p=>p.classList.toggle('selected',p===point));
    guide.hidden=false;guide.setAttribute('x1',x(index));guide.setAttribute('x2',x(index));
    tooltip.innerHTML=`<strong>${timeOnly(row.time)} · ${row.score}점</strong><span>${row.temperature_2m?.toFixed?.(1) ?? '--'}°C · 체감 ${row.apparent_temperature?.toFixed?.(1) ?? '--'}°C</span>`;
    tooltip.style.left=`${Math.min(78,Math.max(8,x(index)/w*100))}%`;
    tooltip.style.top=`${Math.max(6,y(row.score)/h*100-3)}%`;tooltip.hidden=false;
    onSelect(row);
  };
  container.querySelectorAll('.point').forEach(point=>{
    point.addEventListener('click',()=>activate(point));
    point.addEventListener('focus',()=>activate(point));
    point.addEventListener('mouseenter',()=>activate(point));
    point.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(point);}});
  });
  const nowHour=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Seoul'}).replace(' ','T').slice(0,13);
  const firstFuture=rows.findIndex(r=>r.time.slice(0,13)>=nowHour);
  const initialIndex=firstFuture>=0?firstFuture:0;
  activate(container.querySelector(`.point[data-index="${initialIndex}"]`) || container.querySelector('.point'));
}
