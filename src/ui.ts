import { formatTime } from './scoring';
import { WEATHER_META } from './weather';
import type { WeatherId } from './types';

export function weatherChipHtml(weather: WeatherId): string {
  const meta = WEATHER_META[weather];
  return `<span class="weather-tag">${meta.emoji} ${meta.label}</span>`;
}

export function startTimerDisplay(el: HTMLElement, startTime: number): () => void {
  let raf = 0;
  const tick = () => {
    el.textContent = formatTime(Date.now() - startTime);
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => cancelAnimationFrame(raf);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
