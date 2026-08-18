import { store } from '../state';
import { startTimerDisplay, weatherChipHtml, clamp } from '../ui';
import { GAME_CONFIG } from '../config';
import { aggregateByRole, rotateIgnitionFactor, fireGrowthFactor } from '../materials';
import { rotateWeatherMultiplier, fireGrowthWeatherMultiplier, passiveFireWeatherDecay } from '../weather';
import type { MaterialRole } from '../types';
import type { ScreenContext, Unmount } from './context';

type LocalPhase = 'rotate' | 'breath';

export function mountFirepit(root: HTMLElement, ctx: ScreenContext): Unmount {
  const state = store.state;
  const hasFireKit = state.equipment === 'fire';
  const hasFood = state.equipment === 'food';
  const hasShelter = state.equipment === 'shelter';

  let phase: LocalPhase = 'rotate';
  let heat = hasFireKit ? GAME_CONFIG.equipment.fire.startingHeat : 0;
  let fire = 0;
  let oxygen = 0;
  let holding = false;
  let finished = false;
  let angularSpeedEma = 0;
  let lastMoveT = performance.now();
  let lastAngle = 0;
  let pointerActive = false;
  state.rotateMetrics.startedAt = Date.now();
  state.firePhase = 'rotate';

  root.innerHTML = `
    <div class="screen firepit-screen">
      <div class="hud">
        <span id="weather-chip">${weatherChipHtml(state.weather)}</span>
        <span class="timer" id="fp-timer">00:00.00</span>
      </div>
      <div class="phase-banner" id="phase-banner">木の周りを指でぐるぐる回して摩擦熱を上げよう</div>

      <div class="stage-zone" id="stage-zone">
        <div class="stage-materials" id="stage-materials"></div>
      </div>

      <div class="mini-gauges" id="mini-gauges">
        <div class="mini-gauge"><span class="mg-label">摩擦</span><div class="mini-track"><div class="mini-fill heat" id="heat-fill"></div></div></div>
        <div class="mini-gauge"><span class="mg-label">酸素</span><div class="mini-track"><div class="mini-fill oxygen" id="oxygen-fill"></div></div></div>
        <div class="mini-gauge"><span class="mg-label">火力</span><div class="mini-track"><div class="mini-fill fire" id="fire-fill"></div></div></div>
      </div>

      <div class="firepit-controls">
        <button class="blow-btn" id="blow-btn" style="display:none;">🌬️ 長押しして息を吹く</button>
      </div>
    </div>
  `;

  const stopTimer = state.startTime ? startTimerDisplay(root.querySelector('#fp-timer')!, state.startTime) : () => {};

  const phaseBanner = root.querySelector<HTMLElement>('#phase-banner')!;
  const stageMaterials = root.querySelector<HTMLElement>('#stage-materials')!;
  const heatFill = root.querySelector<HTMLElement>('#heat-fill')!;
  const oxygenFill = root.querySelector<HTMLElement>('#oxygen-fill')!;
  const fireFill = root.querySelector<HTMLElement>('#fire-fill')!;
  const blowBtn = root.querySelector<HTMLButtonElement>('#blow-btn')!;
  const weatherChipEl = root.querySelector<HTMLElement>('#weather-chip')!;
  let lastRenderedWeather = state.weather;

  function center(): { x: number; y: number } {
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.86 };
  }

  // ---------- PHASE 1 scenery: selected materials scattered near the drill ----------
  function renderStageMaterials(): void {
    const c = center();
    const zones: Record<MaterialRole, { rMin: number; rMax: number }> = {
      tinder: { rMin: 26, rMax: 58 },
      kindling: { rMin: 64, rMax: 104 },
      fuel: { rMin: 110, rMax: 150 },
    };
    stageMaterials.innerHTML = state.collectedMaterials
      .map((m, i) => {
        const zone = zones[m.role];
        const angle = (i / state.collectedMaterials.length) * Math.PI * 2 + Math.random() * 0.6;
        const r = zone.rMin + Math.random() * (zone.rMax - zone.rMin);
        const dx = Math.cos(angle) * r;
        const dy = Math.sin(angle) * r * 0.55; // flatten vertically for a ground-level look
        // keep decorative materials from drifting into the phase banner or the mini-gauge row
        const top = clamp(c.y + dy, 130, window.innerHeight - 76);
        return `<span class="stage-material" data-role="${m.role}" style="left:${c.x + dx}px; top:${top}px;">${m.emoji}</span>`;
      })
      .join('');
  }
  renderStageMaterials();
  window.addEventListener('resize', renderStageMaterials);

  function fadeOutTinder(): void {
    stageMaterials.querySelectorAll<HTMLElement>('.stage-material').forEach((el) => {
      if (el.dataset.role === 'tinder') {
        el.style.transition = 'opacity .6s ease, transform .6s ease';
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-50%) scale(0.4)';
      } else {
        el.style.transition = 'opacity 1.2s ease';
        el.style.opacity = '0.55';
      }
    });
  }

  // ---------- rotate gesture ----------
  const R = GAME_CONFIG.rotate;

  function angleAt(clientX: number, clientY: number): number {
    const c = center();
    return Math.atan2(clientY - c.y, clientX - c.x);
  }
  function radiusAt(clientX: number, clientY: number): number {
    const c = center();
    return Math.hypot(clientX - c.x, clientY - c.y);
  }

  const onRotateDown = (e: PointerEvent) => {
    if (phase !== 'rotate') return;
    const r = radiusAt(e.clientX, e.clientY);
    if (r < R.minRadius || r > R.maxRadius) return;
    pointerActive = true;
    lastAngle = angleAt(e.clientX, e.clientY);
    lastMoveT = performance.now();
    root.setPointerCapture(e.pointerId);
  };
  const onRotateMove = (e: PointerEvent) => {
    if (phase !== 'rotate' || !pointerActive) return;
    const r = radiusAt(e.clientX, e.clientY);
    if (r < R.minRadius * 0.5) return;
    const now = performance.now();
    const dt = Math.max(0.001, (now - lastMoveT) / 1000);
    const angle = angleAt(e.clientX, e.clientY);
    let delta = angle - lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    lastAngle = angle;
    lastMoveT = now;
    const instantSpeed = Math.abs(delta) / dt;
    angularSpeedEma = angularSpeedEma * 0.72 + instantSpeed * 0.28;
  };
  const onRotateUp = () => {
    pointerActive = false;
  };
  // stage-zone's own box doesn't reliably reach the fixed 86vh interaction point
  // (its height depends on document flow), so listen on the full screen-root instead
  root.addEventListener('pointerdown', onRotateDown);
  root.addEventListener('pointermove', onRotateMove);
  root.addEventListener('pointerup', onRotateUp);
  root.addEventListener('pointercancel', onRotateUp);

  function showBanner(text: string, durationMs?: number, revertTo?: string): void {
    phaseBanner.textContent = text;
    phaseBanner.classList.add('pulse');
    setTimeout(() => phaseBanner.classList.remove('pulse'), 400);
    if (durationMs != null) {
      setTimeout(() => {
        phaseBanner.textContent = revertTo ?? phaseBanner.textContent;
      }, durationMs);
    }
  }

  function enterRotatePhase(afterReset: boolean): void {
    phase = 'rotate';
    state.firePhase = 'rotate';
    blowBtn.style.display = 'none';
    ctx.setFireVisual({ phase: 'rotate', fire: 0, spinSpeed: 0, frictionHeat: heat });
    ctx.setAmbient(0);
    if (afterReset) {
      showBanner('火が消えた…もう一度回そう', 1800, '木の周りを指でぐるぐる回して摩擦熱を上げよう');
    } else {
      phaseBanner.textContent = '木の周りを指でぐるぐる回して摩擦熱を上げよう';
    }
  }

  function enterBreathPhase(): void {
    phase = 'breath';
    state.firePhase = 'breath';
    blowBtn.style.display = '';
    showBanner('🔥 火種ができた！そっと息を吹きかけよう', 1600, '長押しで息を吹いて炎を育てよう');
  }

  // ---------- main loop: rotate heat / breath fire dynamics ----------
  let raf = 0;
  let lastT = performance.now();

  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    if (finished) {
      raf = requestAnimationFrame(loop);
      return;
    }

    if (state.weather !== lastRenderedWeather) {
      lastRenderedWeather = state.weather;
      weatherChipEl.innerHTML = weatherChipHtml(state.weather);
    }

    if (phase === 'rotate') {
      const idleFor = performance.now() - lastMoveT;
      if (idleFor > 220) angularSpeedEma *= 0.9;
      const effectiveSpeed = clamp(angularSpeedEma, 0, R.maxAngularSpeed);

      const agg = aggregateByRole(state.collectedMaterials, state.wetness);
      const ignition = rotateIgnitionFactor(agg);
      const weatherMul = rotateWeatherMultiplier(state.weather, hasShelter);
      const fireKitMul = hasFireKit ? R.fireKitHeatMultiplier : 1;

      if (effectiveSpeed > R.minAngularSpeed) {
        heat = clamp(heat + R.heatGainPerRadPerSecond * effectiveSpeed * ignition * weatherMul * fireKitMul * dt, 0, 100);
      } else {
        heat = clamp(heat - R.decayPerSecond * dt, 0, 100);
      }
      state.heat = heat;
      heatFill.style.width = `${heat}%`;

      const spinNorm = clamp(effectiveSpeed / R.maxAngularSpeed, 0, 1);
      ctx.setFireVisual({ phase: 'rotate', spinSpeed: spinNorm, frictionHeat: heat });

      if (heat >= 100) {
        const emberAgg = aggregateByRole(state.collectedMaterials, state.wetness);
        const qualityFactor = emberAgg.tinder.quality / 100;
        fire = clamp(
          GAME_CONFIG.ember.initialPowerBase + GAME_CONFIG.ember.initialPowerVariance * qualityFactor,
          20,
          45,
        );
        oxygen = 0;
        state.sparked = true;
        state.fire = fire;
        state.oxygen = oxygen;
        state.rotateMetrics.finishedAt = state.rotateMetrics.finishedAt ?? Date.now();
        fadeOutTinder();
        enterBreathPhase();
      }
    } else {
      fire = state.fire;
      oxygen = state.oxygen;

      const B = GAME_CONFIG.breath;
      oxygen = clamp(oxygen + (holding ? B.blowRatePerSecond : -B.releaseDecayPerSecond) * dt, 0, 100);

      // 酸素量に応じた成長効率のゆるやかな山（最適値から離れても最低ラインは保証される）
      const distance = Math.abs(oxygen - B.optimalOxygen) / B.bellWidth;
      const efficiency = clamp(1 - distance, B.minGrowthMultiplier, 1);

      state.breathMetrics.totalTicks += dt;
      state.breathMetrics.safeZoneTicks += efficiency * dt;

      const agg = aggregateByRole(state.collectedMaterials, state.wetness);
      if (oxygen >= B.neglectOxygenThreshold) {
        const growth =
          B.fireGrowthPerSecond *
          fireGrowthFactor(fire, agg) *
          fireGrowthWeatherMultiplier(state.weather, hasShelter, fire) *
          efficiency *
          dt;
        fire = clamp(fire + growth, 0, 100);
      } else {
        // 完全に息を止めている（放置している）ときだけ、ゆっくり火力が落ちる
        const decayRate = fire < GAME_CONFIG.ember.fragileFireThreshold ? GAME_CONFIG.ember.neglectDecayPerSecond : B.starveShrinkPerSecond;
        fire = clamp(fire - decayRate * dt, 0, 100);
      }

      // 100%に届いた時点で即成功とする（この後の天候減衰でまた99%台に押し戻され、
      // 判定を取りこぼし続けるのを防ぐ）
      if (fire >= 100) {
        finished = true;
        state.fire = 100;
        state.oxygen = oxygen;
        state.finishTime = Date.now();
        if (navigator.vibrate) navigator.vibrate([50, 40, 30, 40, 160]);
        ctx.setFireVisual({ phase: 'burning', fire: 100 });
        ctx.setAmbient(100);
        cleanup();
        store.set({ screen: 'result' });
        return;
      }

      // 天候の直接効果（吹きすぎとは無関係に、悪天候そのものが炎を弱らせる）
      fire = clamp(fire - passiveFireWeatherDecay(state.weather, hasShelter) * dt, 0, 100);
      if (state.weather === 'wind' && fire > 0 && fire < GAME_CONFIG.weather.windWeakFireThreshold) {
        fire = clamp(fire - GAME_CONFIG.weather.windWeakFireShrinkPerSecond * dt, 0, 100);
      }

      // 火種の段階で完全に消えてしまった → 摩擦フェーズへ後戻り
      if (fire <= 0) {
        state.rotateResetCount += 1;
        heat = GAME_CONFIG.ember.resetHeat + (hasFood ? GAME_CONFIG.equipment.food.resetRecoveryBonus : 0);
        state.heat = heat;
        fire = 0;
        oxygen = 0;
        state.fire = 0;
        state.oxygen = 0;
        enterRotatePhase(true);
        raf = requestAnimationFrame(loop);
        return;
      }

      state.fire = fire;
      state.oxygen = oxygen;
      oxygenFill.style.width = `${oxygen}%`;
      fireFill.style.width = `${fire}%`;

      ctx.setFireVisual({ phase: fire >= 8 ? 'burning' : 'ember', fire });
      ctx.setAmbient(fire);
    }

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const onBlowDown = (e: PointerEvent) => {
    holding = true;
    blowBtn.setPointerCapture(e.pointerId);
  };
  const onBlowUp = () => {
    holding = false;
  };
  blowBtn.addEventListener('pointerdown', onBlowDown);
  blowBtn.addEventListener('pointerup', onBlowUp);
  blowBtn.addEventListener('pointercancel', onBlowUp);
  blowBtn.addEventListener('pointerleave', onBlowUp);

  function cleanup(): void {
    cancelAnimationFrame(raf);
    stopTimer();
    window.removeEventListener('resize', renderStageMaterials);
    root.removeEventListener('pointerdown', onRotateDown);
    root.removeEventListener('pointermove', onRotateMove);
    root.removeEventListener('pointerup', onRotateUp);
    root.removeEventListener('pointercancel', onRotateUp);
    blowBtn.removeEventListener('pointerdown', onBlowDown);
    blowBtn.removeEventListener('pointerup', onBlowUp);
    blowBtn.removeEventListener('pointercancel', onBlowUp);
    blowBtn.removeEventListener('pointerleave', onBlowUp);
  }

  return cleanup;
}
