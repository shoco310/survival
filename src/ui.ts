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

/**
 * 焚き火ステージ（回転する棒・素材・炎）の中心が、画面の高さの何%の位置にあるか。
 * fireCanvas.ts（描画）と field.ts（当たり判定・素材配置）の両方がこの一点を共有しないと
 * 見た目と操作判定がズレるため、値はここ一箇所にまとめる。
 */
export const FIRE_STAGE_Y_RATIO = 0.62;
