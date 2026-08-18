import { GAME_CONFIG } from './config';
import { formatTime } from './scoring';
import { WEATHER_META } from './weather';
import type { ScoreBreakdown, WeatherId } from './types';

export function buildShareBody(elapsedMs: number, score: ScoreBreakdown, weather: WeatherId): string {
  const hashtags = GAME_CONFIG.share.hashtags.map((h) => `#${h}`).join('\n');
  const w = WEATHER_META[weather];
  return [
    `🔥 SURVIVE THE NIGHT`,
    ``,
    `私のサバイバル力は…`,
    ``,
    `🏆 ${score.total} / 100`,
    `🔥 ${score.rank}`,
    `⏱ FIRE TIME：${formatTime(elapsedMs)}`,
    `${w.emoji} WEATHER：${w.label}`,
    ``,
    `あなたは夜になる前に火を起こせる？`,
    ``,
    hashtags,
  ].join('\n');
}

export type ShareOutcome = 'shared-file' | 'shared-text' | 'copied' | 'unsupported' | 'failed';

/**
 * Result Card画像つきの共有を試みる。File Share非対応環境ではテキスト共有、
 * それも無ければクリップボードコピーへ段階的にフォールバックする。
 */
export async function shareResult(
  cardBlob: Blob | null,
  elapsedMs: number,
  score: ScoreBreakdown,
  weather: WeatherId,
): Promise<ShareOutcome> {
  const text = buildShareBody(elapsedMs, score, weather);
  const url = GAME_CONFIG.share.url;

  if (cardBlob && navigator.canShare) {
    const file = new File([cardBlob], 'survive-the-night-result.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, url });
        return 'shared-file';
      } catch {
        return 'failed';
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return 'shared-text';
    } catch {
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

export function downloadResultCard(blob: Blob, filename = 'survive-the-night-result.png'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function twitterShareUrl(elapsedMs: number, score: ScoreBreakdown, weather: WeatherId): string {
  const text = buildShareBody(elapsedMs, score, weather);
  const url = GAME_CONFIG.share.url;
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
