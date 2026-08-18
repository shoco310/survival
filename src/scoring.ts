import { GAME_CONFIG } from './config';
import { averageQuality } from './materials';
import type { GameState, ScoreBreakdown } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeScore(state: GameState): ScoreBreakdown {
  const w = GAME_CONFIG.score.weights;

  // 判断力：集めた素材の平均品質
  const quality = averageQuality(state.collectedMaterials); // 0-100
  const judgement = Math.round((quality / 100) * w.judgement);

  // 火おこし技術：摩擦フェーズの所要時間（速いほど高得点）
  const frictionSeconds =
    state.frictionMetrics.finishedAt != null
      ? (state.frictionMetrics.finishedAt - state.frictionMetrics.startedAt) / 1000
      : GAME_CONFIG.score.idealFrictionSeconds * 3;
  const frictionOver = Math.max(0, frictionSeconds - GAME_CONFIG.score.idealFrictionSeconds);
  const techniqueRaw = 100 - frictionOver * GAME_CONFIG.score.frictionPenaltyPerSecond;
  const technique = Math.round((clamp(techniqueRaw, 0, 100) / 100) * w.technique);

  // 火の管理：酸素を安全ゾーン内に保てた割合 - 消火ペナルティ
  const safeRatio =
    state.breathMetrics.totalTicks > 0
      ? (state.breathMetrics.safeZoneTicks / state.breathMetrics.totalTicks) * 100
      : 0;
  const managementRaw =
    safeRatio - state.breathMetrics.extinguishCount * GAME_CONFIG.score.managementPenaltyPerExtinguish;
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
