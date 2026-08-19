import { store } from '../state';
import { audioEngine } from '../audio';
import type { ScreenContext, Unmount } from './context';

export function mountTitle(root: HTMLElement, ctx: ScreenContext): Unmount {
  ctx.setFireVisual({ phase: 'idle', fire: 0, windAmp: 0.2, rainAmp: 0 });
  ctx.setAmbient(0);

  root.innerHTML = `
    <div class="screen title-screen">
      <div class="title-hero">
        <div class="title-kicker">日没まで、あと僅か。</div>
        <h1 class="title-hero-h1">SURVIVE<br/>THE NIGHT</h1>
        <p class="title-hero-sub">火を起こせ。夜を生き延びろ。</p>
      </div>
      <button class="survive-btn" id="survive-btn">生き延びる</button>
      <div class="title-foot">🔇 タップして音を有効化</div>
    </div>
  `;

  const btn = root.querySelector<HTMLButtonElement>('#survive-btn')!;
  const onClick = () => {
    audioEngine.start();
    audioEngine.playBlip('whoosh');
    store.set({ screen: 'field' });
  };
  btn.addEventListener('click', onClick);

  return () => btn.removeEventListener('click', onClick);
}
