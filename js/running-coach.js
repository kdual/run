/**
 * Rule-Based Running Coach & Advisory Engine
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      root.RUN_CONFIG || require('../config/running-score-config.js'),
      root.RunUtils || require('./utils.js')
    );
  } else {
    root.RunningCoachEngine = factory(root.RUN_CONFIG, root.RunUtils);
  }
})(typeof self !== 'undefined' ? self : this, function (config, utils) {
  'use strict';

  return {
    /**
     * Generate Coach Commentary based on current & today's weather
     */
    generateCoachMessage: function (currentWeather, currentScore, bestTimeTop1, todayMaxScore) {
      if (!currentWeather || !currentScore) {
        return "날씨 데이터를 수신하는 중입니다.";
      }

      const temp = currentWeather.temperature;
      const dp = currentWeather.dewPoint;
      const rh = currentWeather.humidity;
      const rain = currentWeather.rain;
      const rainProb = currentWeather.precipitationProbability;
      const wind = currentWeather.windSpeed;
      const pm25 = currentWeather.pm25;
      const score = currentScore.totalScore;

      const messages = [];

      // 1. Primary Condition Analysis
      if (rain > 1.0) {
        messages.push("비가 내리고 있어 노면 접지력이 낮습니다. 고강도 러닝보다는 짧은 조깅을 권장합니다.");
      } else if (rainProb >= 60 && rain <= 0.3) {
        messages.push("강수 확률이 높아 우천에 대비한 코스 선정과 가벼운 이지런이 적합합니다.");
      } else if (temp >= 25 && dp >= 19) {
        messages.push("기온과 이슬점이 모두 높아 심박수 상승이 빠릅니다. 수분 보충과 페이스 다운이 필요합니다.");
      } else if (temp >= 20 && dp >= 17) {
        messages.push("기온은 보통이나 이슬점이 다소 높아 후반부 체감 피로도가 가중될 수 있습니다.");
      } else if (temp >= 8 && temp <= 16 && dp <= 12 && rain === 0) {
        messages.push("선선한 기온과 적절한 습도로 야외 러닝과 지속주에 매우 이상적인 환경입니다.");
      } else if (temp < 2) {
        messages.push("기온이 낮아 근육 수축 및 관절 부상 위험이 있으니 충분한 동적 스트레칭이 필수입니다.");
      } else if (wind >= 28) {
        messages.push("바람이 다소 강하므로 초반 맞바람, 복귀 시 뒷바람이 되는 코스를 추천합니다.");
      } else if (pm25 >= 45) {
        messages.push("미세먼지 수치가 다소 높으므로 폐활량 부담이 큰 고강도 훈련은 자제하는 것이 좋습니다.");
      } else {
        messages.push("전반적으로 무난한 기상 조건입니다. 본인의 컨디션에 맞춰 유산소 조깅을 시작해 보세요.");
      }

      // 2. Timing Opportunity Advice
      if (bestTimeTop1 && todayMaxScore > score + 6) {
        messages.push(`지금도 가능하지만 오늘 최고 점수(${todayMaxScore}점) 시간대인 ${bestTimeTop1.timeLabel}에 달리면 더욱 쾌적합니다.`);
      } else if (score >= 85) {
        messages.push("지금이 오늘 중 가장 달리기 좋은 골든 타임입니다.");
      }

      return messages.slice(0, 2).join(" ");
    },

    /**
     * Generate Clothing Recommendation
     */
    getClothingAdvice: function (currentWeather) {
      if (!currentWeather) {
        return {
          top: "기본 러닝 셔츠",
          bottom: "러닝 쇼츠",
          accessories: "러닝 캡",
          notice: "러닝 복장 추천은 체감 온도에 따른 참고용 가이드입니다."
        };
      }

      const temp = currentWeather.apparentTemperature || currentWeather.temperature;
      const wind = currentWeather.windSpeed || 0;
      const rain = currentWeather.rain || 0;
      const uv = currentWeather.uvIndex || 0;
      const isDay = currentWeather.isDay !== undefined ? currentWeather.isDay : 1;

      let top = "";
      let bottom = "";
      const accessories = [];

      // Upper body
      if (temp >= 24) {
        top = "초경량 싱글렛(민소매) 또는 통기성 반팔 셔츠";
      } else if (temp >= 15) {
        top = "기능성 반팔 러닝 셔츠";
      } else if (temp >= 8) {
        top = "얇은 긴팔 기능성 티셔츠 (또는 반팔 + 암슬리브)";
      } else if (temp >= 2) {
        top = "보온성 긴팔 티셔츠 + 경량 바람막이 레이어드";
      } else {
        top = "방풍 러닝 자켓 + 보온 베이스레이어";
      }

      // Lower body
      if (temp >= 14) {
        bottom = "3~5인치 초경량 러닝 쇼츠";
      } else if (temp >= 6) {
        bottom = "쇼츠 + 카프가드 또는 하프 타이츠";
      } else if (temp >= 0) {
        bottom = "풀랭스 러닝 타이츠 또는 경량 러닝 팬츠";
      } else {
        bottom = "방풍 기모 러닝 타이츠";
      }

      // Accessories
      if (wind >= 22 && temp <= 16) {
        accessories.push("바람막이");
      }
      if (rain > 0.2) {
        accessories.push("방수/발수 러닝 캡 (시야 확보)");
      }
      if (isDay && uv >= 5) {
        accessories.push("자외선 차단 선글라스", "러닝 캡");
      }
      if (temp <= 5) {
        accessories.push("경량 러닝 장갑");
      }
      if (temp <= -2) {
        accessories.push("넥워머", "귀마개/헤드밴드");
      }
      if (!isDay) {
        accessories.push("야간 반사 밴드/클립 라이트");
      }

      return {
        top: top,
        bottom: bottom,
        accessories: accessories.length > 0 ? accessories.join(", ") : "추가 소품 없음",
        notice: "러닝 시작 후 체온이 약 5~8°C 상승하므로 살짝 서늘하게 입는 것이 좋습니다."
      };
    },

    /**
     * Environment Caution Checklist
     */
    getEnvironmentWarnings: function (currentWeather) {
      if (!currentWeather) return [];

      const warnings = [];
      const temp = currentWeather.temperature;
      const dp = currentWeather.dewPoint;
      const rh = currentWeather.humidity;
      const rain = currentWeather.rain;
      const wind = currentWeather.windSpeed;
      const gusts = currentWeather.windGusts;
      const pm25 = currentWeather.pm25;
      const uv = currentWeather.uvIndex;

      if (temp >= 27) {
        warnings.push({
          type: "heat",
          title: "고온 환경",
          text: "탈수 위험이 높습니다. 20분마다 주기적인 수분 및 전해질 섭취를 권장합니다."
        });
      }
      if (dp >= 18) {
        warnings.push({
          type: "dewpoint",
          title: "높은 이슬점",
          text: "땀 증발이 원활하지 않아 심박수 상승(Cardiac Drift)이 급격해질 수 있습니다."
        });
      }
      if (rh >= 82 && temp >= 18) {
        warnings.push({
          type: "humidity",
          title: "고습도 주의",
          text: "체온 배출 효율이 떨어지므로 평소 목표 페이스보다 5~10초 여유 있게 달리세요."
        });
      }
      if (rain >= 0.5) {
        warnings.push({
          type: "rain",
          title: "노면 미끄러움",
          text: "우천으로 인해 우레탄 트랙, 맨홀 뚜껑, 차선 페인트가 매우 미끄럽습니다."
        });
      }
      if (wind >= 30 || gusts >= 40) {
        warnings.push({
          type: "wind",
          title: "강풍 / 돌풍",
          text: "맞바람 구간에서 에너지 소모가 큽니다. 페이스보다 파워/체감 노력도 위주로 달리는 것을 권장합니다."
        });
      }
      if (pm25 >= 36) {
        warnings.push({
          type: "air",
          title: "미세먼지 주의",
          text: "대기질이 좋지 않습니다. 호흡기 보호를 위해 고강도 인터벌보다는 조깅 또는 실내 운동을 고려하세요."
        });
      }
      if (uv >= 6 && currentWeather.isDay) {
        warnings.push({
          type: "uv",
          title: "강한 자외선",
          text: "선크림을 바르고 모자나 스포츠 선글라스를 착용해 눈과 피부를 보호하세요."
        });
      }
      if (temp <= 0) {
        warnings.push({
          type: "cold",
          title: "저온 환경",
          text: "급격한 근육 경련을 막기 위해 실내에서 체온을 올린 후 러닝을 시작하세요."
        });
      }

      return warnings;
    },

    /**
     * Today vs Tomorrow Comparative Analysis
     */
    generateTodayVsTomorrowComparison: function (todaySummary, tomorrowSummary) {
      if (!todaySummary || !tomorrowSummary) {
        return {
          winner: "today",
          text: "비교 데이터를 계산하는 중입니다."
        };
      }

      const scoreDiff = tomorrowSummary.avgScore - todaySummary.avgScore;
      const tempDiff = tomorrowSummary.maxTemp - todaySummary.maxTemp;
      const rainDiff = tomorrowSummary.maxRainProb - todaySummary.maxRainProb;

      let text = "";
      if (scoreDiff >= 5) {
        text = "내일이 오늘보다 러닝하기 훨씬 더 좋은 기상 환경입니다. ";
      } else if (scoreDiff <= -5) {
        text = "오늘이 내일보다 러닝하기 더 유리한 조건입니다. 주요 세션은 오늘 진행하는 것을 추천합니다. ";
      } else {
        text = "오늘과 내일의 전반적인 러닝 여건은 비슷한 수준입니다. ";
      }

      if (rainDiff > 30) {
        text += `내일은 강수 확률이 ${tomorrowSummary.maxRainProb}%로 오늘보다 비 가능성이 높습니다.`;
      } else if (tempDiff >= 3) {
        text += `내일 낮 최고 기온이 오늘보다 약 ${Math.abs(Math.round(tempDiff))}°C 더 오를 전망입니다.`;
      } else if (tempDiff <= -3) {
        text += `내일은 기온이 오늘보다 약 ${Math.abs(Math.round(tempDiff))}°C 내려가 더 선선합니다.`;
      } else {
        text += `두 날 모두 일교차와 바람 조건을 확인하여 시간대를 선택하세요.`;
      }

      return {
        scoreDiff: Math.round(scoreDiff),
        winner: scoreDiff > 0 ? "tomorrow" : "today",
        text: text
      };
    }
  };
});
