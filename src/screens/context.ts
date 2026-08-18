import type { FireCanvas, FireVisualState } from '../fireCanvas';

export interface ScreenContext {
  fireCanvas: FireCanvas;
  setAmbient: (fire: number) => void;
  setFireVisual: (state: Partial<FireVisualState>) => void;
}

export type Unmount = () => void;
