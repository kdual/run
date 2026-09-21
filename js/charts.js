/**
 * Chart.js Integration for Running Dashboard
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RunCharts = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let hourlyChartInstance = null;

  function getThemeColors(isDark) {
    return {
      textColor: isDark ? "#cbd5e1" : "#475569",
      gridColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      tooltipBg: isDark ? "#1e293b" : "#ffffff",
      tooltipTitle: isDark ? "#f8fafc" : "#0f172a",
      tooltipBody: isDark ? "#e2e8f0" : "#334155",
      tooltipBorder: isDark ? "#334155" : "#e2e8f0"
    };
  }

  return {
    /**
     * Render or Update Hourly Running Score Chart
     */
    renderHourlyChart: function (canvasElement, hourlyData, isDark, onPointClick) {
      if (!canvasElement || typeof Chart === 'undefined') {
        console.warn("Chart.js not available or canvas missing");
        return;
      }

      const colors = getThemeColors(isDark);
      const labels = hourlyData.map(h => `${String(h.hour).padStart(2, '0')}:00`);
      const scores = hourlyData.map(h => h.runningScore.totalScore);
      const temps = hourlyData.map(h => Math.round(h.temperature));

      // Point colors based on score
      const pointColors = hourlyData.map(h => {
        const s = h.runningScore.totalScore;
        if (s >= 80) return "#10b981"; // Good
        if (s >= 60) return "#f59e0b"; // Caution
        return "#ef4444";             // Bad
      });

      if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
      }

      const ctx = canvasElement.getContext('2d');

      // Create gradient fill
      const gradient = ctx.createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, isDark ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.2)");
      gradient.addColorStop(1, isDark ? "rgba(16, 185, 129, 0.0)" : "rgba(16, 185, 129, 0.0)");

      hourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Running Score',
              data: scores,
              borderColor: '#10b981',
              borderWidth: 2.5,
              backgroundColor: gradient,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: pointColors,
              pointBorderColor: isDark ? '#0f172a' : '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 7
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: colors.tooltipBg,
              titleColor: colors.tooltipTitle,
              bodyColor: colors.tooltipBody,
              borderColor: colors.tooltipBorder,
              borderWidth: 1,
              padding: 10,
              boxPadding: 4,
              usePointStyle: true,
              callbacks: {
                title: function (items) {
                  const idx = items[0].dataIndex;
                  const item = hourlyData[idx];
                  return `${item.dateKey} ${labels[idx]} (${item.runningScore.grade.label})`;
                },
                label: function (context) {
                  const idx = context.dataIndex;
                  const item = hourlyData[idx];
                  return [
                    `러닝 스코어: ${item.runningScore.totalScore}점`,
                    `기온: ${item.temperature}°C (체감 ${item.apparentTemperature}°C)`,
                    `이슬점: ${item.dewPoint}°C | 습도: ${item.humidity}%`,
                    `강수확률: ${item.precipitationProbability}% | 풍속: ${item.windSpeed} km/h`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: colors.gridColor,
                drawBorder: false
              },
              ticks: {
                color: colors.textColor,
                font: { size: 11 },
                maxTicksLimit: 12
              }
            },
            y: {
              min: 0,
              max: 100,
              grid: {
                color: colors.gridColor,
                drawBorder: false
              },
              ticks: {
                color: colors.textColor,
                stepSize: 20,
                font: { size: 11 }
              }
            }
          },
          onClick: function (event, elements) {
            if (elements && elements.length > 0 && typeof onPointClick === 'function') {
              const index = elements[0].index;
              onPointClick(hourlyData[index]);
            }
          }
        }
      });
    },

    updateTheme: function (isDark) {
      if (hourlyChartInstance) {
        const colors = getThemeColors(isDark);
        hourlyChartInstance.options.scales.x.grid.color = colors.gridColor;
        hourlyChartInstance.options.scales.x.ticks.color = colors.textColor;
        hourlyChartInstance.options.scales.y.grid.color = colors.gridColor;
        hourlyChartInstance.options.scales.y.ticks.color = colors.textColor;
        hourlyChartInstance.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
        hourlyChartInstance.options.plugins.tooltip.titleColor = colors.tooltipTitle;
        hourlyChartInstance.options.plugins.tooltip.bodyColor = colors.tooltipBody;
        hourlyChartInstance.options.plugins.tooltip.borderColor = colors.tooltipBorder;
        hourlyChartInstance.update();
      }
    }
  };
});
