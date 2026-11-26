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

  /**
   * Subtle synthesized heartbeat (lub-dub) for the final 5 seconds of Murmures Secrets.
   */
  public heartbeatPulse(urgency = 0.5) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const clamped = Math.max(0.2, Math.min(1, urgency));
    const gain1 = 0.085 + clamped * 0.05;
    const gain2 = 0.065 + clamped * 0.04;
    // Lub (low warm thump)
    this.playTone(72, 0.14, 'sine', gain1, 44, 0);
    // Dub (slightly higher secondary beat 170ms later)
    this.playTone(62, 0.16, 'sine', gain2, 38, 0.17);
  }

  /**
   * Soft warm velvet chime when the secret whisper is revealed.
   */
  public whisperReveal() {
    const chord = [293.66, 369.99, 440.0, 587.33];
    chord.forEach((n, idx) => {
      this.playTone(n, 0.58, 'sine', 0.05, undefined, idx * 0.07);
    });
  }

  /**
   * Shimmering romantic bloom when validated early by kiss or exact guess (+2 pts).
   */
  public kissBonusBloom() {
    const notes = [392.0, 493.88, 587.33, 783.99, 987.77];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.45, 'triangle', 0.055, undefined, idx * 0.055);
    });
  }

  // --- Slingshot Duo SFX ---
  public slingGrab() {
    this.playTone(340, 0.07, 'sine', 0.05, 440);
  }

  public slingFire(powerRatio = 0.7) {
    const p = Math.max(0.2, Math.min(1, powerRatio));
    this.playTone(220 + p * 140, 0.14, 'triangle', 0.08, 620 + p * 260);
    this.playTone(160, 0.09, 'sine', 0.045, 95, 0.02);
  }

  public slingRicochet() {
    this.playTone(760, 0.09, 'triangle', 0.065, 1180);
  }

  public slingTargetPop(pts = 20) {
    const base = pts >= 30 ? 640 : pts >= 20 ? 540 : 460;
    this.playTone(base, 0.11, 'triangle', 0.07, base * 1.45);
  }

  public slingFusionFireworks() {
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    chord.forEach((n, i) => {
      this.playTone(n, 0.32, 'triangle', 0.075, n * 1.06, i * 0.055);
    });
  }

  public slingOrangeExplosion() {
    this.playTone(190, 0.28, 'sawtooth', 0.08, 68);
    this.playTone(420, 0.18, 'triangle', 0.07, 150, 0.03);
  }

  public slingHeartBonus() {
    this.playTone(587.33, 0.14, 'sine', 0.065, 880);
    this.playTone(880, 0.22, 'triangle', 0.065, 1174.66, 0.07);
  }

  public slingBombStun() {
    this.playTone(150, 0.36, 'sawtooth', 0.095, 44);
    this.playTone(108, 0.42, 'triangle', 0.085, 38, 0.06);
  }

  // --- X O Néon SFX ---
  public xoHover() {
    this.playTone(480, 0.045, 'sine', 0.028, 560);
  }

  public xoPlaceX() {
    this.playTone(523.25, 0.11, 'triangle', 0.075, 783.99);
    this.playTone(783.99, 0.12, 'sine', 0.05, 1046.5, 0.05);
  }

  public xoPlaceO() {
    this.playTone(392.0, 0.12, 'sine', 0.075, 587.33);
    this.playTone(587.33, 0.14, 'triangle', 0.055, 493.88, 0.055);
  }

  public xoTimerTick(secLeft: number) {
    const freq = secLeft <= 1 ? 920 : secLeft <= 2 ? 780 : 660;
    this.playTone(freq, 0.08, 'square', 0.035, freq * 0.92);
  }

  public xoWin() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.3, 'triangle', 0.08, undefined, idx * 0.09);
    });
  }

  public xoDraw() {
    this.playTone(440, 0.16, 'sine', 0.06, 392);
    this.playTone(392, 0.22, 'sine', 0.055, 349.23, 0.14);
  }

  // --- Official Parcheesi SFX ---
  public parchisiDiceRoll() {
    // Crisp double wooden dice rattle
    const rattle = [290, 460, 350, 540, 410, 610, 490, 680];
    rattle.forEach((f, idx) => {
      this.playTone(f, 0.042, 'triangle', 0.052, f * 0.78, idx * 0.046);
    });
  }

  public parchisiPawnHop(stepIndex = 0) {
    // Soft wooden click on each tile step
    const base = 440 + Math.min(12, stepIndex) * 18;
    this.playTone(base, 0.052, 'triangle', 0.058, base * 0.72);
    this.playTone(base * 1.5, 0.03, 'sine', 0.025, base * 1.1, 0.008);
  }

  public parchisiCaptureDrama() {
    // Punchy capture burst sound
    this.playTone(540, 0.12, 'sawtooth', 0.068, 250, 0);
    this.playTone(320, 0.16, 'triangle', 0.075, 140, 0.09);
    this.playTone(185, 0.24, 'sawtooth', 0.065, 80, 0.18);
  }

  public parchisiSafeStarChime() {
    // Bright bell chime when landing on a Star / Safe tile
    this.playTone(783.99, 0.18, 'sine', 0.055, undefined, 0);
    this.playTone(1046.5, 0.26, 'triangle', 0.052, undefined, 0.065);
  }

  public parchisiBonusPowerChime(bonus: 20 | 10 = 20) {
    // Ascending golden power chime for +20 capture or +10 home bonus
    const chord = bonus === 20 ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 739.99, 880, 1174.66];
    chord.forEach((n, idx) => {
      this.playTone(n, 0.22, 'triangle', 0.065, n * 1.02, idx * 0.06);
    });
  }

  public parchisiThroneArrival() {
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    fanfare.forEach((n, idx) => {
      this.playTone(n, 0.28, 'triangle', 0.08, undefined, idx * 0.08);
    });
  }

  public parchisiCurseTripleSix() {
    this.playTone(392, 0.16, 'sawtooth', 0.06, 260, 0);
    this.playTone(260, 0.24, 'sawtooth', 0.065, 130, 0.14);
  }

  public parchisiEmotePop() {
    this.playTone(580, 0.075, 'triangle', 0.055, 880);
  }
}

export const soundFx = new DuoSoundFx();


