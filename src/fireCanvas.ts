import type { WeatherId } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: 'flame' | 'smoke' | 'spark' | 'rain' | 'droplet';
  hue: number;
}

export interface FireVisualState {
  fire: number; // 0-100
  phase: 'idle' | 'smoke' | 'ember' | 'burning';
  weather: WeatherId;
  windy: boolean;
  raining: boolean;
}

const MAX_PARTICLES = 260;

export class FireCanvas {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private raf = 0;
  private lastT = 0;
  private w = 0;
  private h = 0;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private state: FireVisualState = { fire: 0, phase: 'idle', weather: 'sunny', windy: false, raining: false };
  private windPhase = 0;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setState(next: Partial<FireVisualState>): void {
    this.state = { ...this.state, ...next };
  }

  start(): void {
    this.lastT = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(48, t - this.lastT);
      this.lastT = t;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private baseX(): number {
    return this.w / 2;
  }
  private baseY(): number {
    return this.h * 0.86;
  }

  private update(dtMs: number): void {
    const dt = dtMs / 1000;
    const { fire, phase, windy, raining } = this.state;
    this.windPhase += dt;
    const windStrength = windy ? 1 : 0.25;
    const windDrift = Math.sin(this.windPhase * 1.3) * windStrength * 40;

    if (this.particles.length < MAX_PARTICLES) {
      if (phase === 'burning') {
        const emitCount = Math.round(1 + (fire / 100) * 6);
        for (let i = 0; i < emitCount; i++) this.emitFlame(fire, windDrift);
        if (Math.random() < 0.4 + fire / 200) this.emitSpark(fire, windDrift);
        if (Math.random() < 0.25) this.emitSmoke(fire, windDrift);
      } else if (phase === 'ember') {
        if (Math.random() < 0.7) this.emitSmoke(10, windDrift);
      } else if (phase === 'smoke') {
        if (Math.random() < 0.9) this.emitSmoke(5, windDrift);
      }

      if (raining && this.particles.length < MAX_PARTICLES) {
        const rainCount = this.state.weather === 'storm' ? 5 : 2;
        for (let i = 0; i < rainCount; i++) this.emitRain(windDrift);
      }
    }

    for (const p of this.particles) {
      p.life -= dtMs;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'flame' || p.kind === 'smoke' || p.kind === 'spark') {
        p.vx += windDrift * dt * 0.6;
        p.vy -= (p.kind === 'smoke' ? 8 : 20) * dt;
      }
      if (p.kind === 'rain') {
        p.vx = windDrift * 1.5;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y > -40 && p.y < this.h + 40);
  }

  private emitFlame(fire: number, windDrift: number): void {
    const spread = 10 + fire * 0.25;
    this.particles.push({
      x: this.baseX() + (Math.random() - 0.5) * spread,
      y: this.baseY() + Math.random() * 6,
      vx: windDrift * 0.4 + (Math.random() - 0.5) * 20,
      vy: -(60 + fire * 1.6 + Math.random() * 40),
      life: 380 + Math.random() * 260,
      maxLife: 600,
      size: 6 + Math.random() * (6 + fire * 0.12),
      kind: 'flame',
      hue: 18 + Math.random() * 40,
    });
  }

  private emitSpark(fire: number, windDrift: number): void {
    this.particles.push({
      x: this.baseX() + (Math.random() - 0.5) * (20 + fire * 0.3),
      y: this.baseY() - fire * 0.6,
      vx: windDrift + (Math.random() - 0.5) * 60,
      vy: -(120 + Math.random() * 140),
      life: 500 + Math.random() * 400,
      maxLife: 900,
      size: 1.5 + Math.random() * 1.8,
      kind: 'spark',
      hue: 40 + Math.random() * 20,
    });
  }

  private emitSmoke(fire: number, windDrift: number): void {
    this.particles.push({
      x: this.baseX() + (Math.random() - 0.5) * 24,
      y: this.baseY() - fire * 0.8 - Math.random() * 10,
      vx: windDrift * 0.8 + (Math.random() - 0.5) * 14,
      vy: -(30 + Math.random() * 30),
      life: 1400 + Math.random() * 900,
      maxLife: 2300,
      size: 10 + Math.random() * 16,
      kind: 'smoke',
      hue: 0,
    });
  }

  private emitRain(windDrift: number): void {
    this.particles.push({
      x: Math.random() * this.w,
      y: -10,
      vx: windDrift * 1.5,
      vy: 420 + Math.random() * 160,
      life: 1200,
      maxLife: 1200,
      size: 1,
      kind: 'rain',
      hue: 0,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    // ember glow at base
    if (this.state.phase !== 'idle' && this.state.fire >= 0) {
      const glowSize = 16 + this.state.fire * 0.9;
      const grad = ctx.createRadialGradient(
        this.baseX(),
        this.baseY(),
        0,
        this.baseX(),
        this.baseY(),
        glowSize,
      );
      const glowAlpha = this.state.phase === 'burning' ? 0.55 : 0.35;
      grad.addColorStop(0, `rgba(255,140,60,${glowAlpha})`);
      grad.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.baseX(), this.baseY(), glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.particles) {
      const lifeRatio = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = lifeRatio;
      if (p.kind === 'flame') {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `hsla(${p.hue + 25}, 100%, 75%, ${0.9 * lifeRatio})`);
        grad.addColorStop(0.5, `hsla(${p.hue}, 100%, 55%, ${0.75 * lifeRatio})`);
        grad.addColorStop(1, `hsla(${p.hue - 10}, 100%, 40%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${lifeRatio})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(180,175,170,${0.28 * lifeRatio})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'rain') {
        ctx.strokeStyle = `rgba(180,210,255,${0.5 * lifeRatio})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - 14);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
