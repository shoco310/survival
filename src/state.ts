import type { GameState } from './types';
import { buildWeatherTimeline, rollWeather } from './weather';

type Listener = () => void;

function createInitialState(): GameState {
  const weather = rollWeather();
  return {
    screen: 'start',
    debug: new URLSearchParams(location.search).get('debug') === 'true',

    equipment: null,
    weather,
    weatherTimeline: buildWeatherTimeline(weather),
    weatherEventIndex: 0,

    gustNextAt: Infinity,
    gustUntil: 0,
    lightningNextAt: Infinity,
    lightningUntil: 0,
    wetness: 0,

    materialsPool: [],
    collectedMaterials: [],

    startTime: null,
    finishTime: null,

    firePhase: 'rotate',
    heat: 0,
    emberPower: 0,
    fire: 0,
    oxygen: 0,
    sparked: false,

    rotateResetCount: 0,
    fuelLog: [],
    fuelMistakes: 0,

    rotateMetrics: { startedAt: 0, finishedAt: null },
    breathMetrics: { totalTicks: 0, safeZoneTicks: 0, extinguishCount: 0 },

    overblowWarning: false,
  };
}

class Store {
  state: GameState = createInitialState();
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  set(patch: Partial<GameState>): void {
    Object.assign(this.state, patch);
    this.notify();
  }

  reset(): void {
    this.state = createInitialState();
    this.notify();
  }
}

export const store = new Store();
