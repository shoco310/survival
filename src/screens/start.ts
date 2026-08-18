import { store } from '../state';
import { weatherChipHtml } from '../ui';
import { pickMaterialsForRound } from '../materials';
import type { EquipmentId } from '../types';
import type { ScreenContext, Unmount } from './context';

const EQUIPMENT_META: Record<EquipmentId, { emoji: string; label: string; desc: string }> = {
  fire: { emoji: '🔥', label: 'FIRE KIT', desc: '火を起こしやすくなる' },
  food: { emoji: '🍖', label: 'FOOD', desc: '体力を維持できる' },
  shelter: { emoji: '🏕️', label: 'SHELTER', desc: '雨と風に強くなる' },
};

export function mountStart(root: HTMLElement, ctx: ScreenContext): Unmount {
  ctx.setFireVisual({ phase: 'idle', fire: 0 });
  ctx.setAmbient(0);

  const state = store.state;

  root.innerHTML = `
    <div class="screen">
      <div class="title-block">
        <div class="kicker">Survival Fire Making</div>
        <h1>SURVIVE THE NIGHT</h1>
        <p>夜になる前に、火を起こせ。</p>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
        ${weatherChipHtml(state.weather)}
        <span class="weather-note">※天候は途中で変わることがある</span>
      </div>
      <div class="equipment-grid">
        ${(['fire', 'food', 'shelter'] as EquipmentId[])
          .map(
            (id) => `
          <button class="equipment-card" data-id="${id}">
            <span class="emoji">${EQUIPMENT_META[id].emoji}</span>
            <span>
              <div class="label">${EQUIPMENT_META[id].label}</div>
              <div class="desc">${EQUIPMENT_META[id].desc}</div>
            </span>
          </button>
        `,
          )
          .join('')}
      </div>
    </div>
  `;

  const onClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.equipment-card');
    if (!btn) return;
    const id = btn.dataset.id as EquipmentId;
    const now = Date.now();
    store.set({
      equipment: id,
      startTime: now,
      materialsPool: pickMaterialsForRound(),
      collectedMaterials: [],
      screen: 'gather',
    });
  };
  root.addEventListener('click', onClick);

  return () => root.removeEventListener('click', onClick);
}
