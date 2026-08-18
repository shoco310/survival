import { store } from '../state';
import { startTimerDisplay, weatherChipHtml, clamp } from '../ui';
import { GAME_CONFIG } from '../config';
import { aggregateByRole, frictionIgnitionFactor } from '../materials';
import { frictionWeatherMultiplier } from '../weather';
import type { ScreenContext, Unmount } from './context';

export function mountFriction(root: HTMLElement, ctx: ScreenContext): Unmount {
  const state = store.state;
  const cfg = GAME_CONFIG.friction;
  const hasFireKit = state.equipment === 'fire';
  const hasFood = state.equipment === 'food';
  const hasShelter = state.equipment === 'shelter';

  let heat = hasFireKit ? GAME_CONFIG.equipment.fire.startingHeat : 0;
  let finished = false;
  state.frictionMetrics.startedAt = Date.now();

  const equipmentMultiplier = hasFireKit ? GAME_CONFIG.equipment.fire.frictionRateMultiplier : 1;
  const decayMultiplier = hasFood ? GAME_CONFIG.equipment.food.heatDecayMultiplier : 1;

  ctx.setFireVisual({ phase: heat > 0 ? 'smoke' : 'idle', fire: 0 });
  ctx.setAmbient(0);

  root.innerHTML = `
    <div class="screen">
      <div class="hud">
        <span id="weather-chip">${weatherChipHtml(state.weather)}</span>
        <span class="timer" id="friction-timer">00:00.00</span>
      </div>
      <div class="step-title">摩擦で火種を作れ</div>
      <div class="step-sub">画面を左右にすばやくこすろう</div>
      <div class="friction-zone" id="friction-zone">
        <div class="swipe-hint">✋💨</div>
        <div class="gauge-wrap">
          <div class="gauge-label"><span>摩擦熱</span><span id="heat-value">${Math.round(heat)}%</span></div>
          <div class="gauge-track"><div class="gauge-fill" id="heat-fill" style="width:${heat}%"></div></div>
        </div>
        <div class="friction-instruction">指かマウスを左右に素早く動かして熱を高めよう</div>
      </div>
    </div>
  `;

  const stopTimer = state.startTime ? startTimerDisplay(root.querySelector('#friction-timer')!, state.startTime) : () => {};

  const zone = root.querySelector<HTMLElement>('#friction-zone')!;
  const heatFill = root.querySelector<HTMLElement>('#heat-fill')!;
  const heatValue = root.querySelector<HTMLElement>('#heat-value')!;
  const weatherChipEl = root.querySelector<HTMLElement>('#weather-chip')!;
  let lastRenderedWeather = state.weather;

  let pointerActive = false;
  let lastX = 0;
  let lastDir = 0;
  let lastMoveAt = performance.now();

  const registerSwipe = () => {
    const agg = aggregateByRole(state.collectedMaterials, state.wetness);
    const ignitionFactor = frictionIgnitionFactor(agg);
    const weatherMultiplier = frictionWeatherMultiplier(state.weather, hasShelter);
    const gain = cfg.baseSwipeGain * ignitionFactor * equipmentMultiplier * weatherMultiplier;
    heat = clamp(heat + gain, 0, 100);
    lastMoveAt = performance.now();
    if (heat >= 100 && !finished) triggerSpark();
  };

  const onPointerDown = (e: PointerEvent) => {
    pointerActive = true;
    lastX = e.clientX;
    zone.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pointerActive || finished) return;
    const dx = e.clientX - lastX;
    if (Math.abs(dx) >= cfg.minSwipeDistance) {
      const dir = Math.sign(dx);
      if (dir !== 0 && dir !== lastDir) {
        registerSwipe();
        lastDir = dir;
      }
      lastX = e.clientX;
    }
  };
  const onPointerUp = () => {
    pointerActive = false;
    lastDir = 0;
  };

  zone.addEventListener('pointerdown', onPointerDown);
  zone.addEventListener('pointermove', onPointerMove);
  zone.addEventListener('pointerup', onPointerUp);
  zone.addEventListener('pointercancel', onPointerUp);

  let raf = 0;
  let lastFrameT = performance.now();
  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - lastFrameT) / 1000);
    lastFrameT = t;

    if (!finished) {
      const idleFor = performance.now() - lastMoveAt;
      if (idleFor > cfg.idleGraceMs && heat > 0) {
        heat = clamp(heat - cfg.decayPerSecond * decayMultiplier * dt, 0, 100);
      }
      heatFill.style.width = `${heat}%`;
      heatValue.textContent = `${Math.round(heat)}%`;
      state.heat = heat;
      ctx.setFireVisual({ phase: heat > 30 ? 'smoke' : 'idle' });

      if (state.weather !== lastRenderedWeather) {
        lastRenderedWeather = state.weather;
        weatherChipEl.innerHTML = weatherChipHtml(state.weather);
      }
    }

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  function triggerSpark() {
    finished = true;
    state.frictionMetrics.finishedAt = Date.now();
    zone.removeEventListener('pointerdown', onPointerDown);
    zone.removeEventListener('pointermove', onPointerMove);
    zone.removeEventListener('pointerup', onPointerUp);

    ctx.setFireVisual({ phase: 'smoke' });
    root.querySelector('.friction-instruction')!.textContent = '煙が上がった…';

    setTimeout(() => {
      ctx.setFireVisual({ phase: 'ember' });
      const initialFire = GAME_CONFIG.breath.initialEmberFire + (hasFireKit ? 3 : 0);
      state.sparked = true;
      state.fire = initialFire;
      state.oxygen = 0;
      setTimeout(() => {
        store.set({ screen: 'breath' });
      }, 700);
    }, 650);
  }

  return () => {
    cancelAnimationFrame(raf);
    stopTimer();
    zone.removeEventListener('pointerdown', onPointerDown);
    zone.removeEventListener('pointermove', onPointerMove);
    zone.removeEventListener('pointerup', onPointerUp);
    zone.removeEventListener('pointercancel', onPointerUp);
  };
}
