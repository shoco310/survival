import { GAME_CONFIG } from './config';
import type { WeatherId } from './types';

export const WEATHER_META: Record<WeatherId, { emoji: string; label: string }> = {
  sunny: { emoji: '☀️', label: '晴れ' },
  wind: { emoji: '💨', label: '強風' },
  rain: { emoji: '🌧️', label: '小雨' },
  storm: { emoji: '⛈️', label: '激しい雨' },
};

export function rollWeather(): WeatherId {
  const probs = GAME_CONFIG.weather.probabilities;
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const key of Object.keys(probs) as WeatherId[]) {
    roll -= probs[key];
    if (roll <= 0) return key;
  }
  return 'sunny';
}

/** shelter装備時、悪天候の倍率をどれだけ1.0に近づけるか */
export function applyShelterMitigation(multiplier: number, hasShelter: boolean): number {
  if (!hasShelter || multiplier >= 1) return multiplier;
  const mitigation = GAME_CONFIG.weather.shelterMitigation;
  return multiplier + (1 - multiplier) * mitigation;
}

export function frictionWeatherMultiplier(weather: WeatherId, hasShelter: boolean): number {
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
