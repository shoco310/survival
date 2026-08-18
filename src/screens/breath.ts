import { store } from '../state';
import { startTimerDisplay, weatherChipHtml, clamp } from '../ui';
import { GAME_CONFIG } from '../config';
import { aggregateByRole, fireGrowthFactor } from '../materials';
import { fireGrowthWeatherMultiplier } from '../weather';
import type { ScreenContext, Unmount } from './context';

export function mountBreath(root: HTMLElement, ctx: ScreenContext): Unmount {
  const state = store.state;
  const cfg = GAME_CONFIG.breath;
  const hasFood = state.equipment === 'food';
  const hasShelter = state.equipment === 'shelter';

  let fire = state.fire;
  let oxygen = state.oxygen;
  let holding = false;
  let overblowSince: number | null = null;
  let finished = false;
  let extinguishFlash = false;

  ctx.setFireVisual({ phase: fire >= 8 ? 'burning' : 'ember', fire });
  ctx.setAmbient(fire);

  root.innerHTML = `
    <div class="screen">
      <div class="hud">
        <span id="weather-chip">${weatherChipHtml(state.weather)}</span>
        <span class="timer" id="breath-timer">00:00.00</span>
      </div>
      <div class="step-title">息を吹いて火を育てろ</div>
      <div class="step-sub">強すぎず、弱すぎず。適度に。</div>
      <div class="breath-zone">
        <div class="fire-power-label">
          <div class="value" id="fire-value">${Math.round(fire)}%</div>
          <div style="color:var(--ink-dim);font-size:12px;">FIRE POWER</div>
        </div>
        <div class="gauge-wrap">
          <div class="gauge-label"><span>酸素量</span><span id="oxygen-value">${Math.round(oxygen)}%</span></div>
          <div class="gauge-track"><div class="gauge-fill oxygen" id="oxygen-fill" style="width:${oxygen}%"></div></div>
        </div>
        <button class="blow-btn" id="blow-btn">🌬️ 長押しして息を吹く</button>
      </div>
    </div>
  `;

  const stopTimer = state.startTime ? startTimerDisplay(root.querySelector('#breath-timer')!, state.startTime) : () => {};

  const fireValueEl = root.querySelector<HTMLElement>('#fire-value')!;
  const oxygenFill = root.querySelector<HTMLElement>('#oxygen-fill')!;
  const oxygenValue = root.querySelector<HTMLElement>('#oxygen-value')!;
  const blowBtn = root.querySelector<HTMLButtonElement>('#blow-btn')!;
  const screenEl = root.querySelector<HTMLElement>('.screen')!;
  const weatherChipEl = root.querySelector<HTMLElement>('#weather-chip')!;
  let lastRenderedWeather = state.weather;

  let warningToast: HTMLElement | null = null;
  const showWarning = () => {
    if (warningToast) return;
    warningToast = document.createElement('div');
    warningToast.className = 'warning-toast';
    warningToast.textContent = '吹きすぎ！';
    screenEl.appendChild(warningToast);
  };
  const hideWarning = () => {
    warningToast?.remove();
    warningToast = null;
  };

  const onDown = (e: PointerEvent) => {
    holding = true;
    blowBtn.setPointerCapture(e.pointerId);
  };
  const onUp = () => {
    holding = false;
  };
  blowBtn.addEventListener('pointerdown', onDown);
  blowBtn.addEventListener('pointerup', onUp);
  blowBtn.addEventListener('pointercancel', onUp);
  blowBtn.addEventListener('pointerleave', onUp);

  let raf = 0;
  let lastT = performance.now();

  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    if (!finished) {
      // 環境ティッカー（突風など）が state.fire / state.oxygen を直接動かすことがあるので、
      // 毎フレーム最新値を取り込んでから進行させる
      fire = state.fire;
      oxygen = state.oxygen;

      oxygen = clamp(oxygen + (holding ? cfg.blowRatePerSecond : -cfg.releaseDecayPerSecond) * dt, 0, 100);

      state.breathMetrics.totalTicks += dt;
      const inSafeZone = oxygen >= cfg.safeZoneMin && oxygen <= cfg.safeZoneMax;
      if (inSafeZone) state.breathMetrics.safeZoneTicks += dt;

      const agg = aggregateByRole(state.collectedMaterials, state.wetness);
      if (inSafeZone) {
        const growth =
          cfg.fireGrowthPerSecond *
          fireGrowthFactor(fire, agg) *
          fireGrowthWeatherMultiplier(state.weather, hasShelter, fire) *
          dt;
        fire = clamp(fire + growth, 0, 100);
      } else if (oxygen < 10) {
        fire = clamp(fire - cfg.starveShrinkPerSecond * 0.5 * dt, 0, 100);
      }

      if (oxygen > cfg.overblowThreshold) {
        if (overblowSince == null) overblowSince = t;
        const overDur = t - overblowSince;
        if (overDur >= cfg.overblowWarningMs) {
          if (!state.overblowWarning) state.overblowWarning = true;
          showWarning();
        }
        if (overDur >= cfg.overblowDangerMs) {
          fire = clamp(fire - cfg.extinguishShrinkPerSecond * dt, 0, 100);
          ctx.setFireVisual({ phase: 'smoke' });
          if (fire <= 0) {
            state.breathMetrics.extinguishCount += 1;
            fire = cfg.emberRestartFire + (hasFood ? GAME_CONFIG.equipment.food.reigniteEmberBonus : 0);
            oxygen = 0;
            overblowSince = null;
            state.overblowWarning = false;
            hideWarning();
            extinguishFlash = true;
          }
        }
      } else {
        overblowSince = null;
        state.overblowWarning = false;
        hideWarning();
      }

      state.fire = fire;
      state.oxygen = oxygen;

      fireValueEl.textContent = `${Math.round(fire)}%`;
      oxygenFill.style.width = `${oxygen}%`;
      oxygenFill.classList.toggle('warn', oxygen > cfg.overblowThreshold);
      oxygenValue.textContent = `${Math.round(oxygen)}%`;

      if (state.weather !== lastRenderedWeather) {
        lastRenderedWeather = state.weather;
        weatherChipEl.innerHTML = weatherChipHtml(state.weather);
      }

      if (extinguishFlash) {
        fireValueEl.style.color = 'var(--danger)';
        setTimeout(() => (fireValueEl.style.color = ''), 400);
        extinguishFlash = false;
      }

      ctx.setFireVisual({ phase: fire >= 8 ? 'burning' : 'ember', fire });
      ctx.setAmbient(fire);

      if (fire >= 100) {
        finished = true;
        state.fire = 100;
        state.finishTime = Date.now();
        if (navigator.vibrate) navigator.vibrate([40, 30, 90]);
        cleanup();
        store.set({ screen: 'result' });
        return;
      }
    }

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  function cleanup() {
    cancelAnimationFrame(raf);
    stopTimer();
    hideWarning();
    blowBtn.removeEventListener('pointerdown', onDown);
    blowBtn.removeEventListener('pointerup', onUp);
    blowBtn.removeEventListener('pointercancel', onUp);
    blowBtn.removeEventListener('pointerleave', onUp);
  }

  return cleanup;
}
