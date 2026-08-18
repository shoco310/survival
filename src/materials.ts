import { GAME_CONFIG } from './config';
import { clamp } from './ui';
import type { Material, MaterialRole, RoleAggregates } from './types';

export function pickMaterialsForRound(): Material[] {
  const pool = [...GAME_CONFIG.materials.pool];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, GAME_CONFIG.materials.displayCount);
}

export function requiredPickCount(): number {
  const { minPick, maxPick } = GAME_CONFIG.materials;
  return Math.floor(Math.random() * (maxPick - minPick + 1)) + minPick;
}

/** 判断力スコア用：選んだ素材の(湿気を考慮しない)基礎品質の平均 */
export function averageQuality(collected: Material[]): number {
  if (collected.length === 0) return 0;
  const sum = collected.reduce((acc, m) => acc + m.quality, 0);
  return sum / collected.length;
}

/** 判断力スコア用：火口・焚き付け・燃料が何種類揃っているか（0〜3） */
export function roleCoverageCount(collected: Material[]): number {
  return new Set(collected.map((m) => m.role)).size;
}

/** 湿度(0-100)を考慮した、その素材の実効品質 */
export function effectiveQuality(material: Material, wetness: number): number {
  if (!material.wetSensitive) return material.quality;
  const ratio = wetness / GAME_CONFIG.wetness.max;
  const penalty = GAME_CONFIG.wetness.qualityPenaltyAtMax * ratio;
  return material.quality * (1 - penalty);
}

/** 役割ごとに実効品質を集計する。選んでいない役割は仮の低品質値になる */
export function aggregateByRole(collected: Material[], wetness: number): RoleAggregates {
  const roles: MaterialRole[] = ['tinder', 'kindling', 'fuel'];
  const result = {} as RoleAggregates;
  for (const role of roles) {
    const items = collected.filter((m) => m.role === role);
    if (items.length === 0) {
      result[role] = { count: 0, quality: GAME_CONFIG.materials.missingRoleBaseline };
      continue;
    }
    const quality = items.reduce((sum, m) => sum + effectiveQuality(m, wetness), 0) / items.length;
    result[role] = { count: items.length, quality };
  }
  return result;
}

const ROLE_NORMALIZER = 70;

/** 回転フェーズの熱上昇倍率。火口(tinder)が主役、焚き付け(kindling)が少し補助する */
export function rotateIgnitionFactor(agg: RoleAggregates): number {
  const raw = 0.15 + (agg.tinder.quality / ROLE_NORMALIZER) * 0.9 + (agg.kindling.quality / ROLE_NORMALIZER) * 0.15;
  return clamp(raw, 0.15, 1.5);
}

/**
 * 息吹きフェーズの火力成長倍率。
 * 火力が低いうちは焚き付け(kindling)が主役、育ってからは燃料(fuel)が主役になる。
 */
export function fireGrowthFactor(fire: number, agg: RoleAggregates): number {
  if (fire < GAME_CONFIG.breath.earlyFireThreshold) {
    const raw = 0.3 + (agg.kindling.quality / ROLE_NORMALIZER) * 0.55 + (agg.tinder.quality / ROLE_NORMALIZER) * 0.35;
    return clamp(raw, 0.25, 1.5);
  }
  let raw = 0.25 + (agg.fuel.quality / ROLE_NORMALIZER) * 0.7 + (agg.kindling.quality / ROLE_NORMALIZER) * 0.25;
  // 燃料を一切選んでいない場合、大きな炎を自力で保てず終盤で少し失速する
  if (agg.fuel.count === 0 && fire >= 80) {
    raw *= 0.55;
  }
  return clamp(raw, 0.18, 1.5);
}
