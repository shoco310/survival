import { GAME_CONFIG } from './config';
import { averageQuality, roleCoverageCount } from './materials';
import type { GameState, ScoreBreakdown } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeScore(state: GameState): ScoreBreakdown {
  const w = GAME_CONFIG.score.weights;

  // 判断力：素材の平均品質 + 火口/焚き付け/燃料をバランスよく揃えられたか
  const quality = averageQuality(state.collectedMaterials); // 0-100
  const balance = (roleCoverageCount(state.collectedMaterials) / 3) * 100; // 0-100
  const judgementRaw =
    quality * GAME_CONFIG.score.judgementQualityWeight + balance * GAME_CONFIG.score.judgementBalanceWeight;
  const judgement = Math.round((clamp(judgementRaw, 0, 100) / 100) * w.judgement);

  // 火おこし技術：回転フェーズの所要時間（速いほど高得点）。摩擦へ後戻りした回数も減点
  const rotateSeconds =
    state.rotateMetrics.finishedAt != null
      ? (state.rotateMetrics.finishedAt - state.rotateMetrics.startedAt) / 1000
      : GAME_CONFIG.score.idealFrictionSeconds * 3;
  const rotateOver = Math.max(0, rotateSeconds - GAME_CONFIG.score.idealFrictionSeconds);
  const techniqueRaw =
    100 - rotateOver * GAME_CONFIG.score.frictionPenaltyPerSecond - state.rotateResetCount * 12;
  const technique = Math.round((clamp(techniqueRaw, 0, 100) / 100) * w.technique);

  // 火の管理：息の吹き方が理想の酸素量にどれだけ近かったか（平均効率）
  const managementRaw =
    state.breathMetrics.totalTicks > 0
      ? (state.breathMetrics.safeZoneTicks / state.breathMetrics.totalTicks) * 100
      : 0;
  const management = Math.round((clamp(managementRaw, 0, 100) / 100) * w.management);

  // スピード：クリアタイム
  const totalSeconds =
    state.startTime != null && state.finishTime != null ? (state.finishTime - state.startTime) / 1000 : 999;
  const speedOver = Math.max(0, totalSeconds - GAME_CONFIG.score.speedFullMarkSeconds);
  const speedRaw = 100 - speedOver * GAME_CONFIG.score.speedPenaltyPerSecond;
  const speed = Math.round((clamp(speedRaw, 0, 100) / 100) * w.speed);

  const total = clamp(judgement + technique + management + speed, 0, 100);
  const rank = GAME_CONFIG.ranks.find((r) => total >= r.min && total <= r.max)?.title ?? 'サバイバー';

  return { judgement, technique, management, speed, total, rank };
}

export function formatTime(ms: number): string {
  const totalCentis = Math.floor(ms / 10);
  const minutes = Math.floor(totalCentis / 6000);
  const seconds = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis
    .toString()
    .padStart(2, '0')}`;
}
