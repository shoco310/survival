import type { GameState } from './types';
import { rollWeather } from './weather';

type Listener = () => void;

function createInitialState(): GameState {
  return {
    screen: 'start',
    debug: new URLSearchParams(location.search).get('debug') === 'true',

    equipment: null,
    weather: rollWeather(),

    materialsPool: [],
    collectedMaterials: [],

    startTime: null,
    finishTime: null,

    heat: 0,
    fire: 0,
    oxygen: 0,
    sparked: false,

    frictionMetrics: { startedAt: 0, finishedAt: null, decayEvents: 0 },
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
