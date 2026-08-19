import { GAME_CONFIG } from './config';
import type { WeatherEvent, WeatherId } from './types';

export const WEATHER_META: Record<WeatherId, { emoji: string; label: string }> = {
  sunny: { emoji: '☀️', label: '晴れ' },
  wind: { emoji: '💨', label: '強風' },
  rain: { emoji: '🌧️', label: '小雨' },
  storm: { emoji: '⛈️', label: '激しい雨' },
};

export const WEATHER_TRANSITION_TOAST: Record<WeatherId, string> = {
  sunny: '空が晴れてきた…',
  wind: '風が強くなってきた…',
  rain: '雨が降り始めた…',
  storm: '雨と風が激しくなってきた…',
};

/** HUDの天候表示用：アイコン＋日本語の説明文（数値ではなく状態として見せる） */
export const WEATHER_HUD_TEXT: Record<WeatherId, { icon: string; text: string }> = {
  sunny: { icon: '☁️', text: '穏やか' },
  wind: { icon: '🌬️', text: '風：強い' },
  rain: { icon: '🌧️', text: '小雨' },
  storm: { icon: '⛈️', text: '雨風：強い' },
};

export function rollWeather(exclude?: WeatherId): WeatherId {
  const probs = GAME_CONFIG.weather.probabilities;
  const keys = (Object.keys(probs) as WeatherId[]).filter((k) => k !== exclude);
  const total = keys.reduce((a, k) => a + probs[k], 0);
  let roll = Math.random() * total;
  for (const key of keys) {
    roll -= probs[key];
    if (roll <= 0) return key;
  }
  return keys[0];
}

/** ゲーム開始時に、そのプレイ中に起こる天候変化のタイムラインを作る（0〜2回） */
export function buildWeatherTimeline(initial: WeatherId): WeatherEvent[] {
  const weights = GAME_CONFIG.weatherDynamics.transitionCountWeights;
  const entries = Object.entries(weights) as [string, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let roll = Math.random() * total;
  let count = 0;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) {
      count = Number(key);
      break;
    }
  }

  const { minGapSeconds, maxGapSeconds } = GAME_CONFIG.weatherDynamics;
  const events: WeatherEvent[] = [];
  let current = initial;
  let t = 0;
  for (let i = 0; i < count; i++) {
    t += minGapSeconds + Math.random() * (maxGapSeconds - minGapSeconds);
    const next = rollWeather(current);
    events.push({ atSeconds: t, next });
    current = next;
  }
  return events;
}

/** shelter装備時、悪天候の倍率をどれだけ1.0に近づけるか */
export function applyShelterMitigation(multiplier: number, hasShelter: boolean): number {
  if (!hasShelter || multiplier >= 1) return multiplier;
  const mitigation = GAME_CONFIG.weather.shelterMitigation;
  return multiplier + (1 - multiplier) * mitigation;
}

export function rotateWeatherMultiplier(weather: WeatherId, hasShelter: boolean): number {
  const base = GAME_CONFIG.weather.frictionMultiplier[weather];
  return applyShelterMitigation(base, hasShelter);
}

export function fireGrowthWeatherMultiplier(weather: WeatherId, hasShelter: boolean, fire: number): number {
  const base = GAME_CONFIG.weather.fireGrowthMultiplier[weather];
  const mitigated = applyShelterMitigation(base, hasShelter);
  if (weather === 'wind' && fire >= GAME_CONFIG.weather.windBoostThreshold) {
    return mitigated * GAME_CONFIG.weather.windBoostMultiplier;
  }
  return mitigated;
}

/** 雨・嵐が中央の炎に与える、酸素管理とは無関係の常時ダメージ */
export function passiveFireWeatherDecay(weather: WeatherId, hasShelter: boolean): number {
  const base = GAME_CONFIG.weather.passiveFireDecayPerSecond[weather];
  if (base <= 0) return 0;
  if (!hasShelter) return base;
  return base * (1 - GAME_CONFIG.weather.shelterMitigation);
}

const BASE_AMBIENT: Record<WeatherId, { wind: number; rain: number }> = {
  sunny: { wind: 0.15, rain: 0 },
  wind: { wind: 1, rain: 0 },
  rain: { wind: 0.3, rain: 1 },
  storm: { wind: 0.85, rain: 1.7 },
};

/**
 * 現在の天候と次の変化イベントから、木々の揺れ・雨の強さといった
 * 「見た目の強度」を計算する。変化の予兆リード時間の間は次の天候へ滑らかに近づく。
 */
export function computeAmbientIntensity(
  current: WeatherId,
  upcoming: WeatherEvent | null,
  elapsedSeconds: number,
): { wind: number; rain: number } {
  const base = BASE_AMBIENT[current];
  if (!upcoming) return base;

  const lead = GAME_CONFIG.weatherDynamics.foreshadowLeadSeconds;
  const windowStart = upcoming.atSeconds - lead;
  if (elapsedSeconds < windowStart) return base;

  const progress = Math.min(1, (elapsedSeconds - windowStart) / lead);
  const target = BASE_AMBIENT[upcoming.next];
  return {
    wind: base.wind + (target.wind - base.wind) * progress,
    rain: base.rain + (target.rain - base.rain) * progress,
  };
}
