import { GAME_CONFIG } from './config';
import { formatTime } from './scoring';
import type { ScoreBreakdown } from './types';

export function buildShareText(elapsedMs: number, score: ScoreBreakdown): string {
  const hashtags = GAME_CONFIG.share.hashtags.map((h) => `#${h}`).join(' ');
  return [
    `🔥 無人島で火を起こしました！`,
    ``,
    `🔥 FIRE TIME：${formatTime(elapsedMs).replace(':', '分').replace('.', '秒')}`,
    `🏆 サバイバル力：${score.total}点`,
    `🌴 RANK：${score.rank}`,
    ``,
    `あなたは火を起こせる？`,
    ``,
    hashtags,
  ].join('\n');
}

export async function shareResult(elapsedMs: number, score: ScoreBreakdown): Promise<'shared' | 'copied' | 'failed'> {
  const text = buildShareText(elapsedMs, score);
  const url = location.href.split('?')[0];

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
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function twitterShareUrl(elapsedMs: number, score: ScoreBreakdown): string {
  const text = buildShareText(elapsedMs, score);
  const url = location.href.split('?')[0];
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
