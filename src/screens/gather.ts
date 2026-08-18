import { store } from '../state';
import { startTimerDisplay, weatherChipHtml } from '../ui';
import { requiredPickCount } from '../materials';
import type { Material } from '../types';
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
  const collected: Material[] = [];

  const scatterItems = layoutScatter(state.materialsPool);

  root.innerHTML = `
    <div class="screen">
      <div class="hud">
        <span>${weatherChipHtml(state.weather)}</span>
        <span class="timer" id="gather-timer">00:00.00</span>
      </div>
      <div class="step-title">火種になる素材を集めよう</div>
      <div class="step-sub">燃えそうなものをタップして選ぼう</div>
      <div class="material-scatter" id="material-scatter">
        ${scatterItems
          .map(
            (item) => `
          <button class="material-item" data-id="${item.material.id}"
            style="left:${item.left}%; top:${item.top}%; transform: translate(-50%,-50%) rotate(${item.rotation}deg);">
            <span class="emoji">${item.material.emoji}</span>
            <span class="label">${item.material.label}</span>
          </button>
        `,
          )
          .join('')}
      </div>
      <div class="pick-progress"><b id="pick-count">0</b> / ${target} 個</div>
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

  const onClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.material-item');
    if (!btn || btn.classList.contains('picked')) return;
    const id = btn.dataset.id!;
    const material = state.materialsPool.find((m) => m.id === id);
    if (!material) return;

    btn.classList.add('picked');
    collected.push(material);
    pickCountEl.textContent = String(collected.length);

    if (collected.length >= target) {
      root.removeEventListener('click', onClick);
      setTimeout(() => {
        store.state.collectedMaterials = collected;
        store.set({ screen: 'firepit' });
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

interface ScatterItem {
  material: Material;
  left: number;
  top: number;
  rotation: number;
}

function layoutScatter(materials: Material[]): ScatterItem[] {
  const columns = 3;
  const rows = Math.ceil(materials.length / columns);
  const cellW = 100 / columns;
  const cellH = 78 / rows;
  const topOffset = 8;

  const order = [...materials.keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return materials.map((material, i) => {
    const slot = order[i];
    const col = slot % columns;
    const row = Math.floor(slot / columns);
    const jitterX = (Math.random() - 0.5) * (cellW * 0.5);
    const jitterY = (Math.random() - 0.5) * (cellH * 0.5);
    const left = Math.min(92, Math.max(8, col * cellW + cellW / 2 + jitterX));
    const top = Math.min(96, Math.max(6, topOffset + row * cellH + cellH / 2 + jitterY));
    const rotation = Math.round((Math.random() - 0.5) * 32);
    return { material, left, top, rotation };
  });
}
