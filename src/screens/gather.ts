import { store } from '../state';
import { startTimerDisplay, weatherChipHtml } from '../ui';
import { requiredPickCount } from '../materials';
import type { GatherLogEntry } from '../types';
import type { ScreenContext, Unmount } from './context';

const EQUIPMENT_LABEL: Record<string, string> = {
  fire: 'FIRE KIT',
  food: 'FOOD',
  shelter: 'SHELTER',
};

export function mountGather(root: HTMLElement, ctx: ScreenContext): Unmount {
  ctx.setFireVisual({ phase: 'idle', fire: 0 });
  ctx.setAmbient(0);

  const state = store.state;
  const target = requiredPickCount();
  const collected: GatherLogEntry[] = [];

  root.innerHTML = `
    <div class="screen">
      <div class="hud">
        <span>${weatherChipHtml(state.weather)}</span>
        <span class="timer" id="gather-timer">00:00.00</span>
      </div>
      <div class="step-title">火種になる素材を集めよう</div>
      <div class="step-sub">燃えそうなものをタップして選ぼう</div>
      <div class="material-grid" id="material-grid">
        ${state.materialsPool
          .map(
            (m) => `
          <button class="material-card" data-id="${m.id}">
            <span class="emoji">${m.emoji}</span>
            <span class="label">${m.label}</span>
          </button>
        `,
          )
          .join('')}
      </div>
      <div class="pick-progress"><b id="pick-count">0</b> / ${target} 個 集めた</div>
      <div class="collected-row" id="collected-row"></div>
      <div id="intro-overlay" class="success-flash" style="z-index:30;">
        <p style="font-size:14px;letter-spacing:.2em;color:var(--ink-dim);">EQUIPPED</p>
        <h2>${EQUIPMENT_LABEL[state.equipment ?? ''] ?? ''}</h2>
        <p>あなたは ${EQUIPMENT_LABEL[state.equipment ?? ''] ?? ''} を選んだ</p>
      </div>
    </div>
  `;

  const stopTimer = state.startTime ? startTimerDisplay(root.querySelector('#gather-timer')!, state.startTime) : () => {};

  const introOverlay = root.querySelector<HTMLElement>('#intro-overlay')!;
  const introTimeout = setTimeout(() => {
    introOverlay.style.transition = 'opacity 0.4s ease';
    introOverlay.style.opacity = '0';
    setTimeout(() => introOverlay.remove(), 400);
  }, 1100);

  const pickCountEl = root.querySelector<HTMLElement>('#pick-count')!;
  const collectedRow = root.querySelector<HTMLElement>('#collected-row')!;

  const onClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.material-card');
    if (!btn || btn.classList.contains('picked')) return;
    const id = btn.dataset.id!;
    const material = state.materialsPool.find((m) => m.id === id);
    if (!material) return;

    btn.classList.add('picked');
    collected.push({ materialId: material.id, quality: material.quality });
    pickCountEl.textContent = String(collected.length);
    const span = document.createElement('span');
    span.textContent = material.emoji;
    collectedRow.appendChild(span);

    if (collected.length >= target) {
      root.removeEventListener('click', onClick);
      setTimeout(() => {
        store.state.collectedMaterials = collected;
        store.set({ screen: 'friction' });
      }, 450);
    }
  };
  root.addEventListener('click', onClick);

  return () => {
    clearTimeout(introTimeout);
    stopTimer();
    root.removeEventListener('click', onClick);
  };
}
