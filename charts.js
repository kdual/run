import { timeOnly } from './utils.js';

function weatherLabel(code) {
  if (code === 0) return '맑음';
  if ([1,2].includes(code)) return '대체로 맑음';
  if (code === 3) return '흐림';
  if ([45,48].includes(code)) return '안개';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '비';
  if (code >= 71 && code <= 77) return '눈';
  if (code >= 95) return '뇌우';
  return '기상 정보';
}

const number = (value, digits=1) => Number.isFinite(value) ? value.toFixed(digits) : '--';

export function renderHourlyChart(container, rows, onSelect) {
  if (!rows.length) { container.innerHTML='<p class="muted">표시할 시간대 데이터가 없습니다.</p>'; return; }
  const w=960,h=236,pad={l:38,r:18,t:25,b:38};
  const x=i=>pad.l+(i/(rows.length-1||1))*(w-pad.l-pad.r);
  const y=s=>pad.t+(100-s)/100*(h-pad.t-pad.b);
  const points=rows.map((r,i)=>`${x(i)},${y(r.score)}`).join(' ');
  const area=`${x(0)},${h-pad.b} ${points} ${x(rows.length-1)},${h-pad.b}`;
  container.innerHTML=`<div class="chart-canvas"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#42a5f5" stop-opacity=".28"></stop><stop offset="100%" stop-color="#42a5f5" stop-opacity=".035"></stop></linearGradient></defs>
    ${[40,60,80,100].map(v=>`<line class="grid-line" x1="${pad.l}" y1="${y(v)}" x2="${w-pad.r}" y2="${y(v)}"></line><text class="axis-label" x="3" y="${y(v)+4}">${v}</text>`).join('')}
    ${rows.filter((_,i)=>i%2===0).map((r,i)=>`<line class="hour-guide" x1="${x(i*2)}" y1="${pad.t}" x2="${x(i*2)}" y2="${h-pad.b}"></line>`).join('')}
    <polygon class="score-area" points="${area}"></polygon><polyline class="score-line-shadow" points="${points}"></polyline><polyline class="score-line" points="${points}"></polyline>
    <line class="selection-guide" x1="0" y1="${pad.t}" x2="0" y2="${h-pad.b}" hidden></line>
    ${rows.map((r,i)=>`<circle class="point" tabindex="0" role="button" aria-label="${timeOnly(r.time)} ${r.score}점" data-index="${i}" cx="${x(i)}" cy="${y(r.score)}" r="4.5"></circle>`).join('')}
    ${rows.filter((_,i)=>i%2===0).map((r,i)=>`<text class="time-label" text-anchor="middle" x="${x(i*2)}" y="${h-12}">${timeOnly(r.time)}</text>`).join('')}
  </svg><div class="chart-tooltip" role="status" hidden></div></div>`;
  const canvas=container.querySelector('.chart-canvas');
  const tooltip=container.querySelector('.chart-tooltip');
  const guide=container.querySelector('.selection-guide');
  const activate=point=>{
    const index=Number(point.dataset.index),row=rows[index];
    container.querySelectorAll('.point').forEach(p=>p.classList.toggle('selected',p===point));
    guide.hidden=false;guide.setAttribute('x1',x(index));guide.setAttribute('x2',x(index));
    tooltip.innerHTML=`<strong>${row.time.replace('T',' ')} (${weatherLabel(row.weather_code)})</strong><span><i class="tooltip-dot"></i>러닝 스코어: ${row.score}점</span><span>기온: ${number(row.temperature_2m)}°C (체감 ${number(row.apparent_temperature)}°C)</span><span>이슬점: ${number(row.dew_point_2m)}°C | 습도: ${number(row.relative_humidity_2m,0)}%</span><span>강수확률: ${number(row.precipitation_probability,0)}% | 풍속: ${number(row.wind_speed_10m)} km/h</span>`;
    const left=Math.min(w-116,Math.max(116,x(index)));
    tooltip.style.left=`${left}px`;
    tooltip.style.top=`${Math.max(4,74+y(row.score)-88)}px`;tooltip.hidden=false;
    onSelect(row);
    if (canvas.scrollWidth>container.clientWidth) container.scrollTo({left:Math.max(0,left-container.clientWidth/2),behavior:'smooth'});
  };
  container.querySelectorAll('.point').forEach(point=>{
    point.addEventListener('click',()=>activate(point));
    point.addEventListener('focus',()=>activate(point));
    point.addEventListener('mouseenter',()=>activate(point));
    point.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(point);}});
  });
  const nowMinute=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Seoul'}).replace(' ','T').slice(0,16);
  const firstFuture=rows.findIndex(r=>r.time.slice(0,16)>=nowMinute);
  activate(container.querySelector(`.point[data-index="${firstFuture>=0?firstFuture:0}"]`) || container.querySelector('.point'));
}
