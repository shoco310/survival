import { GAME_CONFIG } from './config';
import type { GatherLogEntry, Material } from './types';

export function pickMaterialsForRound(): Material[] {
  const pool = [...GAME_CONFIG.materials.pool];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, GAME_CONFIG.materials.displayCount);
}

export function averageQuality(collected: GatherLogEntry[]): number {
  if (collected.length === 0) return 0;
  const sum = collected.reduce((acc, m) => acc + m.quality, 0);
  return sum / collected.length;
}

export function requiredPickCount(): number {
  const { minPick, maxPick } = GAME_CONFIG.materials;
  return Math.floor(Math.random() * (maxPick - minPick + 1)) + minPick;
}
