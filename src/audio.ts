/**
 * 実音声ファイルを使わず、Web Audio APIでその場に生成する軽量サウンドエンジン。
 * 森の環境音・天候・火のクラックル音・操作音を全て合成する。
 * ブラウザの自動再生制限があるため、最初のユーザー操作まではAudioContextを起動しない。
 */

type NoiseKind = 'white' | 'brown';

// 無音のWAV（0.1秒・8kHz・8bit）。iOS Safariは本体側面のサイレントスイッチがオンだと
// Web Audio単体では音を鳴らせないことがあるが、<audio>要素での再生はスイッチの
// 影響を受けにくいため、これをループ再生してページの「オーディオ再生中」扱いを
// 保つことで、同時に鳴らすWeb Audio側の音もミュートされにくくする定番の回避策。
const SILENT_AUDIO_SRC =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private fatigueGain: GainNode | null = null;
  private muted = false;
  private started = false;
  private fireLevel = 0;
  private nextCrackleAt = 0;
  private nextAmbientChirpAt = 0;
  private rafId = 0;
  private silentUnlockEl: HTMLAudioElement | null = null;

  /** ユーザー操作のタイミングで一度だけ呼ぶ（自動再生制限の回避） */
  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const ctx = this.ctx;
      // iOS Safari等はユーザー操作内で生成してもsuspended状態のままのことがあるため明示的にresumeする。
      // さらに画面ロックや着信で再度suspendされることがあるので、以後の操作でも都度resumeを試みる。
      void ctx.resume();
      const resumeIfNeeded = () => {
        if (ctx.state === 'suspended') void ctx.resume();
      };
      document.addEventListener('pointerdown', resumeIfNeeded);
      document.addEventListener('visibilitychange', resumeIfNeeded);

      const unlockEl = new Audio(SILENT_AUDIO_SRC);
      unlockEl.loop = true;
      unlockEl.volume = 0.01;
      unlockEl.play().catch(() => {});
      this.silentUnlockEl = unlockEl;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(ctx.destination);

      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.value = 0.16;
      this.ambientGain.connect(this.master);
      this.playNoiseLoop('brown', 400, this.ambientGain);

      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.windGain.connect(this.master);
      this.playNoiseLoop('white', 900, this.windGain, true);

      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      this.rainGain.connect(this.master);
      this.playNoiseLoop('white', 2400, this.rainGain);

      this.fireGain = ctx.createGain();
      this.fireGain.gain.value = 0;
      this.fireGain.connect(this.master);
      this.playNoiseLoop('brown', 260, this.fireGain);

      // スタミナが尽きてくると混じる、荒い息づかいのような擦れたノイズ
      this.fatigueGain = ctx.createGain();
      this.fatigueGain.gain.value = 0;
      this.fatigueGain.connect(this.master);
      this.playNoiseLoop('white', 700, this.fatigueGain, true);

      this.nextCrackleAt = ctx.currentTime + 1;
      this.nextAmbientChirpAt = ctx.currentTime + 2;
      this.loop();
    } catch {
      // Web Audio非対応環境では静かに諦める（ゲーム進行には影響させない）
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setWind(amp: number): void {
    if (!this.ctx || !this.windGain) return;
    this.windGain.gain.setTargetAtTime(Math.min(0.4, amp * 0.22), this.ctx.currentTime, 0.4);
  }

  setRain(amp: number): void {
    if (!this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(Math.min(0.45, amp * 0.28), this.ctx.currentTime, 0.4);
  }

  /** 0(平気)〜1(限界)。スタミナ30%以下でのみ有効な値を渡す想定 */
  setFatigue(level: number): void {
    if (!this.ctx || !this.fatigueGain) return;
    this.fatigueGain.gain.setTargetAtTime(Math.min(0.16, level * 0.16), this.ctx.currentTime, 0.3);
  }

  setFireLevel(fire0to100: number): void {
    this.fireLevel = fire0to100;
    if (!this.ctx || !this.fireGain) return;
    // 「ぼー」という持続音にならないよう、下敷きのノイズはごく小さな熾火の気配程度に留め、
    // 炎らしさは主にloop()側のパチパチ（クラックル）音で表現する
    const target = fire0to100 <= 0 ? 0 : 0.015 + (fire0to100 / 100) * 0.05;
    this.fireGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
  }

  /** タイトルへ戻る際に呼ぶ。前のプレイで残った炎・疲労・風雨の音を止める */
  resetAmbient(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fireGain?.gain.setTargetAtTime(0, t, 0.15);
    this.windGain?.gain.setTargetAtTime(0, t, 0.15);
    this.rainGain?.gain.setTargetAtTime(0, t, 0.15);
    this.fatigueGain?.gain.setTargetAtTime(0, t, 0.15);
    this.fireLevel = 0;
  }

  /** 短い操作音。汎用のシンプルなビープ/クリック/ポップ */
  playBlip(kind: 'pick' | 'snap-dry' | 'snap-wet' | 'spark' | 'ember' | 'whoosh' | 'success' | 'fail'): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.master);

    switch (kind) {
      case 'pick':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, t0);
        osc.frequency.exponentialRampToValueAtTime(760, t0 + 0.08);
        gain.gain.setValueAtTime(0.12, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
        osc.start(t0);
        osc.stop(t0 + 0.13);
        break;
      case 'snap-dry':
        this.playNoiseBurst(0.05, 3200, 0.28);
        return;
      case 'snap-wet':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, t0);
        osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.2);
        gain.gain.setValueAtTime(0.14, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
        osc.start(t0);
        osc.stop(t0 + 0.25);
        break;
      case 'spark':
        this.playNoiseBurst(0.03, 4200, 0.18);
        return;
      case 'ember':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t0);
        osc.frequency.exponentialRampToValueAtTime(500, t0 + 0.3);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.2, t0 + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
        osc.start(t0);
        osc.stop(t0 + 0.5);
        break;
      case 'whoosh':
        this.playNoiseBurst(0.35, 1400, 0.3);
        return;
      case 'success': {
        [0, 0.12, 0.26].forEach((delay, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = 260 + i * 120;
          g.gain.setValueAtTime(0.0001, t0 + delay);
          g.gain.linearRampToValueAtTime(0.16, t0 + delay + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.4);
          o.connect(g);
          g.connect(this.master!);
          o.start(t0 + delay);
          o.stop(t0 + delay + 0.45);
        });
        return;
      }
      case 'fail':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t0);
        osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.9);
        gain.gain.setValueAtTime(0.12, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0);
        osc.start(t0);
        osc.stop(t0 + 1.0);
        break;
    }
  }

  /** 焚き火の「パチッ」という単発クラックル音。まれに2連続の「パチパチッ」も鳴る */
  private playCrackle(): void {
    const volume = 0.09 + (this.fireLevel / 100) * 0.2;
    this.playNoiseBurst(0.03 + Math.random() * 0.04, 2800 + Math.random() * 2600, volume);
    if (Math.random() < 0.28) {
      setTimeout(() => {
        this.playNoiseBurst(0.025 + Math.random() * 0.03, 3200 + Math.random() * 2600, volume * 0.75);
      }, 35 + Math.random() * 45);
    }
  }

  private playNoiseBurst(durationSec: number, lowpassHz: number, volume: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const buffer = this.makeNoiseBuffer('white', durationSec);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassHz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  private makeNoiseBuffer(kind: NoiseKind, seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  private playNoiseLoop(kind: NoiseKind, lowpassHz: number, output: GainNode, bandpass = false): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const buffer = this.makeNoiseBuffer(kind, 4);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = bandpass ? 'bandpass' : 'lowpass';
    filter.frequency.value = lowpassHz;
    src.connect(filter);
    filter.connect(output);
    src.start();
  }

  private loop(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now >= this.nextCrackleAt) {
      const rate = this.fireLevel <= 0 ? 999 : 0.5 - Math.min(0.42, (this.fireLevel / 100) * 0.42);
      this.nextCrackleAt = now + 0.12 + rate + Math.random() * rate;
      if (this.fireLevel > 4) this.playCrackle();
    }
    if (now >= this.nextAmbientChirpAt) {
      this.nextAmbientChirpAt = now + 3 + Math.random() * 6;
      this.playChirp();
    }
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private playChirp(): void {
    if (!this.ctx || !this.ambientGain) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = 1800 + Math.random() * 1400;
    osc.frequency.setValueAtTime(base, t0);
    osc.frequency.exponentialRampToValueAtTime(base * 1.3, t0 + 0.05);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.04, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.silentUnlockEl?.pause();
    this.ctx?.close().catch(() => {});
  }
}

export const audioEngine = new AudioEngine();
