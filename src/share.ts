import { GAME_CONFIG } from './config';
import { formatTime } from './scoring';
import { WEATHER_META } from './weather';
import type { ScoreBreakdown, WeatherId } from './types';

export function buildShareBody(elapsedMs: number, score: ScoreBreakdown, weather: WeatherId): string {
  const hashtags = GAME_CONFIG.share.hashtags.map((h) => `#${h}`).join('\n');
  const w = WEATHER_META[weather];
  return [
    `🔥 無人島で火を起こした！`,
    ``,
    `⏱ FIRE TIME：${formatTime(elapsedMs)}`,
    `🏆 サバイバル力：${score.total}点`,
    `🌴 RANK：${score.rank}`,
    `${w.emoji} WEATHER：${w.label}`,
    ``,
    `あなたは夜になる前に火を起こせる？`,
    ``,
    hashtags,
  ].join('\n');
}

export async function shareResult(
  elapsedMs: number,
  score: ScoreBreakdown,
  weather: WeatherId,
): Promise<'shared' | 'copied' | 'failed'> {
  const text = buildShareBody(elapsedMs, score, weather);
  const url = GAME_CONFIG.share.url;

  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return 'shared';
    } catch {
      // ユーザーがキャンセルした場合などはフォールバックしない
      return 'failed';
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function twitterShareUrl(elapsedMs: number, score: ScoreBreakdown, weather: WeatherId): string {
  const text = buildShareBody(elapsedMs, score, weather);
  const url = GAME_CONFIG.share.url;
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
