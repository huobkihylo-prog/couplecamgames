import type { JamInstrumentId } from '../types/duoplay';

/**
 * 100% Web Audio API Musical Instrument & FX Synthesizer for "Couple Jam : Devine le Son".
 * - Zero external MP3 files required.
 * - Zero latency polyphonic playback for Darbouka, Neon Guitar, Arcade Piano & Oriental Oud.
 * - NEVER touches or connects any HTML5 <audio> element (keeps external iTunes previews 100% CORS-safe).
 */

export interface NoteMeta {
  id: string;
  label: string;
  subLabel?: string;
  color: string;
  freq?: number;
}

export const DARBOUKA_ZONES: NoteMeta[] = [
  { id: 'doum', label: 'DOUM', subLabel: 'Basse', color: '#FACC15' },
  { id: 'tek', label: 'TEK', subLabel: 'Sec Droit', color: '#22D3EE' },
  { id: 'ka', label: 'KA', subLabel: 'Aigu Gauche', color: '#FF4D8D' },
  { id: 'slap', label: 'CLAP', subLabel: 'Slap Haut', color: '#A855F7' },
];

export const GUITAR_STRINGS: NoteMeta[] = [
  { id: 's6', label: 'Mi₄', subLabel: '1', color: '#22D3EE', freq: 329.63 },
  { id: 's5', label: 'Si₃', subLabel: '2', color: '#38BDF8', freq: 246.94 },
  { id: 's4', label: 'Sol₃', subLabel: '3', color: '#A855F7', freq: 196.0 },
  { id: 's3', label: 'Ré₃', subLabel: '4', color: '#EC4899', freq: 146.83 },
  { id: 's2', label: 'La₂', subLabel: '5', color: '#FB923C', freq: 110.0 },
  { id: 's1', label: 'Mi₂', subLabel: '6', color: '#FACC15', freq: 82.41 },
];

export const GUITAR_CHORDS: { id: string; label: string; color: string; freqs: number[] }[] = [
  { id: 'chord_Am', label: 'Am', color: '#A855F7', freqs: [110.0, 164.81, 220.0, 261.63, 329.63] },
  { id: 'chord_C', label: 'C', color: '#22D3EE', freqs: [130.81, 164.81, 196.0, 261.63, 329.63] },
  { id: 'chord_G', label: 'G', color: '#FACC15', freqs: [98.0, 123.47, 146.83, 196.0, 246.94, 392.0] },
  { id: 'chord_F', label: 'F', color: '#FF4D8D', freqs: [87.31, 130.81, 174.61, 220.0, 261.63, 349.23] },
  { id: 'chord_Dm', label: 'Dm', color: '#FB923C', freqs: [146.83, 220.0, 293.66, 349.23] },
  { id: 'chord_Em', label: 'Em', color: '#34D399', freqs: [82.41, 123.47, 164.81, 196.0, 246.94, 329.63] },
];

export const PIANO_WHITE_KEYS: NoteMeta[] = [
  { id: 'C4', label: 'Do', color: '#FF4D8D', freq: 261.63 },
  { id: 'D4', label: 'Ré', color: '#FB923C', freq: 293.66 },
  { id: 'E4', label: 'Mi', color: '#FACC15', freq: 329.63 },
  { id: 'F4', label: 'Fa', color: '#34D399', freq: 349.23 },
  { id: 'G4', label: 'Sol', color: '#22D3EE', freq: 392.0 },
  { id: 'A4', label: 'La', color: '#6366F1', freq: 440.0 },
  { id: 'B4', label: 'Si', color: '#A855F7', freq: 493.88 },
  { id: 'C5', label: 'Do₅', color: '#F43F5E', freq: 523.25 },
];

export const PIANO_ACCIDENTAL_KEYS: (NoteMeta & { afterWhiteIdx: number })[] = [
  { id: 'Fs4', label: 'Fa#', color: '#FACC15', freq: 369.99, afterWhiteIdx: 3 },
  { id: 'Gs4', label: 'Sol#', color: '#22D3EE', freq: 415.3, afterWhiteIdx: 4 },
  { id: 'Bb4', label: 'Sib', color: '#FF4D8D', freq: 466.16, afterWhiteIdx: 5 },
];

// Oriental Hijaz scale: Ré, Mib, Fa#, Sol, La, Sib, Do, Ré
export const OUD_NOTES: NoteMeta[] = [
  { id: 'oud_D4', label: 'Ré', subLabel: '1', color: '#FACC15', freq: 293.66 },
  { id: 'oud_Eb4', label: 'Mib', subLabel: '2', color: '#FB923C', freq: 311.13 },
  { id: 'oud_Fs4', label: 'Fa#', subLabel: '3', color: '#FF4D8D', freq: 369.99 },
  { id: 'oud_G4', label: 'Sol', subLabel: '4', color: '#EC4899', freq: 392.0 },
  { id: 'oud_A4', label: 'La', subLabel: '5', color: '#A855F7', freq: 440.0 },
  { id: 'oud_Bb4', label: 'Sib', subLabel: '6', color: '#6366F1', freq: 466.16 },
  { id: 'oud_C5', label: 'Do', subLabel: '7', color: '#38BDF8', freq: 523.25 },
  { id: 'oud_D5', label: 'Ré₅', subLabel: '8', color: '#22D3EE', freq: 587.33 },
];

class JamAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Call on first pointer/click interaction to unlock mobile Safari & Android Chrome Web Audio.
   */
  public unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Ignore unlock edge cases
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public playNote(instrument: JamInstrumentId, noteId: string, volume = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = Math.max(0.15, Math.min(1.2, volume));

    if (instrument === 'darbouka') {
      this.playDarbouka(ctx, noteId, vol);
    } else if (instrument === 'guitar') {
      this.playGuitar(ctx, noteId, vol);
    } else if (instrument === 'piano') {
      this.playPiano(ctx, noteId, vol);
    } else if (instrument === 'oud') {
      this.playOud(ctx, noteId, vol);
    }
  }

  private playDarbouka(ctx: AudioContext, noteId: string, vol: number): void {
    const now = ctx.currentTime;

    if (noteId === 'doum') {
      // Resonant deep bass sweep: 150Hz -> 52Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.16);
      osc.frequency.exponentialRampToValueAtTime(46, now + 0.34);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.55 * vol, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);

      // Subtle drum skin thump
      const punch = ctx.createOscillator();
      const punchGain = ctx.createGain();
      punch.type = 'triangle';
      punch.frequency.setValueAtTime(220, now);
      punch.frequency.exponentialRampToValueAtTime(85, now + 0.06);
      punchGain.gain.setValueAtTime(0.18 * vol, now);
      punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      punch.connect(punchGain);
      punchGain.connect(ctx.destination);
      punch.start(now);
      punch.stop(now + 0.08);
      return;
    }

    if (noteId === 'tek') {
      // Crisp rim hit: bandpass noise + short triangle 460Hz
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2500, now);
      bp.Q.setValueAtTime(2.6, now);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.32 * vol, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.095);

      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);
      oGain.gain.setValueAtTime(0.26 * vol, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      osc.connect(oGain);
      oGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.095);
      return;
    }

    if (noteId === 'ka') {
      // Bright dry left-hand accent: 580Hz + short high noise
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(3200, now);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.24 * vol, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      noise.connect(hp);
      hp.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.075);

      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(430, now + 0.06);
      oGain.gain.setValueAtTime(0.24 * vol, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      osc.connect(oGain);
      oGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
      return;
    }

    // CLAP / SLAP festive percussive accent
    [0, 0.014, 0.029].forEach((offset, idx) => {
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1650 + idx * 380, now + offset);
      bp.Q.setValueAtTime(1.5, now + offset);

      const g = ctx.createGain();
      const amp = (idx === 2 ? 0.36 : 0.22) * vol;
      g.gain.setValueAtTime(amp, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + (idx === 2 ? 0.14 : 0.045));

      noise.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      noise.start(now + offset);
      noise.stop(now + offset + 0.15);
    });
  }

  private pluckGuitarFreq(ctx: AudioContext, freq: number, delaySec: number, vol: number): void {
    const now = ctx.currentTime + delaySec;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.002, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(4800, freq * 9), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(240, freq * 1.4), now + 0.58);
    filter.Q.setValueAtTime(1.4, now);

    const osc2Mix = ctx.createGain();
    osc2Mix.gain.setValueAtTime(0.32, now);

    gain.gain.setValueAtTime(0.0008, now);
    gain.gain.linearRampToValueAtTime(0.24 * vol, now + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.95);

    osc1.connect(filter);
    osc2.connect(osc2Mix);
    osc2Mix.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.98);
    osc2.stop(now + 0.98);
  }

  private playGuitar(ctx: AudioContext, noteId: string, vol: number): void {
    const chord = GUITAR_CHORDS.find((c) => c.id === noteId);
    if (chord) {
      chord.freqs.forEach((f, idx) => {
        this.pluckGuitarFreq(ctx, f, idx * 0.022, vol * 0.68);
      });
      return;
    }
    const str = GUITAR_STRINGS.find((s) => s.id === noteId);
    if (str?.freq) {
      this.pluckGuitarFreq(ctx, str.freq, 0, vol);
    }
  }

  private playPiano(ctx: AudioContext, noteId: string, vol: number): void {
    const note =
      PIANO_WHITE_KEYS.find((k) => k.id === noteId) ||
      PIANO_ACCIDENTAL_KEYS.find((k) => k.id === noteId);
    if (!note?.freq) return;

    const now = ctx.currentTime;
    const freq = note.freq;

    // Electric piano warm body (fundamental sine + soft 2nd harmonic + gentle bell tine)
    const oscFund = ctx.createOscillator();
    const oscHarm = ctx.createOscillator();
    const oscTine = ctx.createOscillator();

    const fundGain = ctx.createGain();
    const harmGain = ctx.createGain();
    const tineGain = ctx.createGain();

    oscFund.type = 'sine';
    oscFund.frequency.setValueAtTime(freq, now);
    oscHarm.type = 'triangle';
    oscHarm.frequency.setValueAtTime(freq * 2, now);
    oscTine.type = 'sine';
    oscTine.frequency.setValueAtTime(freq * 3, now);

    fundGain.gain.setValueAtTime(0.001, now);
    fundGain.gain.linearRampToValueAtTime(0.28 * vol, now + 0.008);
    fundGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.85);

    harmGain.gain.setValueAtTime(0.001, now);
    harmGain.gain.linearRampToValueAtTime(0.09 * vol, now + 0.008);
    harmGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);

    tineGain.gain.setValueAtTime(0.001, now);
    tineGain.gain.linearRampToValueAtTime(0.06 * vol, now + 0.004);
    tineGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);

    oscFund.connect(fundGain);
    oscHarm.connect(harmGain);
    oscTine.connect(tineGain);
    fundGain.connect(ctx.destination);
    harmGain.connect(ctx.destination);
    tineGain.connect(ctx.destination);

    oscFund.start(now);
    oscHarm.start(now);
    oscTine.start(now);
    oscFund.stop(now + 0.88);
    oscHarm.stop(now + 0.45);
    oscTine.stop(now + 0.16);
  }

  private playOud(ctx: AudioContext, noteId: string, vol: number): void {
    const note = OUD_NOTES.find((k) => k.id === noteId);
    if (!note?.freq) return;

    const now = ctx.currentTime;
    const freq = note.freq;

    // Double-course oriental oud pluck with woody body resonance
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const bodyPeak = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    oscA.type = 'sawtooth';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(freq * 1.003, now);
    oscA.frequency.exponentialRampToValueAtTime(freq, now + 0.035);
    oscB.frequency.setValueAtTime(freq * 0.9985, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3400, now);
    filter.frequency.exponentialRampToValueAtTime(620, now + 0.42);

    bodyPeak.type = 'peaking';
    bodyPeak.frequency.setValueAtTime(420, now);
    bodyPeak.gain.setValueAtTime(5.5, now);
    bodyPeak.Q.setValueAtTime(1.8, now);

    const mixA = ctx.createGain();
    mixA.gain.setValueAtTime(0.42, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28 * vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.72);

    oscA.connect(mixA);
    mixA.connect(filter);
    oscB.connect(filter);
    filter.connect(bodyPeak);
    bodyPeak.connect(gain);
    gain.connect(ctx.destination);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.75);
    oscB.stop(now + 0.75);
  }

  public playMetronomeTick(accent: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1260 : 880, now);
    gain.gain.setValueAtTime(accent ? 0.16 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playBuzzer(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [220, 311.13].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.28);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    });
  }

  public playCorrectFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    });
  }
}

export const jamAudioEngine = new JamAudioEngine();
