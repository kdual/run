/**
 * Pace & Performance Calculator Engine
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      root.RUN_CONFIG || require('../config/running-score-config.js'),
      root.RunUtils || require('./utils.js')
    );
  } else {
    root.PaceCalculatorEngine = factory(root.RUN_CONFIG, root.RunUtils);
  }
})(typeof self !== 'undefined' ? self : this, function (config, utils) {
  'use strict';

  const DISTANCES = config.distances || {
    "400m": 0.4,
    "800m": 0.8,
    "1k": 1.0,
    "3k": 3.0,
    "5k": 5.0,
    "10k": 10.0,
    "half": 21.0975,
    "marathon": 42.195
  };

  return {
    getStandardDistances: function () {
      return DISTANCES;
    },

    /**
     * Mode A: Distance (km) + Total Time (seconds) -> Pace & Speed & Splits
     */
    calculateFromDistanceAndTime: function (distanceKm, totalSeconds) {
      if (!distanceKm || distanceKm <= 0 || !totalSeconds || totalSeconds <= 0) {
        return {
          valid: false,
          paceSeconds: 0,
          paceString: "--:--",
          speedKmh: 0,
          speedString: "-",
          splits: {}
        };
      }

      const paceSeconds = totalSeconds / distanceKm;
      const speedKmh = 3600 / paceSeconds;
      const splits = this.calculateSplitsForPace(paceSeconds);

      return {
        valid: true,
        distanceKm: distanceKm,
        totalSeconds: totalSeconds,
        totalTimeString: utils.secondsToTimeString(totalSeconds, true),
        paceSeconds: paceSeconds,
        paceString: utils.secondsToTimeString(paceSeconds),
        speedKmh: speedKmh,
        speedString: utils.formatNumber(speedKmh, 2),
        splits: splits
      };
    },

    /**
     * Mode B: Pace (seconds per km) -> Speed & All Distances Finish Times
     */
    calculateFromPace: function (paceSeconds, customDistanceKm = null) {
      if (!paceSeconds || paceSeconds <= 0) {
        return {
          valid: false,
          paceSeconds: 0,
          paceString: "--:--",
          speedKmh: 0,
          speedString: "-",
          splits: {}
        };
      }

      const speedKmh = 3600 / paceSeconds;
      const splits = this.calculateSplitsForPace(paceSeconds, customDistanceKm);

      return {
        valid: true,
        paceSeconds: paceSeconds,
        paceString: utils.secondsToTimeString(paceSeconds),
        speedKmh: speedKmh,
        speedString: utils.formatNumber(speedKmh, 2),
        splits: splits
      };
    },

    /**
     * Mode C: Speed (km/h) -> Pace & All Distances Finish Times
     */
    calculateFromSpeed: function (speedKmh, customDistanceKm = null) {
      if (!speedKmh || speedKmh <= 0) {
        return {
          valid: false,
          paceSeconds: 0,
          paceString: "--:--",
          speedKmh: 0,
          speedString: "-",
          splits: {}
        };
      }

      const paceSeconds = 3600 / speedKmh;
      const splits = this.calculateSplitsForPace(paceSeconds, customDistanceKm);

      return {
        valid: true,
        speedKmh: speedKmh,
        speedString: utils.formatNumber(speedKmh, 2),
        paceSeconds: paceSeconds,
        paceString: utils.secondsToTimeString(paceSeconds),
        splits: splits
      };
    },

    /**
     * Calculate Splits and Standard Finish Times for a given pace
     */
    calculateSplitsForPace: function (paceSeconds, customDistanceKm = null) {
      const results = {};

      const list = [
        { key: "400m", label: "400m", km: DISTANCES["400m"] },
        { key: "800m", label: "800m", km: DISTANCES["800m"] },
        { key: "1k", label: "1 km", km: DISTANCES["1k"] },
        { key: "3k", label: "3 km", km: DISTANCES["3k"] },
        { key: "5k", label: "5 km", km: DISTANCES["5k"] },
        { key: "10k", label: "10 km", km: DISTANCES["10k"] },
        { key: "half", label: "하프 마라톤 (21.0975 km)", km: DISTANCES["half"] },
        { key: "marathon", label: "풀 마라톤 (42.195 km)", km: DISTANCES["marathon"] }
      ];

      if (customDistanceKm && customDistanceKm > 0) {
        list.push({
          key: "custom",
          label: `사용자 지정 (${customDistanceKm} km)`,
          km: customDistanceKm
        });
      }

      for (const item of list) {
        const timeSec = paceSeconds * item.km;
        results[item.key] = {
          label: item.label,
          km: item.km,
          seconds: timeSec,
          timeString: utils.secondsToTimeString(timeSec, item.km >= 10)
        };
      }

      return results;
    },

    /**
     * Generate Full Pace Table Rows (e.g., 3:30 to 7:00)
     */
    generatePaceTable: function (minSec = 210, maxSec = 420, stepSec = 10) {
      const rows = [];
      for (let sec = minSec; sec <= maxSec; sec += stepSec) {
        const speed = 3600 / sec;
        const time5k = sec * DISTANCES["5k"];
        const time10k = sec * DISTANCES["10k"];
        const timeHalf = sec * DISTANCES["half"];
        const timeFull = sec * DISTANCES["marathon"];

        rows.push({
          paceSeconds: sec,
          paceString: utils.secondsToTimeString(sec),
          speedKmh: utils.formatNumber(speed, 2),
          time5k: utils.secondsToTimeString(time5k),
          time10k: utils.secondsToTimeString(time10k, true),
          timeHalf: utils.secondsToTimeString(timeHalf, true),
          timeFull: utils.secondsToTimeString(timeFull, true)
        });
      }
      return rows;
    }
  };
});
