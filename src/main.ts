import './style.css';
import { store } from './state';
import { FireCanvas, type FireVisualState } from './fireCanvas';
import { clamp } from './ui';
import { mountStart } from './screens/start';
import { mountGather } from './screens/gather';
import { mountFriction } from './screens/friction';
import { mountBreath } from './screens/breath';
import { mountResult } from './screens/result';
import { mountDebugPanel } from './screens/debug';
import type { ScreenContext, Unmount } from './screens/context';
import type { Screen } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <canvas id="fire-canvas"></canvas>
  <div id="warm-overlay"></div>
  <div id="screen-root"></div>
`;

const canvasEl = app.querySelector<HTMLCanvasElement>('#fire-canvas')!;
const warmOverlay = app.querySelector<HTMLDivElement>('#warm-overlay')!;
const screenRoot = app.querySelector<HTMLDivElement>('#screen-root')!;

const fireCanvas = new FireCanvas(canvasEl);
fireCanvas.start();

const ctx: ScreenContext = {
  fireCanvas,
  setAmbient: (fire: number) => {
    warmOverlay.style.opacity = String(clamp(fire / 100, 0, 1) * 0.9);
  },
  setFireVisual: (partial: Partial<FireVisualState>) => fireCanvas.setState(partial),
};

const mounts: Record<Screen, (root: HTMLElement, ctx: ScreenContext) => Unmount> = {
  start: mountStart,
  gather: mountGather,
  friction: mountFriction,
  breath: mountBreath,
  result: mountResult,
};

let currentUnmount: Unmount | null = null;
let currentScreen: Screen | null = null;

function render(): void {
  if (store.state.screen === currentScreen) return;
  currentUnmount?.();
  currentScreen = store.state.screen;
  currentUnmount = mounts[currentScreen](screenRoot, ctx);
}

store.subscribe(render);
render();

if (store.state.debug) {
  app.classList.add('has-debug');
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  app.appendChild(panel);
  mountDebugPanel(panel);
}
