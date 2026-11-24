class CozySoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastStepTime = 0;
  private lastPlayedAt = new Map<string, number>();

  private canPlay(key: string, cooldownMs: number): boolean {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prev = this.lastPlayedAt.get(key) ?? -Infinity;
    if (now - prev < cooldownMs) {
      return false;
    }
    this.lastPlayedAt.set(key, now);
    return true;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') {
      return null;
    }
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        return null;
      }
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playStep() {
    const now = performance.now();
    if (now - this.lastStepTime < 220) {
      return;
    }
    this.lastStepTime = now;

    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 135 + Math.random() * 25;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.045);

    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.055);
  }

  public playInteract() {
    if (!this.canPlay('interact', 90)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.09);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playEnterOffice() {
    if (!this.canPlay('enterOffice', 250)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.05, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playCoffeeSip() {
    if (!this.canPlay('coffeeSip', 300)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [392, 493.88, 587.33];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.04, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  public playMessageSent() {
    if (!this.canPlay('messageSent', 120)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playMessageReceived() {
    if (!this.canPlay('messageReceived', 180)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [587.33, 783.99];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.038, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  public playCarIgnition() {
    if (!this.canPlay('carIgnition', 400)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(72, now);
    osc.frequency.exponentialRampToValueAtTime(145, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(98, now + 0.26);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playCarHorn() {
    if (!this.canPlay('carHorn', 320)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [392, 493.88]; // Warm classic twin-tone G4 + B4 horn
    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1150, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.015);
      gain.gain.setValueAtTime(0.032, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    });
  }

  public playWaterPlants() {
    if (!this.canPlay('waterPlants', 550)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // 5 gentle rising crystal water-droplet chimes (one for each potted plant)
    const dropNotes = [523.25, 587.33, 659.25, 783.99, 880.0];
    dropNotes.forEach((freq, idx) => {
      const start = now + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.88, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, start + 0.09);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.042, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }
}

export const soundEngine = new CozySoundEngine();
