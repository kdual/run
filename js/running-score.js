/**
 * Running Score & Workout Suitability Engine
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      root.RUN_CONFIG || require('../config/running-score-config.js'),
      root.RunUtils || require('./utils.js')
    );
  } else {
    root.RunningScoreEngine = factory(root.RUN_CONFIG, root.RunUtils);
  }
})(typeof self !== 'undefined' ? self : this, function (config, utils) {
  'use strict';

  function calculateTemperatureSubScore(temp) {
    if (temp === null || temp === undefined || isNaN(temp)) return 75;
    // Ideal: 8 - 15°C
    if (temp >= 8 && temp <= 15) return 100;
    if (temp > 15 && temp <= 18) return 95 - (temp - 15) * 3.3; // 95 -> 85
    if (temp > 18 && temp <= 22) return 85 - (temp - 18) * 5.0; // 85 -> 65
    if (temp > 22 && temp <= 26) return 65 - (temp - 22) * 6.25; // 65 -> 40
    if (temp > 26 && temp <= 30) return 40 - (temp - 26) * 7.5; // 40 -> 10
    if (temp > 30) return Math.max(0, 10 - (temp - 30) * 3);

    // Cold side
    if (temp >= 4 && temp < 8) return 90 + (temp - 4) * 2.5; // 90 -> 100
    if (temp >= 0 && temp < 4) return 75 + temp * 3.75; // 75 -> 90
    if (temp >= -5 && temp < 0) return 50 + (temp + 5) * 5.0; // 50 -> 75
    if (temp >= -12 && temp < -5) return 20 + (temp + 12) * 4.28; // 20 -> 50
    return Math.max(0, 20 - (-12 - temp) * 3);
  }

  function calculateDewPointSubScore(dp) {
    if (dp === null || dp === undefined || isNaN(dp)) return 80;
    // Optimal: <= 10°C
    if (dp <= 10) return 100;
    if (dp <= 14) return 100 - (dp - 10) * 3.75; // 100 -> 85
    if (dp <= 17) return 85 - (dp - 14) * 6.66;  // 85 -> 65
    if (dp <= 20) return 65 - (dp - 17) * 10.0;  // 65 -> 35
    if (dp <= 23) return 35 - (dp - 20) * 8.33;  // 35 -> 10
    return Math.max(0, 10 - (dp - 23) * 3.0);
  }

  function calculateHumiditySubScore(rh) {
    if (rh === null || rh === undefined || isNaN(rh)) return 80;
    // Optimal: 40% - 60%
    if (rh >= 40 && rh <= 60) return 100;
    if (rh > 60 && rh <= 70) return 100 - (rh - 60) * 1.5; // 100 -> 85
    if (rh > 70 && rh <= 80) return 85 - (rh - 70) * 3.0;  // 85 -> 55
    if (rh > 80 && rh <= 90) return 55 - (rh - 80) * 3.5;  // 55 -> 20
    if (rh > 90) return Math.max(0, 20 - (rh - 90) * 2.0);

    // Dry side
    if (rh >= 30 && rh < 40) return 85 + (rh - 30) * 1.5; // 85 -> 100
    if (rh >= 20 && rh < 30) return 65 + (rh - 20) * 2.0; // 65 -> 85
    return Math.max(15, 65 - (20 - rh) * 3.0);
  }

  function calculateRainSubScore(rainMm, precipProb) {
    let score = 100;
    const rain = rainMm || 0;
    const prob = precipProb || 0;

    if (rain > 0) {
      if (rain <= 0.3) score = 85;
      else if (rain <= 1.0) score = 65;
      else if (rain <= 2.5) score = 40;
      else if (rain <= 5.0) score = 15;
      else score = 0;
    } else {
      if (prob > 70) score = 75;
      else if (prob > 50) score = 85;
      else if (prob > 30) score = 95;
    }
    return score;
  }

  function calculateWindSubScore(windSpeedKmh, windGustsKmh) {
    let score = 100;
    const speed = windSpeedKmh || 0;
    const gusts = windGustsKmh || 0;

    if (speed <= 15) score = 100;
    else if (speed <= 25) score = 100 - (speed - 15) * 1.8; // 100 -> 82
    else if (speed <= 35) score = 82 - (speed - 25) * 3.2;  // 82 -> 50
    else if (speed <= 45) score = 50 - (speed - 35) * 3.0;  // 50 -> 20
    else score = Math.max(0, 20 - (speed - 45) * 2.0);

    // Gust penalty
    if (gusts > 45) score = Math.max(0, score - 20);
    else if (gusts > 35) score = Math.max(0, score - 10);

    return score;
  }

  function calculateAirQualitySubScore(pm25, pm10, aqi) {
    if ((pm25 === null || pm25 === undefined) && (aqi === null || aqi === undefined)) {
      return 85; // neutral default if missing
    }

    let score = 100;
    if (pm25 !== null && pm25 !== undefined) {
      if (pm25 <= 15) score = 100;
      else if (pm25 <= 35) score = 100 - ((pm25 - 15) / 20) * 20; // 100 -> 80
      else if (pm25 <= 75) score = 80 - ((pm25 - 35) / 40) * 45;   // 80 -> 35
      else score = Math.max(0, 35 - ((pm25 - 75) / 50) * 35);
    } else if (aqi !== null && aqi !== undefined) {
      if (aqi <= 1) score = 100;
      else if (aqi <= 2) score = 85;
      else if (aqi <= 3) score = 55;
      else if (aqi <= 4) score = 30;
      else score = 10;
    }
    return score;
  }

  function calculateUvSubScore(uv) {
    if (uv === null || uv === undefined || isNaN(uv)) return 95;
    if (uv <= 2) return 100;
    if (uv <= 5) return 90;
    if (uv <= 7) return 75;
    if (uv <= 10) return 50;
    return 25;
  }

  return {
    /**
     * Calculate Running Score (0-100) from environmental metrics
     */
    calculateScore: function (env) {
      if (!env) return { totalScore: 0, grade: config.scoreGrades[config.scoreGrades.length - 1], subScores: {} };

      const w = config.weights;
      const totalWeight = w.temperature + w.dewPoint + w.humidity + w.rain + w.wind + w.airQuality + w.uv;

      const temp = env.temperature;
      const dp = env.dewPoint !== undefined ? env.dewPoint : (env.temperature - ((100 - (env.humidity || 50)) / 5));
      const rh = env.humidity;

      const subScores = {
        temperature: calculateTemperatureSubScore(temp),
        dewPoint: calculateDewPointSubScore(dp),
        humidity: calculateHumiditySubScore(rh),
        rain: calculateRainSubScore(env.rain, env.precipitationProbability),
        wind: calculateWindSubScore(env.windSpeed, env.windGusts),
        airQuality: calculateAirQualitySubScore(env.pm25, env.pm10, env.aqi),
        uv: calculateUvSubScore(env.uvIndex)
      };

      let weightedTotal =
        subScores.temperature * w.temperature +
        subScores.dewPoint * w.dewPoint +
        subScores.humidity * w.humidity +
        subScores.rain * w.rain +
        subScores.wind * w.wind +
        subScores.airQuality * w.airQuality +
        subScores.uv * w.uv;

      let rawScore = weightedTotal / totalWeight;

      // Compound heat strain penalty (extreme heat + high dew point causes cardiac drift & heat illness)
      if (temp >= 28 && dp >= 20) {
        const extraHeatPenalty = Math.min(25, (temp - 27) * 2 + (dp - 19) * 2.5);
        rawScore -= extraHeatPenalty;
      }

      // Severe air pollution penalty
      if (env.pm25 && env.pm25 > 75) {
        rawScore -= 15;
      }

      // Heavy rain penalty
      if (env.rain && env.rain > 3.0) {
        rawScore -= 15;
      }

      const totalScore = Math.round(utils.clamp(rawScore, 0, 100));
      const grade = this.getGrade(totalScore);

      return {
        totalScore: totalScore,
        grade: grade,
        subScores: subScores
      };
    },

    getGrade: function (score) {
      const grades = config.scoreGrades;
      for (let i = 0; i < grades.length; i++) {
        if (score >= grades[i].min && score <= grades[i].max) {
          return grades[i];
        }
      }
      return grades[grades.length - 1];
    },

    /**
     * Calculate Suitability for Each Running Mode
     */
    calculateWorkoutScores: function (baseScore, env) {
      const modes = config.workoutModes;
      const results = {};

      const temp = env.temperature || 15;
      const dp = env.dewPoint !== undefined ? env.dewPoint : 10;
      const rain = env.rain || 0;
      const pm25 = env.pm25 || 15;

      const heatPenalty = Math.max(0, (temp - 20) * 1.8) + Math.max(0, (dp - 16) * 2.2);
      const rainPenalty = rain > 0 ? (rain > 1.5 ? 25 : 12) : 0;
      const aqiPenalty = pm25 > 35 ? (pm25 - 35) * 0.4 : 0;

      for (const key in modes) {
        const mode = modes[key];
        let score = baseScore;

        // Apply mode-specific multiplier to environmental stress
        const appliedHeatPenalty = heatPenalty * (mode.heatSensitivity - 0.8);
        const appliedRainPenalty = rainPenalty * (mode.rainSensitivity - 0.8);
        const appliedAqiPenalty = aqiPenalty * (key === 'interval' || key === 'race' ? 1.5 : 0.8);

        score = score - appliedHeatPenalty - appliedRainPenalty - appliedAqiPenalty;

        if (key === 'recovery' && temp >= 10 && temp <= 22 && dp <= 16) {
          score += 5;
        }

        const finalScore = Math.round(utils.clamp(score, 0, 100));
        results[key] = {
          key: key,
          name: mode.name,
          label: mode.label,
          score: finalScore,
          grade: this.getGrade(finalScore),
          description: mode.description
        };
      }

      return results;
    },

    /**
     * Find Top 3 Best Running Times for Today
     */
    findBestRunningTimes: function (hourlyData) {
      if (!hourlyData || hourlyData.length === 0) return [];

      const continuousBlocks = [];
      const usedIndices = new Set();

      for (let i = 0; i < hourlyData.length - 1; i++) {
        const h1 = hourlyData[i];
        const h2 = hourlyData[i + 1];
        const avgScore = (h1.runningScore.totalScore + h2.runningScore.totalScore) / 2;
        const timeLabel = `${String(h1.hour).padStart(2, "0")}:00–${String(h2.hour + 1).padStart(2, "0")}:00`;

        continuousBlocks.push({
          startIndex: i,
          timeLabel: timeLabel,
          score: Math.round(avgScore),
          h1Score: h1.runningScore.totalScore,
          h2Score: h2.runningScore.totalScore,
          temp: Math.round(((h1.temperature + h2.temperature) / 2) * 10) / 10
        });
      }

      continuousBlocks.sort((a, b) => b.score - a.score);

      const topPicks = [];
      for (const block of continuousBlocks) {
        if (!usedIndices.has(block.startIndex) && !usedIndices.has(block.startIndex + 1)) {
          usedIndices.add(block.startIndex);
          usedIndices.add(block.startIndex + 1);
          topPicks.push({
            rank: topPicks.length + 1,
            timeLabel: block.timeLabel,
            score: block.score,
            grade: this.getGrade(block.score),
            temp: block.temp,
            badge: topPicks.length === 0 ? "최적의 2시간 블록" : "추천 시간대"
          });
        }
        if (topPicks.length >= 3) break;
      }

      // Fallback
      if (topPicks.length < 3) {
        const sorted = [...hourlyData].sort((a, b) => b.runningScore.totalScore - a.runningScore.totalScore);
        for (const item of sorted) {
          const timeLabel = `${String(item.hour).padStart(2, "0")}:00–${String((item.hour + 1) % 24).padStart(2, "0")}:00`;
          if (!topPicks.some(p => p.timeLabel.startsWith(String(item.hour).padStart(2, "0")))) {
            topPicks.push({
              rank: topPicks.length + 1,
              timeLabel: timeLabel,
              score: item.runningScore.totalScore,
              grade: item.runningScore.grade,
              temp: item.temperature,
              badge: "단일 추천 시간"
            });
          }
          if (topPicks.length >= 3) break;
        }
      }

      return topPicks;
    }
  };
});
