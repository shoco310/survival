import './style.css';
import { store } from './state';
import { FireCanvas, type FireVisualState } from './fireCanvas';
import { EnvironmentTicker } from './environment';
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
  <div id="tree-layer">
    <div class="tree t1"></div>
    <div class="tree t2"></div>
    <div class="tree t3"></div>
    <div class="tree t4"></div>
  </div>
  <div id="night-overlay"></div>
  <div id="warm-overlay"></div>
  <div id="lightning-flash"></div>
  <div id="center-toast"></div>
  <div id="screen-root"></div>
`;

const canvasEl = app.querySelector<HTMLCanvasElement>('#fire-canvas')!;
const warmOverlay = app.querySelector<HTMLDivElement>('#warm-overlay')!;
const nightOverlay = app.querySelector<HTMLDivElement>('#night-overlay')!;
const lightningFlash = app.querySelector<HTMLDivElement>('#lightning-flash')!;
const centerToast = app.querySelector<HTMLDivElement>('#center-toast')!;
const treeEls = Array.from(app.querySelectorAll<HTMLDivElement>('.tree'));
const screenRoot = app.querySelector<HTMLDivElement>('#screen-root')!;

const fireCanvas = new FireCanvas(canvasEl);
fireCanvas.start();

const environment = new EnvironmentTicker(fireCanvas, {
  night: nightOverlay,
  lightning: lightningFlash,
  toast: centerToast,
  trees: treeEls,
});
environment.start();

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
