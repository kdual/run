import {solarTimes} from '../solar-times.js';
export function scenarioData(name,location,now=new Date()){
 const kst=new Date(+now+9*3600000).toISOString().slice(0,16),date=kst.slice(0,10),hour=kst.slice(0,13)+':00';
 const hourly={};const rows=[];const dates=[];
 for(let d=0;d<4;d++){
  const day=new Date(Date.parse(date+'T00:00:00Z')+d*86400000).toISOString().slice(0,10);dates.push(day);
  for(let h=0;h<24;h++){
   const time=day+'T'+String(h).padStart(2,'0')+':00',t=name==='cold'?-20:name==='wetCold'?1:name==='heat'?36:15+9*Math.max(0,Math.sin((h-7)*Math.PI/14));
   rows.push({time,temperature_2m:t,apparent_temperature:t,relative_humidity_2m:name==='wetCold'?90:55,dew_point_2m:t-10,wind_speed_10m:name==='cold'?25:8,wind_direction_10m:180,precipitation:name==='wetCold'?1:0,precipitation_probability:name==='wetCold'?90:0,weather_code:name==='wetCold'?61:0,cloud_cover:10,uv_index:h>8&&h<17?6:0,air_stagnation_index:50,is_day:h>=7&&h<18?1:0});
  }
 }
 for(const key of Object.keys(rows[0]))hourly[key]=rows.map(r=>r[key]);
 const current=rows.find(r=>r.time===hour)||rows[0];
 const daily={time:dates,weather_code:dates.map(()=>current.weather_code),temperature_2m_min:dates.map(d=>Math.min(...rows.filter(r=>r.time.startsWith(d)).map(r=>r.temperature_2m))),temperature_2m_max:dates.map(d=>Math.max(...rows.filter(r=>r.time.startsWith(d)).map(r=>r.temperature_2m))),precipitation_probability_max:dates.map(()=>current.precipitation_probability),uv_index_max:dates.map(()=>6),air_stagnation_index_max:dates.map(()=>50),sunrise:dates.map(d=>solarTimes(d,location.latitude,location.longitude).sunrise),sunset:dates.map(d=>solarTimes(d,location.latitude,location.longitude).sunset)};
 const polluted=name==='pollution';const air=name==='missing'?null:{current:{station_name:'검증용 가상 측정소',measured_at:hour.replace('T',' '),pm2_5:polluted?100:12,pm10:polluted?180:25,air_quality_index:polluted?300:45}};
 return {weather:{latitude:location.latitude,longitude:location.longitude,current,hourly,daily,life_indices:{uv:'ok',air_stagnation:'ok'}},air,forecast:null,officialAlerts:null,savedAt:+now,scenario:name,airPending:false,airError:false,fromCache:false};
}
