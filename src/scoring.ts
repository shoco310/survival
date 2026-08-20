import { GAME_CONFIG } from './config';
import { averageQuality, roleCoverageCount } from './materials';
import type { GameState, ScoreBreakdown } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeScore(state: GameState): ScoreBreakdown {
  const w = GAME_CONFIG.score.weights;
  const S = GAME_CONFIG.score;

  // MATERIAL CHOICE：素材の平均品質 + 火口/焚き付け/燃料をバランスよく揃えられたか
  const quality = averageQuality(state.collectedMaterials); // 0-100
  const balance = (roleCoverageCount(state.collectedMaterials) / 3) * 100; // 0-100
  const materialChoiceRaw = quality * S.judgementQualityWeight + balance * S.judgementBalanceWeight;
  const materialChoice = Math.round((clamp(materialChoiceRaw, 0, 100) / 100) * w.materialChoice);

  // FIREMAKING：回転フェーズの所要時間（速いほど高得点）。摩擦へ後戻りした回数も減点
  const rotateSeconds =
    state.rotateMetrics.finishedAt != null
      ? (state.rotateMetrics.finishedAt - state.rotateMetrics.startedAt) / 1000
      : S.idealFrictionSeconds * 3;
  const rotateOver = Math.max(0, rotateSeconds - S.idealFrictionSeconds);
  const firemakingRaw = 100 - rotateOver * S.frictionPenaltyPerSecond - state.rotateResetCount * S.resetPenalty;
  const firemaking = Math.round((clamp(firemakingRaw, 0, 100) / 100) * w.firemaking);

  // BREATH CONTROL：酸素量が理想値にどれだけ近かったかの平均効率
  const breathControlRaw =
    state.breathMetrics.totalTicks > 0
      ? (state.breathMetrics.safeZoneTicks / state.breathMetrics.totalTicks) * 100
      : 0;
  const breathControl = Math.round((clamp(breathControlRaw, 0, 100) / 100) * w.breathControl);

  // FIRE MANAGEMENT：薪投入は任意行動。使った場合はタイミングの良し悪しで、使わなければ中立点
  const fireManagementRaw =
    state.kindlingLog.length === 0
      ? S.kindlingNeutralScore
      : (state.kindlingLog.filter((k) => k.goodTiming).length / state.kindlingLog.length) * 100;
  const fireManagement = Math.round((clamp(fireManagementRaw, 0, 100) / 100) * w.fireManagement);

  // SURVIVAL IQ：装備と天候の相性、後戻りの少なさ
  // どの装備を選んでも後戻り0回なら現実的に高得点へ届くようにしつつ、
  // 天候にぴったり合った選択（雨/嵐にSHELTER）だけが満点に届く設計にする
  let synergy = 0;
  if (state.equipment === 'shelter' && (state.weather === 'rain' || state.weather === 'storm')) synergy = S.survivalIQSynergyBonus;
  else if (state.equipment === 'shelter') synergy = S.survivalIQSynergyBonus * 0.3; // 天候が穏やかでも無駄choiceではない
  else if (state.equipment === 'food') synergy = S.survivalIQSynergyBonus * 0.6;
  else if (state.equipment === 'fire') synergy = S.survivalIQSynergyBonus * 0.4;
  const survivalIQRaw = S.survivalIQBase + synergy - state.rotateResetCount * S.survivalIQResetPenalty;
  const survivalIQ = Math.round((clamp(survivalIQRaw, 0, 100) / 100) * w.survivalIQ);

  // TIME：日没までどれだけ余裕を残してクリアできたか
  const totalSeconds =
    state.startTime != null && state.finishTime != null ? (state.finishTime - state.startTime) / 1000 : 999;
  const remainingRatio = clamp(1 - totalSeconds / GAME_CONFIG.sunset.budgetSeconds, 0, 1);
  const timeRaw = S.timeFullMarkRatio > 0 ? (remainingRatio / S.timeFullMarkRatio) * 100 : 100;
  const time = Math.round((clamp(timeRaw, 0, 100) / 100) * w.time);

  const total = clamp(firemaking + materialChoice + breathControl + fireManagement + survivalIQ + time, 0, 100);
  const rank = GAME_CONFIG.ranks.find((r) => total >= r.min && total <= r.max)?.title ?? 'FIRE STARTER';

  return { firemaking, materialChoice, breathControl, fireManagement, survivalIQ, time, total, rank };
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

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

/** ランクの内部識別子（英語タイトル）から、表示用の日本語ラベルを引く */
export function rankLabelJa(title: string): string {
  return GAME_CONFIG.ranks.find((r) => r.title === title)?.jp ?? title;
}
