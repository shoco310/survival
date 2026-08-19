import { store } from '../state';
import { audioEngine } from '../audio';
import type { ScreenContext, Unmount } from './context';

const REASON_TEXT: Record<string, string> = {
  sunset: '日没が来てしまった',
  exhausted: '力尽きてしまった',
};

export function mountGameOver(root: HTMLElement, ctx: ScreenContext): Unmount {
  const state = store.state;
  ctx.setFireVisual({ phase: 'idle', fire: 0, windAmp: 0.3, rainAmp: 0 });
  ctx.setAmbient(0);
  audioEngine.playBlip('fail');

  const reason = REASON_TEXT[state.gameOverReason ?? 'sunset'] ?? REASON_TEXT.sunset;

  root.innerHTML = `
    <div class="screen gameover-screen">
      <div class="gameover-content">
        <div class="gameover-title">生き延びられなかった</div>
        <div class="gameover-reason">${reason}</div>
        <p class="gameover-sub">火は、起こせなかった。</p>
        <button class="btn btn-primary" id="retry-btn">🔥 もう一度挑戦</button>
      </div>
    </div>
  `;

  const retryBtn = root.querySelector<HTMLButtonElement>('#retry-btn')!;
  const onRetry = () => store.reset();
  retryBtn.addEventListener('click', onRetry);

  return () => retryBtn.removeEventListener('click', onRetry);
}
