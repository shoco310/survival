import { store } from '../state';
import { startTimerDisplay, weatherChipHtml, clamp } from '../ui';
import { GAME_CONFIG } from '../config';
import { aggregateByRole, rotateIgnitionFactor, breathGrowthFactor } from '../materials';
import { rotateWeatherMultiplier, fireGrowthWeatherMultiplier, passiveFireWeatherDecay } from '../weather';
import type { Material, MaterialRole } from '../types';
import type { ScreenContext, Unmount } from './context';

type LocalPhase = 'rotate' | 'breath' | 'fuel';

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
  let overblowSince: number | null = null;
  let finished = false;
  let angularSpeedEma = 0;
  let lastMoveT = performance.now();
  let lastAngle = 0;
  let pointerActive = false;
  state.rotateMetrics.startedAt = Date.now();
  state.firePhase = 'rotate';

  // fuel tray = kindling/fuel materials not yet dropped into the fire this session
  const fuelTray: Material[] = state.collectedMaterials.filter((m) => m.role !== 'tinder');

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

      <div class="fuel-tray" id="fuel-tray" style="display:none;"></div>

      <div class="out-of-fuel" id="out-of-fuel" style="display:none;">
        <p>燃料が足りない！</p>
        <button class="btn btn-secondary" id="find-more-btn">🔦 薪を探しに走る</button>
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
  const fuelTrayEl = root.querySelector<HTMLElement>('#fuel-tray')!;
  const outOfFuelEl = root.querySelector<HTMLElement>('#out-of-fuel')!;
  const findMoreBtn = root.querySelector<HTMLButtonElement>('#find-more-btn')!;
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
      fuel: { rMin: 120, rMax: 165 },
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
        el.style.transition = 'opacity .4s ease';
        el.style.opacity = '0';
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
    fuelTrayEl.style.display = 'none';
    outOfFuelEl.style.display = 'none';
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
    fuelTrayEl.style.display = 'none';
    outOfFuelEl.style.display = 'none';
    showBanner('🔥 火種ができた！そっと息を吹きかけよう', 1600, 'そっと息を吹きかけよう');
  }

  function renderFuelTray(): void {
    fuelTrayEl.innerHTML = fuelTray
      .map(
        (m, i) => `<button class="fuel-chip" data-idx="${i}" style="touch-action:none;">
          <span class="emoji">${m.emoji}</span><span class="label">${m.label}</span>
        </button>`,
      )
      .join('');
  }

  function enterFuelPhase(): void {
    phase = 'fuel';
    state.firePhase = 'fuel';
    fuelTrayEl.style.display = '';
    renderFuelTray();
    showBanner('🪵 炎がついた！薪をくべろ', 1800, '素材を炎へドラッグしよう');
    if (fuelTray.length === 0) {
      showOutOfFuel();
    }
  }

  function showOutOfFuel(): void {
    outOfFuelEl.style.display = '';
  }

  const onFindMore = () => {
    outOfFuelEl.style.display = 'none';
    showBanner('浜辺を走って追加の枝を探してきた…', 1400, '素材を炎へドラッグしよう');
    const pool = GAME_CONFIG.materials.pool.filter((m) => m.role !== 'tinder');
    for (let i = 0; i < GAME_CONFIG.fuel.topUpCount; i++) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      fuelTray.push(pick);
      state.collectedMaterials.push(pick);
    }
    renderFuelTray();
  };
  findMoreBtn.addEventListener('click', onFindMore);

  // ---------- fuel drag & drop ----------
  let dragEl: HTMLElement | null = null;
  let dragIdx = -1;
  let dragStartX = 0;
  let dragStartY = 0;

  const onFuelPointerDown = (e: PointerEvent) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.fuel-chip');
    if (!chip || phase !== 'fuel') return;
    dragEl = chip;
    dragIdx = Number(chip.dataset.idx);
    const rect = chip.getBoundingClientRect();
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    chip.style.position = 'fixed';
    chip.style.left = `${rect.left}px`;
    chip.style.top = `${rect.top}px`;
    chip.style.width = `${rect.width}px`;
    chip.style.zIndex = '40';
    chip.classList.add('dragging');
    chip.setPointerCapture(e.pointerId);
  };
  const onFuelPointerMove = (e: PointerEvent) => {
    if (!dragEl) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    dragEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
  };
  const onFuelPointerUp = (e: PointerEvent) => {
    if (!dragEl) return;
    const chip = dragEl;
    const r = radiusAt(e.clientX, e.clientY);
    const dropped = r <= GAME_CONFIG.fuel.dropZoneRadius;
    if (dropped) {
      const material = fuelTray[dragIdx];
      chip.style.transition = 'opacity .3s ease, transform .3s ease';
      chip.style.transform += ' scale(0.2)';
      chip.style.opacity = '0';
      setTimeout(() => chip.remove(), 300);
      fuelTray.splice(dragIdx, 1);
      renderFuelTrayIndices();
      applyFuelDrop(material);
    } else {
      chip.style.transition = 'transform .25s ease';
      chip.style.transform = 'translate(0,0)';
      setTimeout(() => {
        chip.style.position = '';
        chip.style.left = '';
        chip.style.top = '';
        chip.style.width = '';
        chip.style.zIndex = '';
        chip.style.transform = '';
        chip.classList.remove('dragging');
      }, 260);
    }
    dragEl = null;
    dragIdx = -1;
  };
  function renderFuelTrayIndices(): void {
    // re-render remaining chips so data-idx stays in sync (dragged one already removed from array)
    renderFuelTray();
    if (fuelTray.length === 0 && phase === 'fuel' && fire < 100) {
      showOutOfFuel();
    }
  }
  fuelTrayEl.addEventListener('pointerdown', onFuelPointerDown);
  window.addEventListener('pointermove', onFuelPointerMove);
  window.addEventListener('pointerup', onFuelPointerUp);

  function applyFuelDrop(material: Material): void {
    const cfg = GAME_CONFIG.fuel;
    const idealForKindling = fire < cfg.idealSwitchFire;
    const goodTiming = material.role === 'kindling' ? idealForKindling : !idealForKindling || fire >= cfg.idealSwitchFire * 0.7;
    const qualityFactor = material.quality / 100;
    if (goodTiming) {
      fire = clamp(fire + cfg.baseBoost * (0.5 + 0.5 * qualityFactor), 0, 100);
      ctx.setFireVisual({ phase: 'burning', fire });
    } else {
      fire = clamp(fire - cfg.wrongTimingPenalty * (1 - 0.3 * qualityFactor), 0, 100);
      state.fuelMistakes += 1;
      showBanner('もくもく…煙が増えた', 1200, '素材を炎へドラッグしよう');
    }
    state.fuelLog.push({ id: material.id, role: material.role, goodTiming });
    state.fire = fire;
    fireFill.style.width = `${fire}%`;
  }

  // ---------- main loop: rotate heat / breath+fuel fire dynamics ----------
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
      // breath + fuel share the same oxygen/fire simulation; fuel phase adds drag-drop boosts
      fire = state.fire;
      oxygen = state.oxygen;

      oxygen = clamp(
        oxygen + (holding ? GAME_CONFIG.breath.blowRatePerSecond : -GAME_CONFIG.breath.releaseDecayPerSecond) * dt,
        0,
        100,
      );
      state.breathMetrics.totalTicks += dt;
      const inSafeZone = oxygen >= GAME_CONFIG.breath.safeZoneMin && oxygen <= GAME_CONFIG.breath.safeZoneMax;
      if (inSafeZone) state.breathMetrics.safeZoneTicks += dt;

      const agg = aggregateByRole(state.collectedMaterials, state.wetness);
      if (inSafeZone) {
        const scale = phase === 'fuel' ? 0.22 : 1;
        const growth =
          GAME_CONFIG.breath.fireGrowthPerSecond *
          breathGrowthFactor(agg) *
          fireGrowthWeatherMultiplier(state.weather, hasShelter, fire) *
          scale *
          dt;
        fire = clamp(fire + growth, 0, 100);
      } else if (oxygen < 10) {
        const decayRate =
          fire < GAME_CONFIG.ember.fragileFireThreshold
            ? GAME_CONFIG.ember.neglectDecayPerSecond
            : GAME_CONFIG.breath.starveShrinkPerSecond * 0.5;
        fire = clamp(fire - decayRate * dt, 0, 100);
      }

      // 天候の直接効果
      fire = clamp(fire - passiveFireWeatherDecay(state.weather, hasShelter) * dt, 0, 100);
      if (state.weather === 'wind' && fire > 0 && fire < GAME_CONFIG.weather.windWeakFireThreshold) {
        fire = clamp(fire - GAME_CONFIG.weather.windWeakFireShrinkPerSecond * dt, 0, 100);
      }

      let extinguishFlash = false;
      if (oxygen > GAME_CONFIG.breath.overblowThreshold) {
        const now = t;
        if (overblowSince == null) overblowSince = now;
        const overDur = now - overblowSince;
        if (overDur >= GAME_CONFIG.breath.overblowWarningMs) {
          state.overblowWarning = true;
          showOverblowWarning();
        }
        if (overDur >= GAME_CONFIG.breath.overblowDangerMs) {
          fire = clamp(fire - GAME_CONFIG.breath.extinguishShrinkPerSecond * dt, 0, 100);
          if (fire <= 0) {
            state.breathMetrics.extinguishCount += 1;
            fire = GAME_CONFIG.breath.emberRestartFire + (hasFood ? GAME_CONFIG.equipment.food.reigniteEmberBonus : 0);
            oxygen = 0;
            overblowSince = null;
            state.overblowWarning = false;
            hideOverblowWarning();
            extinguishFlash = true;
          }
        }
      } else {
        overblowSince = null;
        state.overblowWarning = false;
        hideOverblowWarning();
      }

      // 火種の段階での完全放置消火 → 摩擦フェーズへ後戻り
      if (phase === 'breath' && fire <= 0) {
        state.rotateResetCount += 1;
        heat = GAME_CONFIG.ember.resetHeat;
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
      oxygenFill.classList.toggle('warn', oxygen > GAME_CONFIG.breath.overblowThreshold);
      fireFill.style.width = `${fire}%`;
      if (extinguishFlash) {
        fireFill.classList.add('flash');
        setTimeout(() => fireFill.classList.remove('flash'), 400);
      }

      ctx.setFireVisual({ phase: fire >= 8 ? 'burning' : 'ember', fire });
      ctx.setAmbient(fire);

      if (phase === 'breath' && fire >= GAME_CONFIG.fuel.phaseThreshold) {
        enterFuelPhase();
      }

      if (fire >= 100) {
        finished = true;
        state.fire = 100;
        state.finishTime = Date.now();
        if (navigator.vibrate) navigator.vibrate([50, 40, 30, 40, 160]);
        cleanup();
        store.set({ screen: 'result' });
        return;
      }
    }

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  let warningToastEl: HTMLElement | null = null;
  function showOverblowWarning(): void {
    if (warningToastEl) return;
    warningToastEl = document.createElement('div');
    warningToastEl.className = 'warning-toast';
    warningToastEl.textContent = '吹きすぎ！';
    root.querySelector('.firepit-screen')!.appendChild(warningToastEl);
  }
  function hideOverblowWarning(): void {
    warningToastEl?.remove();
    warningToastEl = null;
  }

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
    hideOverblowWarning();
    window.removeEventListener('resize', renderStageMaterials);
    root.removeEventListener('pointerdown', onRotateDown);
    root.removeEventListener('pointermove', onRotateMove);
    root.removeEventListener('pointerup', onRotateUp);
    root.removeEventListener('pointercancel', onRotateUp);
    blowBtn.removeEventListener('pointerdown', onBlowDown);
    blowBtn.removeEventListener('pointerup', onBlowUp);
    blowBtn.removeEventListener('pointercancel', onBlowUp);
    blowBtn.removeEventListener('pointerleave', onBlowUp);
    fuelTrayEl.removeEventListener('pointerdown', onFuelPointerDown);
    window.removeEventListener('pointermove', onFuelPointerMove);
    window.removeEventListener('pointerup', onFuelPointerUp);
    findMoreBtn.removeEventListener('click', onFindMore);
  }

  return cleanup;
}
