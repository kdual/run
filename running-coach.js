import { safe } from './utils.js';

export function coachMessage(c, best) {
  const messages=[];
  if (safe(c.pm2_5,0) > 35 || safe(c.air_quality_index,0) > 100) messages.push('대기질이 좋지 않아 야외 고강도 러닝은 피하는 편이 좋습니다.');
  else if (safe(c.air_stagnation_index,0) >= 100) messages.push('대기정체 가능성이 매우 높아 달리기 전 최신 미세먼지 수치를 다시 확인하세요.');
  if (safe(c.precipitation_probability,0) >= 60 || safe(c.precipitation,0) >= 1) messages.push('비 가능성이 높아 짧은 Easy Run이 더 적합합니다.');
  if (safe(c.dew_point_2m,-20) >= 18) messages.push('이슬점이 높아 후반부 체감 부담이 커질 수 있습니다.');
  if (safe(c.apparent_temperature,0) >= 28) messages.push('체감온도가 높아 페이스를 낮추고 수분을 자주 보충하세요.');
  if (safe(c.wind_gusts_10m,0) >= 35) messages.push('돌풍이 강해 노출이 적은 왕복 코스를 권합니다.');
  if (!messages.length && c.score >= 85) messages.push('선선하고 큰 방해 요소가 없어 러닝하기 좋은 조건입니다.');
  else if (!messages.length) messages.push('무리하지 않는 강도로 달리기 무난한 조건입니다.');
  if (best && best.score >= c.score + 5) messages.push(`${best.start.slice(11,16)} 이후가 현재보다 더 좋습니다.`);
  return messages.slice(0,2).join(' ');
}

export function runNowMessage(c, best) {
  if (c.score >= 85) return '지금 러닝하기 좋은 조건입니다.';
  if (best && best.score >= c.score + 5) return `지금도 가능하지만 ${best.start.slice(11,16)} 이후가 더 좋은 조건입니다.`;
  if (safe(c.pm2_5,0)>35) return '미세먼지로 인해 야외 고강도 러닝은 권장하지 않습니다.';
  if (safe(c.dew_point_2m,-20)>=18) return '높은 이슬점 때문에 고강도 러닝은 권장하지 않습니다.';
  if (c.score < 40) return '현재는 실내 운동이나 휴식을 권합니다.';
  return '현재 조건을 확인하고 강도와 시간을 조절해 달리세요.';
}

export function environmentAlerts(c) {
  const list=[];
  if (safe(c.apparent_temperature,0)>=28) list.push('고온 · 수분 보충 주의');
  if (safe(c.relative_humidity_2m,0)>=80) list.push('높은 습도 · 체열 배출 부담');
  if (safe(c.dew_point_2m,-20)>=18) list.push('높은 이슬점 · 체감 부담 증가');
  if (safe(c.uv_index,0)>=6 && c.is_day!==0) list.push('강한 UV · 자외선 차단 권장');
  if (safe(c.pm2_5,0)>35) list.push('PM2.5 높음 · 고강도 주의');
  if (safe(c.air_stagnation_index,0)>=100) list.push('대기정체 매우 높음 · 공기질 재확인');
  else if (safe(c.air_stagnation_index,0)>=75) list.push('대기정체 높음 · 오염물질 축적 가능');
  if (safe(c.wind_gusts_10m,0)>=35) list.push('강풍 · 바람 방향 고려');
  if (safe(c.precipitation,0)>0 || safe(c.precipitation_probability,0)>=60) list.push('비 · 미끄러운 노면 주의');
  if (!list.length) list.push('특별한 환경 주의사항이 없습니다.');
  return list;
}

export function gearAdvice(c) {
  const t=safe(c.apparent_temperature,safe(c.temperature_2m));
  if(t===null)return {상의:'기온 정보 없음',하의:'기온 정보 없음',추가:'날씨 확인 후 선택',환경:'현재 기온을 확인할 수 없습니다.'};
  let top='반팔 러닝셔츠',bottom='러닝 쇼츠';
  const extras=new Set(),conditions=[];
  if(t<0){top='기모 긴팔 + 보온 겉옷';bottom='기모 타이츠';extras.add('장갑');extras.add('넥워머');}
  else if(t<7){top='긴팔 + 얇은 겉옷';bottom='롱 타이츠';extras.add('얇은 장갑');}
  else if(t<13){top='긴팔 러닝셔츠';bottom='쇼츠 또는 타이츠';}
  else if(t>=28){top='가볍고 통풍되는 민소매 또는 반팔';bottom='가벼운 러닝 쇼츠';extras.add('수분');}

  const rainy=safe(c.precipitation,0)>0||safe(c.precipitation_probability,0)>=60;
  if(rainy){
    if(t<28)extras.add('가벼운 방수 겉옷');
    conditions.push('비 · 미끄러운 노면 확인');
  }
  if(safe(c.wind_speed_10m,0)>20){
    if(t>=7&&t<20&&!rainy)extras.add('얇은 바람막이');
    conditions.push('바람 20 km/h 초과 · 노출 구간 확인');
  }
  if(t>=28)conditions.push('더위 · 강도 조절과 수분 보충');
  if(c.is_day===1&&safe(c.uv_index,0)>=3){
    extras.add('자외선 차단제');
    if(c.uv_index>=6)extras.add('챙 있는 모자');
  }
  if(c.is_day===0)extras.add('반사밴드 · 조명');
  if(safe(c.pm2_5,0)>35||safe(c.air_quality_index,0)>100)conditions.unshift('대기질 나쁨 · 실외 운동 전 확인');
  return {상의:top,하의:bottom,추가:[...extras].join(' · ')||'없음',환경:conditions.slice(0,2).join(' · ')||'특별한 환경 주의사항 없음'};
}
