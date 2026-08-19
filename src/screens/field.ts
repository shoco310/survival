import { store } from '../state';
import { clamp, FIRE_STAGE_Y_RATIO } from '../ui';
import { GAME_CONFIG } from '../config';
import { audioEngine } from '../audio';
import { formatClock } from '../scoring';
import {
  pickMaterialsForRound,
  requiredPickCount,
  aggregateByRole,
  rotateIgnitionFactor,
  fireGrowthFactor,
} from '../materials';
import { rotateWeatherMultiplier, fireGrowthWeatherMultiplier, passiveFireWeatherDecay, WEATHER_HUD_TEXT } from '../weather';
import { EQUIPMENT_META } from '../equipment';
import { materialIconHtml } from '../materialIcons';
import type { EquipmentId, Material, MaterialRole } from '../types';
import type { ScreenContext, Unmount } from './context';

/** 日没までの経過割合(0-1)から、ゲージの色（青白→黄→オレンジ→赤）を補間する */
const SUNSET_GAUGE_STOPS: [number, string][] = [
  [0, '#bfe4ff'],
  [0.3, '#ffe066'],
  [0.6, '#ff9d3d'],
  [0.9, '#ff4d4d'],
];
function sunsetGaugeColor(ratio: number): string {
  const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < SUNSET_GAUGE_STOPS.length - 1; i++) {
    const [aRatio, aHex] = SUNSET_GAUGE_STOPS[i];
    const [bRatio, bHex] = SUNSET_GAUGE_STOPS[i + 1];
    if (ratio >= aRatio && ratio <= bRatio) {
      const p = (ratio - aRatio) / (bRatio - aRatio);
      const [ar, ag, ab] = hexToRgb(aHex);
      const [br, bg, bb] = hexToRgb(bHex);
      const r = Math.round(ar + (br - ar) * p);
      const g = Math.round(ag + (bg - ag) * p);
      const b = Math.round(ab + (bb - ab) * p);
      return `rgb(${r},${g},${b})`;
    }
  }
  return SUNSET_GAUGE_STOPS[SUNSET_GAUGE_STOPS.length - 1][1];
}

type Phase = 'intro' | 'item_selection' | 'gathering' | 'rotate' | 'breath';

const TUTORIAL_SEEN_KEY = 'survival-tutorial-seen';

export function mountField(root: HTMLElement, ctx: ScreenContext): Unmount {
  const state = store.state;

  // --- run bootstrap: the sunset clock starts the moment we enter the field ---
  const now = Date.now();
  state.startTime = now;
  state.sunsetAt = now + GAME_CONFIG.sunset.budgetSeconds * 1000;
  state.fieldPhase = 'item_selection';

  let phase: Phase = 'intro';
  let hasFireKit = false;
  let hasFood = false;
  let hasShelter = false;

  root.innerHTML = `
    <div class="screen field-screen">
      <div class="field-hud">
        <div class="hud-row hud-row-top">
          <span class="field-clock" id="field-clock">--:--</span>
          <span class="field-sunset" id="field-sunset">日没まで --:--</span>
          <button class="mute-btn" id="mute-btn">🔊</button>
        </div>
        <div class="sunset-gauge-track"><div class="sunset-gauge-fill" id="sunset-gauge-fill"></div></div>
        <div class="hud-row hud-row-mid">
          <span class="weather-hud" id="weather-hud"></span>
          <span class="fire-state-hud" id="fire-state-hud"></span>
        </div>
        <div class="heat-gauge-track"><div class="heat-gauge-fill" id="heat-gauge-fill"></div></div>
        <div class="stamina-row">
          <span class="stamina-label">♥ スタミナ</span>
          <div class="field-stamina-track" id="stamina-track">
            <div class="field-stamina-fill" id="stamina-fill"></div>
          </div>
        </div>
      </div>

      <div class="intro-banner" id="intro-banner"></div>
      <div class="field-banner" id="field-banner"></div>

      <div class="field-stage" id="field-stage">
        <div class="ground-items" id="ground-items"></div>
        <div class="stage-materials" id="stage-materials"></div>
        <div class="pick-progress" id="pick-progress" style="display:none;"><b id="pick-count">0</b> / <span id="pick-target"></span></div>
      </div>

      <div class="kindling-tray" id="kindling-tray" style="display:none;"></div>

      <div class="field-controls">
        <button class="blow-btn" id="blow-btn" style="display:none;">🌬️ 長押しして息を吹く</button>
      </div>
    </div>
  `;

  const clockEl = root.querySelector<HTMLElement>('#field-clock')!;
  const sunsetEl = root.querySelector<HTMLElement>('#field-sunset')!;
  const sunsetGaugeFill = root.querySelector<HTMLElement>('#sunset-gauge-fill')!;
  const weatherHudEl = root.querySelector<HTMLElement>('#weather-hud')!;
  const fireStateHudEl = root.querySelector<HTMLElement>('#fire-state-hud')!;
  const heatGaugeFill = root.querySelector<HTMLElement>('#heat-gauge-fill')!;
  const muteBtn = root.querySelector<HTMLButtonElement>('#mute-btn')!;
  const staminaFill = root.querySelector<HTMLElement>('#stamina-fill')!;
  const fieldScreenEl = root.querySelector<HTMLElement>('.field-screen')!;
  const introBanner = root.querySelector<HTMLElement>('#intro-banner')!;
  const fieldBanner = root.querySelector<HTMLElement>('#field-banner')!;
  const groundItems = root.querySelector<HTMLElement>('#ground-items')!;
  const stageMaterials = root.querySelector<HTMLElement>('#stage-materials')!;
  const pickProgress = root.querySelector<HTMLElement>('#pick-progress')!;
  const pickCountEl = root.querySelector<HTMLElement>('#pick-count')!;
  const pickTargetEl = root.querySelector<HTMLElement>('#pick-target')!;
  const kindlingTray = root.querySelector<HTMLElement>('#kindling-tray')!;
  const blowBtn = root.querySelector<HTMLButtonElement>('#blow-btn')!;

  muteBtn.textContent = audioEngine.isMuted() ? '🔇' : '🔊';
  const onMute = () => {
    audioEngine.setMuted(!audioEngine.isMuted());
    muteBtn.textContent = audioEngine.isMuted() ? '🔇' : '🔊';
  };
  muteBtn.addEventListener('click', onMute);

  function center(): { x: number; y: number } {
    return { x: window.innerWidth / 2, y: window.innerHeight * FIRE_STAGE_Y_RATIO };
  }

  function showBanner(text: string, durationMs?: number, revertTo?: string): void {
    fieldBanner.textContent = text;
    fieldBanner.classList.add('pulse');
    setTimeout(() => fieldBanner.classList.remove('pulse'), 400);
    if (durationMs != null) {
      setTimeout(() => {
        fieldBanner.textContent = revertTo ?? fieldBanner.textContent;
      }, durationMs);
    }
  }

  function showTutorial(text: string): void {
    if (localStorage.getItem(TUTORIAL_SEEN_KEY + ':' + text)) return;
    const el = document.createElement('div');
    el.className = 'tutorial-hint';
    el.textContent = text;
    root.querySelector('.field-screen')!.appendChild(el);
    localStorage.setItem(TUTORIAL_SEEN_KEY + ':' + text, '1');
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    }, 2600);
  }

  // ================= INTRO SEQUENCE =================
  function playIntro(onDone: () => void): void {
    const beats: [string, number][] = [
      ['1日目', 700],
      [
        `${String(GAME_CONFIG.sunset.startClockHour).padStart(2, '0')}:${String(GAME_CONFIG.sunset.startClockMinute).padStart(2, '0')}`,
        700,
      ],
      [`日没まで ${formatClock(GAME_CONFIG.sunset.budgetSeconds)}`, 1100],
      ['日没までに火を起こせ', 1300],
    ];
    let i = 0;
    const next = () => {
      if (i >= beats.length) {
        introBanner.style.opacity = '0';
        onDone();
        return;
      }
      const [text, ms] = beats[i];
      introBanner.textContent = text;
      introBanner.style.opacity = '1';
      i++;
      setTimeout(next, ms);
    };
    next();
  }

  // ================= ITEM SELECTION =================
  const EQUIPMENT_DESC: Record<EquipmentId, string> = {
    fire: '摩擦効率が上がり、火種が長持ちする',
    food: 'スタミナの減りが遅くなる',
    shelter: '雨・風の影響を大きく軽減する',
  };

  function enterItemSelection(): void {
    phase = 'item_selection';
    showBanner('遭難時、1つだけ持ち出せた…');
    groundItems.innerHTML = (['fire', 'food', 'shelter'] as EquipmentId[])
      .map(
        (id) => `
        <button class="ground-item" data-id="${id}">
          <span class="gi-emoji">${EQUIPMENT_META[id].emoji}</span>
          <span class="gi-label">${EQUIPMENT_META[id].label}</span>
        </button>`,
      )
      .join('');
    showTutorial('タップして持ち物を選ぼう');

    const onPick = (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.ground-item');
      if (!btn) return;
      groundItems.removeEventListener('click', onPick);
      const id = btn.dataset.id as EquipmentId;
      state.equipment = id;
      hasFireKit = id === 'fire';
      hasFood = id === 'food';
      hasShelter = id === 'shelter';
      btn.classList.add('chosen');
      audioEngine.playBlip('pick');
      showBanner(`${EQUIPMENT_META[id].emoji} ${EQUIPMENT_META[id].label} を持った — ${EQUIPMENT_DESC[id]}`);
      setTimeout(() => {
        groundItems.innerHTML = '';
        enterGathering();
      }, 900);
    };
    groundItems.addEventListener('click', onPick);
  }

  // ================= GATHERING =================
  function enterGathering(): void {
    phase = 'gathering';
    state.fieldPhase = 'gathering';
    state.materialsPool = pickMaterialsForRound();
    state.collectedMaterials = [];
    const target = requiredPickCount();
    const collected: Material[] = [];

    showBanner('燃えそうな素材を集めよう');
    showTutorial('タップして集めよう');
    pickProgress.style.display = '';
    pickTargetEl.textContent = String(target);
    pickCountEl.textContent = '0';

    const scatter = layoutScatter(state.materialsPool);
    stageMaterials.innerHTML = scatter
      .map(
        (item) => `
      <button class="material-item" data-id="${item.material.id}"
        style="left:${item.left}%; top:${item.top}%; transform: translate(-50%,-50%) rotate(${item.rotation}deg);">
        ${materialIconHtml(item.material)}
      </button>`,
      )
      .join('');

    const onPick = (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.material-item');
      if (!btn || btn.classList.contains('picked')) return;
      const id = btn.dataset.id!;
      const material = state.materialsPool.find((m) => m.id === id);
      if (!material) return;

      btn.classList.add('picked');
      collected.push(material);
      pickCountEl.textContent = String(collected.length);

      if (material.quality >= 55) {
        audioEngine.playBlip('snap-dry');
        showBanner('パキッ！良さそうな手触りだ', 900);
      } else {
        audioEngine.playBlip('snap-wet');
        showBanner('グニャ…あまり良くなさそうだ', 900);
      }

      if (collected.length >= target) {
        stageMaterials.removeEventListener('click', onPick);
        state.collectedMaterials = collected;
        setTimeout(() => {
          pickProgress.style.display = 'none';
          enterRotate();
        }, 500);
      }
    };
    stageMaterials.addEventListener('click', onPick);
  }

  function layoutScatter(materials: Material[]) {
    const columns = 3;
    const rows = Math.ceil(materials.length / columns);
    const cellW = 100 / columns;
    const cellH = 70 / rows;
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
      const left = clamp(col * cellW + cellW / 2 + jitterX, 8, 92);
      const top = clamp(14 + row * cellH + cellH / 2 + jitterY, 10, 78);
      const rotation = Math.round((Math.random() - 0.5) * 32);
      return { material, left, top, rotation };
    });
  }

  // ================= STAGE SCENERY (materials near the drill) =================
  function renderStageScenery(): void {
    const c = center();
    const stageScale = clamp(Math.min(window.innerWidth, window.innerHeight) / 720, 0.85, 1.6);
    const zones: Record<MaterialRole, { rMin: number; rMax: number }> = {
      tinder: { rMin: 46 * stageScale, rMax: 88 * stageScale },
      kindling: { rMin: 96 * stageScale, rMax: 138 * stageScale },
      fuel: { rMin: 144 * stageScale, rMax: 192 * stageScale },
    };
    stageMaterials.innerHTML = state.collectedMaterials
      .map((m, i) => {
        const zone = zones[m.role];
        const angle = (i / state.collectedMaterials.length) * Math.PI * 2 + Math.random() * 0.6;
        const r = zone.rMin + Math.random() * (zone.rMax - zone.rMin);
        const dx = Math.cos(angle) * r;
        const dy = Math.sin(angle) * r * 0.55;
        const top = clamp(c.y + dy, 130, window.innerHeight - 76);
        return `<span class="stage-material" data-role="${m.role}" style="left:${c.x + dx}px; top:${top}px;">${materialIconHtml(m)}</span>`;
      })
      .join('');
  }

  function fadeOutTinder(): void {
    stageMaterials.querySelectorAll<HTMLElement>('.stage-material').forEach((el) => {
      if (el.dataset.role === 'tinder') {
        el.style.transition = 'opacity .6s ease, transform .6s ease';
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-50%) scale(0.4)';
      } else {
        el.style.transition = 'opacity 1.2s ease';
        el.style.opacity = '0.5';
      }
    });
  }

  window.addEventListener('resize', renderStageScenery);

  // ================= ROTATE (friction) =================
  const R = GAME_CONFIG.rotate;
  let heat = 0;
  let angularSpeedEma = 0;
  let lastMoveT = performance.now();
  let lastAngle = 0;
  let pointerActive = false;

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
    const t = performance.now();
    const dt = Math.max(0.001, (t - lastMoveT) / 1000);
    const angle = angleAt(e.clientX, e.clientY);
    let delta = angle - lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    lastAngle = angle;
    lastMoveT = t;
    const instantSpeed = Math.abs(delta) / dt;
    angularSpeedEma = angularSpeedEma * 0.72 + instantSpeed * 0.28;
  };
  const onRotateUp = () => {
    pointerActive = false;
  };
  root.addEventListener('pointerdown', onRotateDown);
  root.addEventListener('pointermove', onRotateMove);
  root.addEventListener('pointerup', onRotateUp);
  root.addEventListener('pointercancel', onRotateUp);

  function enterRotate(afterReset = false): void {
    phase = 'rotate';
    state.fieldPhase = 'rotate';
    blowBtn.style.display = 'none';
    kindlingTray.style.display = 'none';
    renderStageScenery();
    ctx.setFireVisual({ phase: 'rotate', fire: 0, spinSpeed: 0, frictionHeat: heat });
    ctx.setAmbient(0);
    if (afterReset) {
      showBanner('火種が消えた…もう一度回そう', 1800, '木の周りを指でぐるぐる回そう');
      audioEngine.playBlip('fail');
    } else {
      state.rotateMetrics.startedAt = Date.now();
      showBanner('木の周りを指（PCはマウス）でぐるぐる回そう');
      showTutorial('指でぐるぐる回して摩擦を起こそう');
    }
  }

  // ================= BREATH (ember -> campfire) =================
  let fire = 0;
  let oxygen = 0;
  let holding = false;
  let firstFlameShown = false;
  let campfireShown = false;
  let peakFireSeen = 0;
  let distressShown = false;
  let overblowHoldSeconds = 0;
  let overblowWarnShown = false;

  function enterBreath(): void {
    phase = 'breath';
    state.fieldPhase = 'breath';
    blowBtn.style.display = '';
    firstFlameShown = fire >= 8;
    campfireShown = fire >= 90;
    showBanner('🔥 火種ができた！', 1600, '長押しで息を吹きかけよう');
    showTutorial('長押しして息を吹こう');
    audioEngine.playBlip('ember');
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function renderKindlingTray(): void {
    const items = state.collectedMaterials.filter((m) => m.role !== 'tinder');
    if (items.length === 0) {
      kindlingTray.style.display = 'none';
      return;
    }
    kindlingTray.style.display = '';
    kindlingTray.innerHTML = items
      .map(
        (m, i) => `<button class="kindling-chip" data-idx="${i}" data-used="0">
          ${materialIconHtml(m)}
        </button>`,
      )
      .join('');
  }

  let kindlingDragEl: HTMLElement | null = null;
  let kindlingDragMaterial: Material | null = null;
  let kindlingDragStartX = 0;
  let kindlingDragStartY = 0;

  const onKindlingDown = (e: PointerEvent) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.kindling-chip');
    if (!chip || chip.dataset.used === '1') return;
    const idx = Number(chip.dataset.idx);
    const items = state.collectedMaterials.filter((m) => m.role !== 'tinder');
    kindlingDragMaterial = items[idx] ?? null;
    if (!kindlingDragMaterial) return;
    kindlingDragEl = chip;
    const rect = chip.getBoundingClientRect();
    kindlingDragStartX = e.clientX;
    kindlingDragStartY = e.clientY;
    chip.style.position = 'fixed';
    chip.style.left = `${rect.left}px`;
    chip.style.top = `${rect.top}px`;
    chip.style.zIndex = '40';
    chip.setPointerCapture(e.pointerId);
  };
  const onKindlingMove = (e: PointerEvent) => {
    if (!kindlingDragEl) return;
    const dx = e.clientX - kindlingDragStartX;
    const dy = e.clientY - kindlingDragStartY;
    kindlingDragEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.1)`;
  };
  const onKindlingUp = (e: PointerEvent) => {
    if (!kindlingDragEl || !kindlingDragMaterial) return;
    const chip = kindlingDragEl;
    const r = radiusAt(e.clientX, e.clientY);
    const dropped = r <= GAME_CONFIG.kindling.dropZoneRadius;
    if (dropped) {
      applyKindlingDrop(kindlingDragMaterial);
      chip.dataset.used = '1';
      chip.style.transition = 'opacity .3s ease, transform .3s ease';
      chip.style.transform += ' scale(0.2)';
      chip.style.opacity = '0';
      setTimeout(() => chip.remove(), 300);
    } else {
      chip.style.transition = 'transform .25s ease';
      chip.style.transform = 'translate(0,0)';
      setTimeout(() => {
        chip.style.position = '';
        chip.style.left = '';
        chip.style.top = '';
        chip.style.zIndex = '';
        chip.style.transform = '';
      }, 260);
    }
    kindlingDragEl = null;
    kindlingDragMaterial = null;
  };
  kindlingTray.addEventListener('pointerdown', onKindlingDown);
  window.addEventListener('pointermove', onKindlingMove);
  window.addEventListener('pointerup', onKindlingUp);

  function applyKindlingDrop(material: Material): void {
    const cfg = GAME_CONFIG.kindling;
    const idealForKindling = fire < cfg.idealSwitchFire;
    const goodTiming = material.role === 'kindling' ? idealForKindling : !idealForKindling || fire >= cfg.idealSwitchFire * 0.6;
    if (goodTiming) {
      fire = clamp(fire + cfg.goodBoost, 0, 100);
      ctx.fireCanvas.pulseKindling(true);
      audioEngine.playBlip('whoosh');
      if (navigator.vibrate) navigator.vibrate(25);
      const text = material.role === 'kindling' ? '細い枝をくべた！炎が少し育った' : '太い枝をくべた！炎が大きく育った';
      showBanner(text, 1100);
    } else {
      fire = clamp(fire - cfg.badPenalty, 0, 100);
      ctx.fireCanvas.pulseKindling(false);
      const text = material.role === 'fuel' ? '太すぎた…もくもくと煙が増えた' : 'まだ早い…もくもくと煙が増えた';
      showBanner(text, 1100);
    }
    state.kindlingLog.push({ id: material.id, goodTiming });
    state.fire = fire;
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
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && phase === 'breath') {
      e.preventDefault();
      holding = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') holding = false;
  });

  // ================= MAIN LOOP =================
  let raf = 0;
  let lastT = performance.now();
  let finished = false;
  let staminaVal = 100;

  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    if (!finished) {
      if (phase === 'rotate') tickRotate(dt, t);
      else tickStamina(dt, false);
      if (phase === 'breath') tickBreath(dt, t);
    }

    updateHud();

    raf = requestAnimationFrame(loop);
  };

  /** スタミナは摩擦フェーズだけでなく常時更新する（回転していなければ他フェーズでも回復する） */
  function tickStamina(dt: number, rotating: boolean): void {
    const ST = GAME_CONFIG.stamina;
    if (rotating) {
      const drain = ST.drainPerSecondWhileRotating * (hasFood ? ST.foodDrainMultiplier : 1);
      staminaVal = clamp(staminaVal - drain * dt, 0, 100);
    } else {
      staminaVal = clamp(staminaVal + ST.recoverPerSecondWhileIdle * dt, 0, 100);
    }
    state.stamina = staminaVal;
    audioEngine.setFatigue(staminaVal < 30 ? clamp(1 - staminaVal / 30, 0, 1) : 0);
  }

  function fireStateLabel(): { icon: string; text: string } {
    if (phase === 'rotate') return heat >= 55 ? { icon: '💨', text: '煙' } : { icon: '🪵', text: '摩擦' };
    if (phase !== 'breath') return { icon: '🪵', text: '摩擦' };
    if (fire < GAME_CONFIG.ember.fragileFireThreshold) return { icon: '✨', text: '火種' };
    if (fire < 65) return { icon: '🔥', text: '小さな炎' };
    return { icon: '🔥', text: '焚き火' };
  }

  function updateHud(): void {
    if (state.startTime == null || state.sunsetAt == null) return;
    const elapsed = (Date.now() - state.startTime) / 1000;
    const budget = GAME_CONFIG.sunset.budgetSeconds;
    const remaining = Math.max(0, budget - elapsed);
    const elapsedRatio = clamp(elapsed / budget, 0, 1);
    const clockMinutesTotal =
      GAME_CONFIG.sunset.startClockHour * 60 + GAME_CONFIG.sunset.startClockMinute + Math.floor(elapsed / 4);
    const hh = Math.floor(clockMinutesTotal / 60) % 24;
    const mm = clockMinutesTotal % 60;
    clockEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    sunsetEl.textContent = `日没まで ${formatClock(remaining)}`;
    sunsetEl.classList.toggle('warn', remaining <= GAME_CONFIG.sunset.warningSeconds);
    sunsetGaugeFill.style.width = `${remaining / budget * 100}%`;
    const gaugeColor = sunsetGaugeColor(elapsedRatio);
    sunsetGaugeFill.style.background = gaugeColor;
    sunsetGaugeFill.style.boxShadow = `0 0 8px ${gaugeColor}`;

    const w = WEATHER_HUD_TEXT[state.weather];
    weatherHudEl.textContent = `${w.icon} ${w.text}`;

    const fs = fireStateLabel();
    fireStateHudEl.textContent = `${fs.icon} ${fs.text}`;

    const gaugeVal = phase === 'rotate' ? heat : fire;
    heatGaugeFill.style.width = `${gaugeVal}%`;

    const ST = GAME_CONFIG.stamina;
    staminaFill.style.width = `${staminaVal}%`;
    staminaFill.classList.toggle('half', staminaVal <= 50);
    staminaFill.classList.toggle('low', staminaVal <= 30);
    staminaFill.classList.toggle('critical', staminaVal <= ST.tiredThreshold * 0.6);
    fieldScreenEl.classList.toggle('stamina-critical', staminaVal <= ST.tiredThreshold * 0.6);
  }

  function tickRotate(dt: number, _t: number): void {
    const idleFor = performance.now() - lastMoveT;
    if (idleFor > 220) angularSpeedEma *= 0.9;
    const effectiveSpeed = clamp(angularSpeedEma, 0, R.maxAngularSpeed);
    const rotating = effectiveSpeed > R.minAngularSpeed;

    const ST = GAME_CONFIG.stamina;
    tickStamina(dt, rotating);
    const staminaMultiplier = staminaVal < ST.tiredThreshold ? ST.exhaustedMultiplier + (staminaVal / ST.tiredThreshold) * (1 - ST.exhaustedMultiplier) : 1;

    const agg = aggregateByRole(state.collectedMaterials, state.wetness);
    const ignition = rotateIgnitionFactor(agg);
    const weatherMul = rotateWeatherMultiplier(state.weather, hasShelter);
    const fireKitMul = hasFireKit ? R.fireKitHeatMultiplier : 1;

    if (rotating) {
      heat = clamp(
        heat + R.heatGainPerRadPerSecond * effectiveSpeed * ignition * weatherMul * fireKitMul * staminaMultiplier * dt,
        0,
        100,
      );
    } else {
      heat = clamp(heat - R.decayPerSecond * dt, 0, 100);
    }
    state.heat = heat;

    const spinNorm = clamp(effectiveSpeed / R.maxAngularSpeed, 0, 1);
    ctx.setFireVisual({ phase: 'rotate', spinSpeed: spinNorm, frictionHeat: heat });

    if (heat >= 100) {
      const emberAgg = aggregateByRole(state.collectedMaterials, state.wetness);
      const qualityFactor = emberAgg.tinder.quality / 100;
      fire = clamp(GAME_CONFIG.ember.initialPowerBase + GAME_CONFIG.ember.initialPowerVariance * qualityFactor, 20, 45);
      oxygen = 0;
      state.sparked = true;
      state.fire = fire;
      state.oxygen = oxygen;
      state.rotateMetrics.finishedAt = state.rotateMetrics.finishedAt ?? Date.now();
      fadeOutTinder();
      renderKindlingTray();
      enterBreath();
    }
  }

  function tickBreath(dt: number, t: number): void {
    fire = state.fire;
    oxygen = state.oxygen;

    const B = GAME_CONFIG.breath;
    oxygen = clamp(oxygen + (holding ? B.blowRatePerSecond : -B.releaseDecayPerSecond) * dt, 0, 100);

    const distance = Math.abs(oxygen - B.optimalOxygen) / B.bellWidth;
    const efficiency = clamp(1 - distance, B.minGrowthMultiplier, 1);
    const breathJitter = clamp(distance, 0, 1);

    state.breathMetrics.totalTicks += dt;
    state.breathMetrics.safeZoneTicks += efficiency * dt;

    if (oxygen > B.optimalOxygen + B.bellWidth * 0.55) {
      overblowHoldSeconds += dt;
      if (!overblowWarnShown && overblowHoldSeconds > 1.4) {
        overblowWarnShown = true;
        showBanner('吹きすぎ！少し弱めよう', 1100);
      }
    } else {
      overblowHoldSeconds = 0;
      overblowWarnShown = false;
    }

    const agg = aggregateByRole(state.collectedMaterials, state.wetness);
    if (oxygen >= B.neglectOxygenThreshold) {
      const growth =
        B.fireGrowthPerSecond * fireGrowthFactor(fire, agg) * fireGrowthWeatherMultiplier(state.weather, hasShelter, fire) * efficiency * dt;
      fire = clamp(fire + growth, 0, 100);
    } else {
      const decayRate = fire < GAME_CONFIG.ember.fragileFireThreshold ? GAME_CONFIG.ember.neglectDecayPerSecond : B.starveShrinkPerSecond;
      fire = clamp(fire - decayRate * dt, 0, 100);
    }

    if (fire >= 100) {
      triggerSuccess();
      return;
    }

    fire = clamp(fire - passiveFireWeatherDecay(state.weather, hasShelter) * dt, 0, 100);
    if (state.weather === 'wind' && fire > 0 && fire < GAME_CONFIG.weather.windWeakFireThreshold) {
      fire = clamp(fire - GAME_CONFIG.weather.windWeakFireShrinkPerSecond * dt, 0, 100);
    }

    if (fire <= 0) {
      state.rotateResetCount += 1;
      heat = GAME_CONFIG.ember.resetHeat + (hasFood ? GAME_CONFIG.equipment.food.resetRecoveryBonus : 0);
      state.heat = heat;
      fire = 0;
      oxygen = 0;
      state.fire = 0;
      state.oxygen = 0;
      kindlingTray.style.display = 'none';
      enterRotate(true);
      return;
    }

    if (!firstFlameShown && fire >= 8) {
      firstFlameShown = true;
      showBanner('ボッ — 小さな炎がついた', 1400, '薪を炎へドラッグしてもいい');
      audioEngine.playBlip('whoosh');
      if (navigator.vibrate) navigator.vibrate([20, 20, 40]);
    }
    if (!campfireShown && fire >= 90) {
      campfireShown = true;
      showBanner('炎が大きく育ってきた…！', 1400);
    }
    peakFireSeen = Math.max(peakFireSeen, fire);
    if (!distressShown && peakFireSeen >= 25 && fire < peakFireSeen - 15 && fire < 20) {
      distressShown = true;
      showBanner('火が弱くなってきた…！', 1300);
      if (navigator.vibrate) navigator.vibrate(15);
    }
    if (fire >= GAME_CONFIG.kindling.unlocksAtFire) {
      kindlingTray.style.display = state.collectedMaterials.some((m) => m.role !== 'tinder') ? '' : 'none';
    }

    state.fire = fire;
    state.oxygen = oxygen;

    ctx.setFireVisual({ phase: fire >= 8 ? 'burning' : 'ember', fire, breathJitter });
    ctx.setAmbient(fire);
    audioEngine.setFireLevel(fire);
    void t;
  }

  function triggerSuccess(): void {
    finished = true;
    fire = 100;
    state.fire = 100;
    state.finishTime = Date.now();
    audioEngine.playBlip('success');
    audioEngine.setFireLevel(100);
    if (navigator.vibrate) navigator.vibrate([60, 40, 30, 40, 220]);
    ctx.setFireVisual({ phase: 'burning', fire: 100 });
    ctx.setAmbient(100);
    root.querySelector('.field-screen')!.classList.add('field-triumph');
    cleanup();
    setTimeout(() => store.set({ screen: 'result' }), 1400);
  }

  raf = requestAnimationFrame(loop);

  // kick off: intro -> item selection
  playIntro(() => enterItemSelection());

  function cleanup(): void {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', renderStageScenery);
    root.removeEventListener('pointerdown', onRotateDown);
    root.removeEventListener('pointermove', onRotateMove);
    root.removeEventListener('pointerup', onRotateUp);
    root.removeEventListener('pointercancel', onRotateUp);
    blowBtn.removeEventListener('pointerdown', onBlowDown);
    blowBtn.removeEventListener('pointerup', onBlowUp);
    blowBtn.removeEventListener('pointercancel', onBlowUp);
    blowBtn.removeEventListener('pointerleave', onBlowUp);
    kindlingTray.removeEventListener('pointerdown', onKindlingDown);
    window.removeEventListener('pointermove', onKindlingMove);
    window.removeEventListener('pointerup', onKindlingUp);
    muteBtn.removeEventListener('click', onMute);
  }

  return cleanup;
}
