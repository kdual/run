export const APP_CONFIG = {
  defaultLocation: { name: '서울 송파구', address: '서울특별시 송파구', region1: '서울특별시', region2: '송파구', latitude: 37.5145, longitude: 127.1059 },
  apiBaseUrl: 'https://runwise-api.jhkwon558.workers.dev',
  timezone: 'Asia/Seoul',
  cacheMinutes: 20,
  runningHours: { start: 5, end: 23 },
  weights: { temperature: 24, dewPoint: 18, humidity: 10, rain: 17, wind: 11, airQuality: 15, uv: 5 },
  paceTable: { startSeconds: 210, endSeconds: 420, stepSeconds: 10 },
  distances: { '400m': 0.4, '800m': 0.8, '1K': 1, '3K': 3, '5K': 5, '10K': 10, Half: 21.0975, Marathon: 42.195 }
};

export const SCORE_GRADES = [
  { min: 90, label: '매우 좋음', key: 'excellent' },
  { min: 80, label: '좋음', key: 'good' },
  { min: 70, label: '무난함', key: 'normal' },
  { min: 60, label: '주의', key: 'caution' },
  { min: 40, label: '좋지 않음', key: 'bad' },
  { min: 0, label: '러닝 비추천 환경', key: 'danger' }
];
