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
    const { fire, phase, windAmp, rainAmp, spinSpeed, frictionHeat } = this.state;
    this.windPhase += dt;
    const windDrift = Math.sin(this.windPhase * 1.3) * windAmp * 40;
    this.spinAngle += spinSpeed * dt * 22;

    if (this.particles.length < MAX_PARTICLES) {
      if (phase === 'burning') {
        const emitCount = Math.round(1 + (fire / 100) * 6);
        for (let i = 0; i < emitCount; i++) this.emitFlame(fire, windDrift);
        if (Math.random() < 0.4 + fire / 200) this.emitSpark(fire, windDrift);
        if (Math.random() < 0.25) this.emitSmoke(fire, windDrift);
        if (rainAmp > 0.3 && fire > 3 && Math.random() < rainAmp * 0.3) this.emitSizzle(fire);
      } else if (phase === 'ember') {
        if (Math.random() < 0.7) this.emitSmoke(10, windDrift);
      } else if (phase === 'rotate') {
        if (spinSpeed > 0.15 && Math.random() < spinSpeed * 0.6) this.emitDust(spinSpeed);
        const smokeChance = Math.max(0, (frictionHeat - 35) / 65);
        if (Math.random() < smokeChance * 0.55) this.emitSmoke(4, windDrift);
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
      rotation: 0,
      rotationSpeed: 0,
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
      rotation: 0,
      rotationSpeed: 0,
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

  private renderRotateRig(): void {
    const ctx = this.ctx;
    const bx = this.baseX();
    const by = this.baseY();

    // ground board
    ctx.fillStyle = 'rgba(60,42,26,0.9)';
    ctx.beginPath();
    ctx.ellipse(bx, by, 70, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,28,16,0.7)';
    ctx.beginPath();
    ctx.ellipse(bx, by, 46, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // spinning rod (barber-pole stripes suggest rotation around its own axis)
    const rodW = 13;
    const rodH = 92;
    const rodTop = by - rodH - 6;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx - rodW / 2, rodTop, rodW, rodH, rodW / 2);
    ctx.clip();
    ctx.fillStyle = '#5b3a1e';
    ctx.fillRect(bx - rodW / 2, rodTop, rodW, rodH);
    const stripeCount = 6;
    ctx.strokeStyle = 'rgba(255,220,180,0.35)';
    ctx.lineWidth = 4;
    for (let i = -1; i < stripeCount + 1; i++) {
      const phase = ((this.spinAngle + i * 22) % (rodH + 22)) - 11;
      ctx.beginPath();
      ctx.moveTo(bx - rodW, rodTop + phase);
      ctx.lineTo(bx + rodW, rodTop + phase + 14);
      ctx.stroke();
    }
    ctx.restore();

    if (this.state.spinSpeed > 0.05) {
      // motion blur hint at high speed
      ctx.globalAlpha = Math.min(0.4, this.state.spinSpeed * 0.3);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.ellipse(bx, rodTop + 8, rodW * 1.4, 5, 0, 0, Math.PI * 2);
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

    // ember glow at base
    if (this.state.phase !== 'idle' && this.state.phase !== 'rotate' && this.state.fire >= 0) {
      const glowSize = 16 + this.state.fire * 0.9;
      const grad = ctx.createRadialGradient(
        this.baseX(),
        this.baseY(),
        0,
        this.baseX(),
        this.baseY(),
        glowSize,
      );
      const glowAlpha = this.state.phase === 'burning' ? 0.55 : 0.4;
      grad.addColorStop(0, `rgba(255,140,60,${glowAlpha})`);
      grad.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.baseX(), this.baseY(), glowSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state.phase === 'rotate' && this.state.frictionHeat > 70) {
      // a faint red glow starting to show at the rod's base just before the ember appears
      const glowSize = 10 + (this.state.frictionHeat - 70) * 0.6;
      const grad = ctx.createRadialGradient(this.baseX(), this.baseY() - 4, 0, this.baseX(), this.baseY() - 4, glowSize);
      grad.addColorStop(0, `rgba(255,90,40,${(this.state.frictionHeat - 70) / 60})`);
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
