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

  public playBarbellRack() {
    if (!this.canPlay('barbellRack', 180)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Crisp metallic plate clink + solid rack thud
    const oscLow = ctx.createOscillator();
    const gainLow = ctx.createGain();
    oscLow.type = 'triangle';
    oscLow.frequency.setValueAtTime(160, now);
    oscLow.frequency.exponentialRampToValueAtTime(72, now + 0.08);
    gainLow.gain.setValueAtTime(0.055, now);
    gainLow.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    oscLow.connect(gainLow);
    gainLow.connect(ctx.destination);
    oscLow.start(now);
    oscLow.stop(now + 0.11);

    const oscClink = ctx.createOscillator();
    const gainClink = ctx.createGain();
    oscClink.type = 'sine';
    oscClink.frequency.setValueAtTime(1180, now + 0.02);
    oscClink.frequency.exponentialRampToValueAtTime(860, now + 0.11);
    gainClink.gain.setValueAtTime(0.022, now + 0.02);
    gainClink.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    oscClink.connect(gainClink);
    gainClink.connect(ctx.destination);
    oscClink.start(now + 0.02);
    oscClink.stop(now + 0.14);
  }

  public playLiftRep() {
    if (!this.canPlay('liftRep', 350)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440, 587.33];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.032, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  /**
   * Classic antique mahogany grandfather pendulum clock chime:
   * 4-note Westminster phrase (E4 -> G#4 -> F#4 -> B3) followed by
   * two deep resonant bronze-rod bell tolls ("BONG... BONG...").
   */
  public playGrandfatherClockChime() {
    if (!this.canPlay('grandfatherClockChime', 1200)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const scheduleClockStrike = (
      freq: number,
      startTime: number,
      duration: number,
      volume: number,
      isDeepToll = false
    ) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isDeepToll ? 980 : 1950, startTime);
      filter.Q.setValueAtTime(isDeepToll ? 1.4 : 0.9, startTime);
      filter.connect(ctx.destination);

      // Warm wooden-cabinet fundamental tone
      const oscMain = ctx.createOscillator();
      const gainMain = ctx.createGain();
      oscMain.type = 'sine';
      oscMain.frequency.setValueAtTime(freq, startTime);
      gainMain.gain.setValueAtTime(0.0001, startTime);
      gainMain.gain.linearRampToValueAtTime(volume, startTime + 0.012);
      gainMain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);
      oscMain.connect(gainMain);
      gainMain.connect(filter);
      oscMain.start(startTime);
      oscMain.stop(startTime + duration + 0.05);

      // Warm brass harmonic octave (decays slightly faster)
      const oscOctave = ctx.createOscillator();
      const gainOctave = ctx.createGain();
      oscOctave.type = 'triangle';
      oscOctave.frequency.setValueAtTime(freq * 2, startTime);
      gainOctave.gain.setValueAtTime(0.0001, startTime);
      gainOctave.gain.linearRampToValueAtTime(volume * (isDeepToll ? 0.42 : 0.28), startTime + 0.008);
      gainOctave.gain.exponentialRampToValueAtTime(0.0005, startTime + duration * 0.62);
      oscOctave.connect(gainOctave);
      gainOctave.connect(filter);
      oscOctave.start(startTime);
      oscOctave.stop(startTime + duration * 0.68);

      // Subtle tubular-bell metallic shimmer partial (2.756x)
      const oscPartial = ctx.createOscillator();
      const gainPartial = ctx.createGain();
      oscPartial.type = 'sine';
      oscPartial.frequency.setValueAtTime(freq * 2.756, startTime);
      gainPartial.gain.setValueAtTime(0.0001, startTime);
      gainPartial.gain.linearRampToValueAtTime(volume * (isDeepToll ? 0.22 : 0.14), startTime + 0.006);
      gainPartial.gain.exponentialRampToValueAtTime(0.0004, startTime + Math.min(0.65, duration * 0.35));
      oscPartial.connect(gainPartial);
      gainPartial.connect(filter);
      oscPartial.start(startTime);
      oscPartial.stop(startTime + Math.min(0.7, duration * 0.4));
    };

    // Westminster 4-note antique chime melody
    const westminsterNotes = [
      { freq: 329.63, offset: 0.0, duration: 1.15, vol: 0.075 }, // E4
      { freq: 415.3, offset: 0.42, duration: 1.15, vol: 0.078 }, // G#4
      { freq: 369.99, offset: 0.84, duration: 1.15, vol: 0.075 }, // F#4
      { freq: 246.94, offset: 1.26, duration: 1.55, vol: 0.082 }, // B3
    ];

    for (const note of westminsterNotes) {
      scheduleClockStrike(note.freq, now + note.offset, note.duration, note.vol, false);
    }

    // Two deep resonant antique grandfather bell tolls
    scheduleClockStrike(164.81, now + 2.05, 2.3, 0.095, true); // E3 toll 1
    scheduleClockStrike(164.81, now + 3.15, 2.6, 0.09, true); // E3 toll 2
  }
}

export const soundEngine = new CozySoundEngine();
