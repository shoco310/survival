import { FIRE_STAGE_Y_RATIO, clamp } from './ui';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: 'flame' | 'smoke' | 'spark' | 'rain' | 'leaf' | 'dust' | 'sizzle';
  hue: number;
  rotation: number;
  rotationSpeed: number;
}

export interface FireVisualState {
  fire: number; // 0-100
  phase: 'idle' | 'rotate' | 'ember' | 'burning';
  /** 木々の揺れ・砂埃の強さ 0(無風) 〜 約1.7(嵐) */
  windAmp: number;
  /** 雨粒の強さ 0(なし) 〜 約1.7(嵐) */
  rainAmp: number;
  /** 回転フェーズでの回転の勢い 0-1（木屑の発生量・棒の見た目の回転速度に反映） */
  spinSpeed: number;
  /** 回転フェーズでの摩擦熱 0-100（木屑→煙→火種の段階演出に使う） */
  frictionHeat: number;
  /** 息の強さが最適から外れている度合い 0(ぴったり)〜1(大きく外れ)。炎の揺れ・煙に反映 */
  breathJitter: number;
}

const MAX_PARTICLES = 340;

export class FireCanvas {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private raf = 0;
  private lastT = 0;
  private w = 0;
  private h = 0;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private state: FireVisualState = {
    fire: 0,
    phase: 'idle',
    windAmp: 0.15,
    rainAmp: 0,
    spinSpeed: 0,
    frictionHeat: 0,
    breathJitter: 0,
  };
  private windPhase = 0;
  private spinAngle = 0;
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

  /** 薪投入の瞬間演出。goodなら火の粉が一気に舞い、badなら煙がもくっと出る */
  pulseKindling(good: boolean): void {
    const windDrift = Math.sin(this.windPhase * 1.3) * this.state.windAmp * 40;
    if (good) {
      for (let i = 0; i < 14; i++) this.emitSpark(this.state.fire + 20, windDrift);
      for (let i = 0; i < 4; i++) this.emitFlame(this.state.fire + 30, windDrift);
    } else {
      for (let i = 0; i < 8; i++) this.emitSmoke(this.state.fire + 10, windDrift);
    }
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
    return this.h * FIRE_STAGE_Y_RATIO;
  }

  private update(dtMs: number): void {
    const dt = dtMs / 1000;
    const { fire, phase, windAmp, rainAmp, spinSpeed, frictionHeat, breathJitter } = this.state;
    this.windPhase += dt;
    const windDrift = Math.sin(this.windPhase * 1.3) * windAmp * 40;
    this.spinAngle += spinSpeed * dt * 22;

    if (this.particles.length < MAX_PARTICLES) {
      if (phase === 'burning') {
        const emitCount = Math.round(2 + (fire / 100) * 8);
        for (let i = 0; i < emitCount; i++) this.emitFlame(fire, windDrift, breathJitter);
        if (Math.random() < 0.4 + fire / 200) this.emitSpark(fire, windDrift);
        // 火が弱っているときほど煙が濃くなり、危機感を視覚的に伝える
        const struggleSmoke = fire < 35 ? (35 - fire) / 35 : 0;
        if (Math.random() < 0.25 + struggleSmoke * 0.5) this.emitSmoke(fire, windDrift);
        if (rainAmp > 0.3 && fire > 3 && Math.random() < rainAmp * 0.3) this.emitSizzle(fire);
      } else if (phase === 'ember') {
        if (Math.random() < 0.7) this.emitSmoke(10, windDrift);
      } else if (phase === 'rotate') {
        const dustChance = spinSpeed * 0.55 + Math.max(0, (frictionHeat - 15) / 100) * 0.35;
        if (spinSpeed > 0.1 && Math.random() < dustChance) this.emitDust(spinSpeed);
        const smokeChance = Math.max(0, (frictionHeat - 22) / 78);
        if (Math.random() < smokeChance * 0.6) this.emitSmoke(4, windDrift);
      }

      if (rainAmp > 0.05) {
        const rainCount = Math.round(2 + rainAmp * 3);
        for (let i = 0; i < rainCount; i++) this.emitRain(windDrift, rainAmp);
      }

      if (windAmp > 0.4 && Math.random() < windAmp * 0.35) {
        this.emitLeaf(windDrift);
      }
    }

    for (const p of this.particles) {
      p.life -= dtMs;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;
      if (p.kind === 'flame' || p.kind === 'smoke' || p.kind === 'spark' || p.kind === 'sizzle') {
        p.vx += windDrift * dt * 0.6;
        p.vy -= (p.kind === 'smoke' ? 8 : 20) * dt;
      }
      if (p.kind === 'rain') {
        p.vx = windDrift * 1.5;
      }
      if (p.kind === 'leaf') {
        p.vx += windDrift * dt * 0.8;
        p.vy += 26 * dt;
      }
      if (p.kind === 'dust') {
        p.vy += 40 * dt;
        p.vx *= 0.96;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y > -40 && p.y < this.h + 40);
  }

  private emitFlame(fire: number, windDrift: number, breathJitter = 0): void {
    const spread = 16 + fire * 0.42;
    const jitterKick = breathJitter * 60;
    this.particles.push({
      x: this.baseX() + (Math.random() - 0.5) * spread,
      y: this.baseY() + Math.random() * 6,
      vx: windDrift * 0.4 + (Math.random() - 0.5) * (24 + jitterKick),
      vy: -(78 + fire * 2.3 + Math.random() * 50) * (1 - breathJitter * 0.2),
      life: 420 + Math.random() * 300,
      maxLife: 660,
      size: 13 + Math.random() * (11 + fire * 0.26),
      kind: 'flame',
      hue: 18 + Math.random() * 40,
      rotation: 0,
      rotationSpeed: 0,
    });
  }

  private emitSpark(fire: number, windDrift: number): void {
    this.particles.push({
      x: this.baseX() + (Math.random() - 0.5) * (32 + fire * 0.46),
      y: this.baseY() - fire * 0.95,
      vx: windDrift + (Math.random() - 0.5) * 70,
      vy: -(140 + Math.random() * 160),
      life: 520 + Math.random() * 420,
      maxLife: 940,
      size: 2 + Math.random() * 2.2,
      kind: 'spark',
      hue: 40 + Math.random() * 20,
      rotation: 0,
      rotationSpeed: 0,
    });
  }

  private emitSmoke(fire: number, windDrift: number): void {
    this.particles.push({
      x: this.baseX() + (Math.random() - 0.5) * 30,
      y: this.baseY() - fire * 0.95 - Math.random() * 12,
      vx: windDrift * 0.8 + (Math.random() - 0.5) * 16,
      vy: -(34 + Math.random() * 34),
      life: 1400 + Math.random() * 900,
      maxLife: 2300,
      size: 13 + Math.random() * 20,
      kind: 'smoke',
      hue: 0,
      rotation: 0,
      rotationSpeed: 0,
    });
  }

  private emitRain(windDrift: number, rainAmp: number): void {
    this.particles.push({
      x: Math.random() * this.w,
      y: -10,
      vx: windDrift * 1.5,
      vy: 420 + Math.random() * 160 + rainAmp * 60,
      life: 1200,
      maxLife: 1200,
      size: 1,
      kind: 'rain',
      hue: 0,
      rotation: 0,
      rotationSpeed: 0,
    });
  }

  private emitLeaf(windDrift: number): void {
    this.particles.push({
      x: windDrift >= 0 ? -10 : this.w + 10,
      y: Math.random() * this.h * 0.7,
      vx: (windDrift >= 0 ? 1 : -1) * (60 + Math.random() * 60) + windDrift,
      vy: 10 + Math.random() * 20,
      life: 2200 + Math.random() * 1000,
      maxLife: 3200,
      size: 4 + Math.random() * 3,
      kind: 'leaf',
      hue: 30 + Math.random() * 50,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 6,
    });
  }

  private emitDust(spinSpeed: number): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 14;
    this.particles.push({
      x: this.baseX() + Math.cos(angle) * dist,
      y: this.baseY() - 6 + Math.sin(angle) * dist * 0.4,
      vx: (Math.random() - 0.5) * 30 * spinSpeed,
      vy: -(10 + Math.random() * 20 * spinSpeed),
      life: 260 + Math.random() * 220,
      maxLife: 480,
      size: 1.5 + Math.random() * 2,
      kind: 'dust',
      hue: 32,
      rotation: 0,
      rotationSpeed: 0,
    });
  }

  private emitSizzle(fire: number): void {
    this.particles.push({
      x: this.baseX() + (Math.random() - 0.5) * (16 + fire * 0.2),
      y: this.baseY() - fire * 0.5,
      vx: (Math.random() - 0.5) * 40,
      vy: -(40 + Math.random() * 30),
      life: 180 + Math.random() * 120,
      maxLife: 300,
      size: 2 + Math.random() * 2,
      kind: 'sizzle',
      hue: 0,
      rotation: 0,
      rotationSpeed: 0,
    });
  }

  /** 摩擦フェーズの木の棒・火起こし台のスケール。画面の主役になるよう画面サイズに応じて拡大する */
  private rigScale(): number {
    return clamp(Math.min(this.w, this.h) / 640, 0.9, 1.85);
  }

  private renderRotateRig(): void {
    const ctx = this.ctx;
    const bx = this.baseX();
    const by = this.baseY();
    const scale = this.rigScale();
    const heat = this.state.frictionHeat;

    // ground board
    ctx.fillStyle = 'rgba(60,42,26,0.9)';
    ctx.beginPath();
    ctx.ellipse(bx, by, 148 * scale, 32 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,28,16,0.7)';
    ctx.beginPath();
    ctx.ellipse(bx, by, 98 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // spinning rod (barber-pole stripes suggest rotation around its own axis)
    const rodW = 27 * scale;
    const rodH = 220 * scale;
    const rodTop = by - rodH - 10 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx - rodW / 2, rodTop, rodW, rodH, rodW / 2);
    ctx.clip();
    ctx.fillStyle = '#6b4526';
    ctx.fillRect(bx - rodW / 2, rodTop, rodW, rodH);

    // 木目：縦に揺らいだ薄い筋を数本
    ctx.strokeStyle = 'rgba(40,24,10,0.28)';
    ctx.lineWidth = 1.4 * scale;
    for (let g = 0; g < 4; g++) {
      const gx = bx - rodW / 2 + rodW * (0.18 + g * 0.22);
      ctx.beginPath();
      ctx.moveTo(gx, rodTop);
      for (let y = 0; y <= rodH; y += 18 * scale) {
        ctx.lineTo(gx + Math.sin(y * 0.05 + g) * 2.2 * scale, rodTop + y);
      }
      ctx.stroke();
    }

    // barber-pole stripes (rotation cue)
    const stripeCount = 8;
    ctx.strokeStyle = 'rgba(255,220,180,0.32)';
    ctx.lineWidth = 6 * scale;
    for (let i = -1; i < stripeCount + 1; i++) {
      const phase = ((this.spinAngle + i * 22) % (rodH + 22)) - 11;
      ctx.beginPath();
      ctx.moveTo(bx - rodW, rodTop + phase);
      ctx.lineTo(bx + rodW, rodTop + phase + 14);
      ctx.stroke();
    }

    // 摩擦で先端(板に接する側)が黒ずんでいく
    if (heat > 5) {
      const scorchH = rodH * (0.14 + Math.min(1, heat / 100) * 0.22);
      const scorch = ctx.createLinearGradient(0, rodTop + rodH - scorchH, 0, rodTop + rodH);
      scorch.addColorStop(0, 'rgba(20,10,4,0)');
      scorch.addColorStop(1, `rgba(15,7,3,${Math.min(0.85, heat / 100 + 0.15)})`);
      ctx.fillStyle = scorch;
      ctx.fillRect(bx - rodW / 2, rodTop + rodH - scorchH, rodW, scorchH);
    }
    ctx.restore();

    if (this.state.spinSpeed > 0.05) {
      // motion blur hint at high speed
      ctx.globalAlpha = Math.min(0.4, this.state.spinSpeed * 0.3);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.ellipse(bx, rodTop + 8 * scale, rodW * 1.4, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    if (this.state.phase === 'rotate') {
      this.renderRotateRig();
    }

    // ember glow at base — 火が育つほど周囲を大きく暖色に照らす（炎の成長を光でも伝える）
    if (this.state.phase !== 'idle' && this.state.phase !== 'rotate' && this.state.fire >= 0) {
      const glowSize = 42 + this.state.fire * 2.3;
      const grad = ctx.createRadialGradient(
        this.baseX(),
        this.baseY(),
        0,
        this.baseX(),
        this.baseY(),
        glowSize,
      );
      const glowAlpha = this.state.phase === 'burning' ? 0.6 + Math.min(0.25, this.state.fire / 400) : 0.4;
      grad.addColorStop(0, `rgba(255,150,70,${glowAlpha})`);
      grad.addColorStop(0.6, `rgba(255,110,40,${glowAlpha * 0.5})`);
      grad.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.baseX(), this.baseY(), glowSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state.phase === 'rotate' && this.state.frictionHeat > 40) {
      // a faint red glow that gradually builds at the rod's base as friction heat climbs
      const glowSize = (10 + (this.state.frictionHeat - 40) * 0.7) * this.rigScale();
      const grad = ctx.createRadialGradient(this.baseX(), this.baseY() - 4, 0, this.baseX(), this.baseY() - 4, glowSize);
      grad.addColorStop(0, `rgba(255,90,40,${(this.state.frictionHeat - 40) / 90})`);
      grad.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.baseX(), this.baseY() - 4, glowSize, 0, Math.PI * 2);
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
      } else if (p.kind === 'leaf') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = `hsla(${p.hue}, 55%, 45%, ${0.7 * lifeRatio})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'dust') {
        ctx.fillStyle = `hsla(${p.hue}, 45%, 55%, ${0.6 * lifeRatio})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'sizzle') {
        ctx.fillStyle = `rgba(230,235,245,${0.7 * lifeRatio})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
