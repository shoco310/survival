import { store } from './state';
import { GAME_CONFIG } from './config';
import { computeAmbientIntensity, WEATHER_TRANSITION_TOAST } from './weather';
import type { FireCanvas } from './fireCanvas';
import { clamp } from './ui';
import type { GameState } from './types';

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

interface EnvironmentEls {
  night: HTMLElement;
  lightning: HTMLElement;
  toast: HTMLElement;
  trees: HTMLElement[];
}

/**
 * 画面遷移をまたいで常時動き続ける「環境」担当。
 * 天候タイムラインの進行、突風/雷、湿度の蓄積、夜の暗さ、木々の揺れ、
 * 中央トースト表示を一括で管理する。各画面はfire/phaseだけを扱えばよい。
 */
export class EnvironmentTicker {
  private raf = 0;
  private lastT = performance.now();
  private toastQueue: string[] = [];
  private toastBusy = false;
  private treePhases: number[];
  private fireCanvas: FireCanvas;
  private els: EnvironmentEls;

  constructor(fireCanvas: FireCanvas, els: EnvironmentEls) {
    this.fireCanvas = fireCanvas;
    this.els = els;
    this.treePhases = this.els.trees.map(() => Math.random() * Math.PI * 2);
  }

  start(): void {
    this.lastT = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(48, t - this.lastT);
      this.lastT = t;
      this.tick(dt, t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private tick(dtMs: number, now: number): void {
    const state = store.state;
    const active =
      (state.screen === 'gather' || state.screen === 'friction' || state.screen === 'breath') &&
      state.startTime != null &&
      state.finishTime == null;

    if (!active) {
      this.fireCanvas.setState({ windAmp: 0.15, rainAmp: 0 });
      this.updateTrees(0.15, now);
      this.els.night.style.opacity = '0.05';
      return;
    }

    const elapsedSeconds = (now - state.startTime!) / 1000;

    this.advanceWeather(state, elapsedSeconds);
    this.accumulateWetness(state, dtMs);
    this.tickGust(state, elapsedSeconds);
    this.tickLightning(state, elapsedSeconds);

    const upcoming = state.weatherTimeline[state.weatherEventIndex] ?? null;
    const ambient = computeAmbientIntensity(state.weather, upcoming, elapsedSeconds);
    this.fireCanvas.setState({ windAmp: ambient.wind, rainAmp: ambient.rain });
    this.updateTrees(ambient.wind, now);

    this.els.night.style.opacity = String(this.computeDarkness(elapsedSeconds, state.weather));
  }

  private advanceWeather(state: GameState, elapsedSeconds: number): void {
    const upcoming = state.weatherTimeline[state.weatherEventIndex];
    if (!upcoming || elapsedSeconds < upcoming.atSeconds) return;
    state.weather = upcoming.next;
    state.weatherEventIndex += 1;
    state.gustNextAt = Infinity;
    state.lightningNextAt = Infinity;
    this.showToast(WEATHER_TRANSITION_TOAST[upcoming.next]);
  }

  private accumulateWetness(state: GameState, dtMs: number): void {
    const cfg = GAME_CONFIG.wetness;
    let gain = 0;
    if (state.weather === 'rain') gain = cfg.gainPerSecondRain;
    else if (state.weather === 'storm') gain = cfg.gainPerSecondStorm;
    else gain = -cfg.dryPerSecond;

    if (gain > 0 && state.equipment === 'shelter') {
      gain *= 1 - GAME_CONFIG.weather.shelterMitigation;
    }
    state.wetness = clamp(state.wetness + gain * (dtMs / 1000), 0, cfg.max);
  }

  private tickGust(state: GameState, elapsedSeconds: number): void {
    const cfg = GAME_CONFIG.gust;
    if (state.weather !== 'wind') {
      state.gustNextAt = Infinity;
      return;
    }
    if (state.gustNextAt === Infinity) {
      state.gustNextAt = elapsedSeconds + rand(cfg.minIntervalSeconds, cfg.maxIntervalSeconds);
      return;
    }
    if (elapsedSeconds >= state.gustNextAt) {
      this.triggerGust(state);
      state.gustNextAt = elapsedSeconds + rand(cfg.minIntervalSeconds, cfg.maxIntervalSeconds);
    }
  }

  private triggerGust(state: GameState): void {
    const cfg = GAME_CONFIG.gust;
    this.showToast('💨 突風！');
    state.oxygen = clamp(state.oxygen + cfg.oxygenSpike, 0, 100);
    if (state.fire > 0 && state.fire < cfg.weakFireThreshold) {
      state.fire = clamp(state.fire - cfg.weakFireShrink, 0, 100);
    } else if (state.fire >= cfg.strongFireBoostThreshold) {
      state.fire = clamp(state.fire + cfg.strongFireBoost, 0, 100);
    }
  }

  private tickLightning(state: GameState, elapsedSeconds: number): void {
    const cfg = GAME_CONFIG.lightning;
    if (state.weather !== 'storm') {
      state.lightningNextAt = Infinity;
      return;
    }
    if (state.lightningNextAt === Infinity) {
      state.lightningNextAt = elapsedSeconds + rand(cfg.minIntervalSeconds, cfg.maxIntervalSeconds);
      return;
    }
    if (elapsedSeconds >= state.lightningNextAt) {
      this.triggerLightning();
      state.lightningNextAt = elapsedSeconds + rand(cfg.minIntervalSeconds, cfg.maxIntervalSeconds);
    }
  }

  private triggerLightning(): void {
    const el = this.els.lightning;
    el.style.transition = 'none';
    el.style.opacity = '0.85';
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${GAME_CONFIG.lightning.flashMs}ms ease-out`;
      el.style.opacity = '0';
    });
  }

  private updateTrees(windAmp: number, now: number): void {
    this.els.trees.forEach((tree, i) => {
      const phase = this.treePhases[i];
      const angle = Math.sin((now / 1000) * (1.1 + i * 0.15) + phase) * (2 + windAmp * 7);
      tree.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    });
  }

  private computeDarkness(elapsedSeconds: number, weather: GameState['weather']): number {
    const bps = GAME_CONFIG.nightCycle.breakpoints;
    let d: number = bps[0].darkness;
    if (elapsedSeconds >= bps[bps.length - 1].atSeconds) {
      d = bps[bps.length - 1].darkness;
    } else {
      for (let i = 0; i < bps.length - 1; i++) {
        const a = bps[i];
        const b = bps[i + 1];
        if (elapsedSeconds >= a.atSeconds && elapsedSeconds <= b.atSeconds) {
          const p = (elapsedSeconds - a.atSeconds) / (b.atSeconds - a.atSeconds);
          d = a.darkness + (b.darkness - a.darkness) * p;
          break;
        }
      }
    }
    if (weather === 'rain') d += GAME_CONFIG.nightCycle.rainExtraDarkness;
    if (weather === 'storm') d += GAME_CONFIG.nightCycle.stormExtraDarkness;
    return Math.min(GAME_CONFIG.nightCycle.maxDarkness, d);
  }

  private showToast(text: string): void {
    this.toastQueue.push(text);
    this.processToastQueue();
  }

  private processToastQueue(): void {
    if (this.toastBusy || this.toastQueue.length === 0) return;
    this.toastBusy = true;
    const text = this.toastQueue.shift()!;
    const el = this.els.toast;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => {
        this.toastBusy = false;
        this.processToastQueue();
      }, 300);
    }, GAME_CONFIG.weatherDynamics.toastDurationMs);
  }
}
