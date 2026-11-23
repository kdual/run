import { timeOnly } from './utils.js';

export function renderHourlyChart(container, rows, onSelect) {
  const scoredRows = rows.filter(row => Number.isFinite(row.score));
  if (!scoredRows.length) {
    container.innerHTML = '<p class="muted">표시할 시간대 데이터가 없습니다.</p>';
    return;
  }

  container.innerHTML = `<div class="hourly-bars">
    ${scoredRows.map(row => `<button type="button" class="hourly-bar" aria-pressed="false">
      <span class="sr-only">${row.observed ? '최신 관측 반영' : '예보'}</span>
      <strong>${row.score}</strong>
      <span class="hourly-bar-fill${row.score >= 90 ? ' high-score' : ''}" style="--score:${row.score / 100}" aria-hidden="true"></span>
      <span>${timeOnly(row.time)}</span>
    </button>`).join('')}
  </div>`;

  const buttons = [...container.querySelectorAll('.hourly-bar')];
  let selectedIndex = -1;

  function selectHour(index) {
    if (index === selectedIndex) return;
    buttons[selectedIndex]?.setAttribute('aria-pressed', 'false');
    buttons[index].setAttribute('aria-pressed', 'true');
    selectedIndex = index;
    onSelect(scoredRows[index]);
  }

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => selectHour(index));
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') selectHour(index);
    });
  });

  const nowMinute = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T').slice(0, 16);
  const firstFuture = scoredRows.findIndex(row => row.time.slice(0, 16) >= nowMinute);
  const initialIndex = Math.max(0, firstFuture);
  selectHour(initialIndex);
  const initial = buttons[initialIndex];
  container.scrollLeft = Math.max(0, initial.offsetLeft + (initial.offsetWidth - container.clientWidth) / 2);
}
