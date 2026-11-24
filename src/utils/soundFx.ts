/**
 * Procedural Web Audio synthesizer for DuoPlay feedback chimes & cues.
 * No external MP3 assets required; obeys global mute toggle.
 */
class DuoSoundFx {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.08,
    endFreq?: number,
    delaySec = 0,
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public click() {
    this.playTone(520, 0.06, 'triangle', 0.05, 620);
  }

  public countdownTick() {
    this.playTone(440, 0.11, 'sine', 0.07, 420);
  }

  public countdownGo() {
    this.playTone(660, 0.14, 'triangle', 0.08, 880);
  }

  public crackBuzzer() {
    this.playTone(310, 0.22, 'sawtooth', 0.06, 175);
    this.playTone(230, 0.28, 'triangle', 0.07, 130, 0.08);
  }

  public roundWin() {
    this.playTone(523.25, 0.14, 'triangle', 0.07);
    this.playTone(659.25, 0.14, 'triangle', 0.07, undefined, 0.1);
    this.playTone(783.99, 0.25, 'triangle', 0.08, undefined, 0.2);
  }

  public windTelegraph() {
    this.playTone(240, 0.35, 'sine', 0.05, 420);
  }

  public hazardHit() {
    this.playTone(185, 0.2, 'triangle', 0.07, 110);
  }

  public syncChime() {
    this.playTone(587.33, 0.12, 'sine', 0.055);
    this.playTone(880, 0.18, 'sine', 0.055, undefined, 0.08);
  }

  public victoryFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.26, 'triangle', 0.08, undefined, idx * 0.11);
    });
  }

  public fallSting() {
    this.playTone(360, 0.38, 'triangle', 0.08, 120);
    this.playTone(220, 0.32, 'sine', 0.06, 85, 0.12);
  }

  public sliceFruit(combo = 1) {
    const pitchBoost = Math.min(260, (combo - 1) * 28);
    this.playTone(540 + pitchBoost, 0.09, 'triangle', 0.065, 860 + pitchBoost);
  }

  public sliceGiant() {
    this.playTone(523.25, 0.14, 'triangle', 0.08, 783.99);
    this.playTone(783.99, 0.18, 'sine', 0.085, 1174.66, 0.07);
    this.playTone(1046.5, 0.22, 'triangle', 0.07, 1318.5, 0.14);
  }

  public bombExplode() {
    this.playTone(170, 0.34, 'sawtooth', 0.09, 48);
    this.playTone(115, 0.38, 'triangle', 0.08, 42, 0.05);
  }

  public puckHit(strength = 0.6) {
    const clamped = Math.max(0.2, Math.min(1, strength));
    this.playTone(320 + clamped * 260, 0.075, 'triangle', 0.05 + clamped * 0.04, 180);
  }

  public wallBounce() {
    this.playTone(260, 0.055, 'sine', 0.04, 190);
  }

  public goalHorn(isLocalScorer: boolean) {
    if (isLocalScorer) {
      this.playTone(440, 0.14, 'triangle', 0.08);
      this.playTone(554.37, 0.14, 'triangle', 0.08, undefined, 0.09);
      this.playTone(659.25, 0.28, 'triangle', 0.09, undefined, 0.18);
    } else {
      this.playTone(330, 0.18, 'sawtooth', 0.055, 220);
      this.playTone(220, 0.25, 'triangle', 0.06, 165, 0.12);
    }
  }

  public distractionFlash() {
    this.playTone(980, 0.07, 'sine', 0.08, 1480);
    this.playTone(620, 0.12, 'triangle', 0.05, 320, 0.04);
  }

  public flyBuzz() {
    this.playTone(290, 0.18, 'sawtooth', 0.03, 340);
    this.playTone(330, 0.18, 'sawtooth', 0.028, 270, 0.12);
  }

  public chompBonus(streak = 1) {
    const boost = Math.min(220, (streak - 1) * 24);
    this.playTone(460 + boost, 0.08, 'triangle', 0.07, 740 + boost);
    this.playTone(680 + boost, 0.09, 'sine', 0.05, 920 + boost, 0.05);
  }

  public trapYuck() {
    this.playTone(220, 0.22, 'sawtooth', 0.075, 95);
    this.playTone(150, 0.26, 'triangle', 0.07, 70, 0.06);
  }

  /**
   * Warm harmonic piano note (C major / A minor romantic pentatonic progression)
   * using layered fundamental + octave overtone + gentle low-pass decay.
   */
  public pianoNote(step = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    // Romantic ascending/flowing pentatonic scale (C4..E6)
    const scale = [
      261.63, 293.66, 329.63, 392.0, 440.0,
      523.25, 587.33, 659.25, 783.99, 880.0,
      1046.5, 987.77, 880.0, 783.99, 659.25, 587.33,
    ];
    const freq = scale[Math.abs(step) % scale.length];
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4.5, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.4), now + 0.85);
    filter.connect(ctx.destination);

    const harmonics: { ratio: number; type: OscillatorType; peak: number; dur: number }[] = [
      { ratio: 1, type: 'triangle', peak: 0.11, dur: 0.95 },
      { ratio: 2, type: 'sine', peak: 0.045, dur: 0.55 },
      { ratio: 3, type: 'sine', peak: 0.018, dur: 0.3 },
    ];

    for (const h of harmonics) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = h.type;
      osc.frequency.setValueAtTime(freq * h.ratio, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(h.peak, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + h.dur);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      osc.stop(now + h.dur + 0.03);
    }
  }

  public kissLaunch() {
    this.playTone(440, 0.12, 'sine', 0.055, 659.25);
    this.playTone(659.25, 0.16, 'triangle', 0.04, 880, 0.05);
  }

  public starChime(starIndex = 0) {
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];
    const freq = notes[Math.abs(starIndex) % notes.length];
    this.playTone(freq, 0.34, 'sine', 0.065);
    this.playTone(freq * 1.5, 0.28, 'triangle', 0.03, undefined, 0.04);
  }

  public constellationBloom() {
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    chord.forEach((n, idx) => {
      this.playTone(n, 0.72, 'sine', 0.055, undefined, idx * 0.085);
    });
  }
}

export const soundFx = new DuoSoundFx();

