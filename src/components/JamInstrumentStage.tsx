import { useCallback, useEffect, useRef, useState } from 'react';
import type { JamInstrumentId, JamPlayer } from '../types/duoplay';
import {
  DARBOUKA_ZONES,
  GUITAR_CHORDS,
  GUITAR_STRINGS,
  OUD_NOTES,
  PIANO_ACCIDENTAL_KEYS,
  PIANO_WHITE_KEYS,
} from '../services/jamAudioEngine';

export interface JamVisualPulse {
  seq: number;
  instrument: JamInstrumentId;
  noteId: string;
  player: JamPlayer;
}

export interface JamHandCursor {
  id: number;
  x: number;
  y: number;
}

interface JamInstrumentStageProps {
  instrument: JamInstrumentId;
  interactive: boolean;
  /** Next note to blink brightly for ✨ Partition Lumineuse (only shown on Musician screen) */
  guideNoteId?: string | null;
  /** Latest played note (local or remote via PeerJS) to fire soundwave & particles */
  lastPulse: JamVisualPulse | null;
  /** Up to 2 live hand index cursors when air-play camera mode is enabled */
  handCursors?: JamHandCursor[];
  /** Callback when player triggers a note by touch/mouse/keyboard */
  onTriggerNote: (noteId: string) => void;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}

interface Ripple {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  color: string;
}

const PARTICLE_POOL_SIZE = 72;
const RIPPLE_POOL_SIZE = 16;

function getNoteVisualAnchor(instrument: JamInstrumentId, noteId: string): { x: number; y: number; color: string } {
  if (instrument === 'darbouka') {
    if (noteId === 'doum') return { x: 0.5, y: 0.54, color: '#FACC15' };
    if (noteId === 'tek') return { x: 0.78, y: 0.54, color: '#22D3EE' };
    if (noteId === 'ka') return { x: 0.22, y: 0.54, color: '#FF4D8D' };
    return { x: 0.5, y: 0.2, color: '#A855F7' };
  }
  if (instrument === 'guitar') {
    const chordIdx = GUITAR_CHORDS.findIndex((c) => c.id === noteId);
    if (chordIdx >= 0) {
      return {
        x: (chordIdx + 0.5) / GUITAR_CHORDS.length,
        y: 0.88,
        color: GUITAR_CHORDS[chordIdx].color,
      };
    }
    const strIdx = GUITAR_STRINGS.findIndex((s) => s.id === noteId);
    if (strIdx >= 0) {
      return {
        x: 0.5,
        y: 0.14 + strIdx * 0.115,
        color: GUITAR_STRINGS[strIdx].color,
      };
    }
    return { x: 0.5, y: 0.5, color: '#22D3EE' };
  }
  if (instrument === 'piano') {
    const acc = PIANO_ACCIDENTAL_KEYS.find((k) => k.id === noteId);
    if (acc) {
      return {
        x: (acc.afterWhiteIdx + 1) / PIANO_WHITE_KEYS.length,
        y: 0.3,
        color: acc.color,
      };
    }
    const wIdx = PIANO_WHITE_KEYS.findIndex((k) => k.id === noteId);
    if (wIdx >= 0) {
      return {
        x: (wIdx + 0.5) / PIANO_WHITE_KEYS.length,
        y: 0.72,
        color: PIANO_WHITE_KEYS[wIdx].color,
      };
    }
    return { x: 0.5, y: 0.5, color: '#FACC15' };
  }
  // Oud
  const oudIdx = OUD_NOTES.findIndex((n) => n.id === noteId);
  if (oudIdx >= 0) {
    return {
      x: (oudIdx + 0.5) / OUD_NOTES.length,
      y: 0.5,
      color: OUD_NOTES[oudIdx].color,
    };
  }
  return { x: 0.5, y: 0.5, color: '#FACC15' };
}

export function JamInstrumentStage({
  instrument,
  interactive,
  guideNoteId = null,
  lastPulse,
  handCursors = [],
  onTriggerNote,
}: JamInstrumentStageProps) {
  const [litNotes, setLitNotes] = useState<Record<string, number>>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const activePointerZoneRef = useRef<Map<number, string>>(new Map());
  const handCursorsRef = useRef<JamHandCursor[]>(handCursors);
  handCursorsRef.current = handCursors;

  // Pooled zero-GC particles & ripples
  const particlesRef = useRef<Particle[]>(
    Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.5,
      radius: 3,
      color: '#FACC15',
    })),
  );
  const ripplesRef = useRef<Ripple[]>(
    Array.from({ length: RIPPLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 10,
      maxRadius: 90,
      life: 0,
      color: '#22D3EE',
    })),
  );
  const particleCursorRef = useRef(0);
  const rippleCursorRef = useRef(0);

  const spawnVisualBurst = useCallback((inst: JamInstrumentId, noteId: string) => {
    const canvas = canvasRef.current;
    const anchor = getNoteVisualAnchor(inst, noteId);
    const w = canvas ? canvas.clientWidth || 600 : 600;
    const h = canvas ? canvas.clientHeight || 320 : 320;
    const cx = anchor.x * w;
    const cy = anchor.y * h;

    // Spawn 1 expanding ripple
    const rIdx = rippleCursorRef.current % RIPPLE_POOL_SIZE;
    rippleCursorRef.current += 1;
    const r = ripplesRef.current[rIdx];
    r.active = true;
    r.x = cx;
    r.y = cy;
    r.radius = 12;
    r.maxRadius = Math.min(w, h) * 0.34;
    r.life = 1;
    r.color = anchor.color;

    // Spawn 10 directional neon sparks
    for (let i = 0; i < 10; i += 1) {
      const pIdx = particleCursorRef.current % PARTICLE_POOL_SIZE;
      particleCursorRef.current += 1;
      const p = particlesRef.current[pIdx];
      const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.4;
      const speed = 75 + Math.random() * 140;
      p.active = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 20;
      p.life = 1;
      p.maxLife = 0.42 + Math.random() * 0.24;
      p.radius = 2.5 + Math.random() * 3.5;
      p.color = anchor.color;
    }

    // Light up pressed key/string/pad
    const stamp = Date.now();
    setLitNotes((prev) => ({ ...prev, [noteId]: stamp }));
    window.setTimeout(() => {
      setLitNotes((prev) => {
        if (prev[noteId] !== stamp) return prev;
        const copy = { ...prev };
        delete copy[noteId];
        return copy;
      });
    }, 220);
  }, []);

  // React to incoming/local note pulses
  useEffect(() => {
    if (!lastPulse) return;
    if (lastPulse.instrument === instrument) {
      spawnVisualBurst(lastPulse.instrument, lastPulse.noteId);
    } else {
      // In Concert Duo when partner plays a different instrument, still fire a glowing stage wave
      spawnVisualBurst(lastPulse.instrument, lastPulse.noteId);
    }
  }, [lastPulse, instrument, spawnVisualBurst]);

  // Lightweight 60fps Canvas2D particle/wave/cursor renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastMs = performance.now();

    const render = (now: number) => {
      rafId = requestAnimationFrame(render);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastMs) * 0.001));
      lastMs = now;

      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.round(cw * dpr);
      const targetH = Math.round(ch * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      // Draw ripples
      for (const r of ripplesRef.current) {
        if (!r.active) continue;
        r.life -= dt * 2.4;
        if (r.life <= 0) {
          r.active = false;
          continue;
        }
        const progress = 1 - r.life;
        const rad = r.radius + (r.maxRadius - r.radius) * progress;
        ctx.save();
        ctx.globalAlpha = Math.max(0, r.life * 0.72);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3 * r.life + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw particles
      for (const p of particlesRef.current) {
        if (!p.active) continue;
        p.life -= dt / p.maxLife;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw live air-play hand cursors
      const cursors = handCursorsRef.current;
      for (const c of cursors) {
        const hx = c.x * cw;
        const hy = c.y * ch;
        const color = c.id === 0 ? '#22D3EE' : '#FF4D8D';
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(hx, hy, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(hx, hy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const fire = useCallback(
    (noteId: string) => {
      if (!interactive) return;
      onTriggerNote(noteId);
    },
    [interactive, onTriggerNote],
  );

  // Swipe across guitar strings or oud/piano keys smoothly with multi-touch pointer events
  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.buttons === 0) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const noteId = el?.closest<HTMLElement>('[data-jam-note]')?.dataset.jamNote;
    if (!noteId) return;
    const prev = activePointerZoneRef.current.get(e.pointerId);
    if (prev !== noteId) {
      activePointerZoneRef.current.set(e.pointerId, noteId);
      fire(noteId);
    }
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointerZoneRef.current.delete(e.pointerId);
  };

  return (
    <div
      ref={stageRef}
      data-testid={`jam-instrument-${instrument}`}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
      style={{ touchAction: 'none' }}
      className="relative w-full h-full min-h-[210px] rounded-3xl border border-white/15 bg-[#120D28]/90 overflow-hidden select-none shadow-2xl shadow-black/40 flex flex-col"
    >
      {/* Subtle concert stage spotlight ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(124,58,237,0.34), transparent 46%), radial-gradient(circle at 80% 0%, rgba(34,211,238,0.26), transparent 44%), radial-gradient(circle at 50% 100%, rgba(255,77,141,0.22), transparent 50%)',
        }}
      />

      {/* Instrument Interactive Surface */}
      <div className="relative z-10 flex-1 min-h-0 w-full p-2.5 sm:p-4 flex flex-col justify-center">
        {/* 1. DARBOUKA — 4 luminous concentric/directional drum zones */}
        {instrument === 'darbouka' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-full max-w-[360px] aspect-square max-h-full grid grid-cols-2 grid-rows-2 gap-2.5 sm:gap-3">
              {/* Top full-width CLAP / SLAP */}
              <button
                type="button"
                data-jam-note="slap"
                aria-label="Darbouka CLAP SLAP"
                disabled={!interactive}
                onPointerDown={(e) => {
                  e.preventDefault();
                  activePointerZoneRef.current.set(e.pointerId, 'slap');
                  fire('slap');
                }}
                className={`col-span-2 rounded-t-[2.4rem] rounded-b-2xl border-2 flex flex-col items-center justify-center transition-transform duration-100 active:scale-95 ${
                  litNotes['slap']
                    ? 'bg-[#A855F7]/55 border-[#E9D5FF] scale-[0.97] shadow-[0_0_28px_rgba(168,85,247,0.85)]'
                    : guideNoteId === 'slap'
                      ? 'bg-[#A855F7]/35 border-[#FACC15] ring-4 ring-[#FACC15]/70 animate-pulse'
                      : 'bg-[#A855F7]/20 border-[#A855F7]/60 hover:bg-[#A855F7]/30'
                }`}
              >
                <span className="text-base sm:text-xl font-black tracking-wide text-white">👏 CLAP / SLAP</span>
                <span className="text-[11px] font-semibold text-white/75">Haut · Claquement festif</span>
              </button>

              {/* Left KA */}
              <button
                type="button"
                data-jam-note="ka"
                aria-label="Darbouka KA"
                disabled={!interactive}
                onPointerDown={(e) => {
                  e.preventDefault();
                  activePointerZoneRef.current.set(e.pointerId, 'ka');
                  fire('ka');
                }}
                className={`rounded-bl-[2.4rem] rounded-tl-2xl rounded-r-2xl border-2 flex flex-col items-start justify-end p-3 sm:p-4 transition-transform duration-100 active:scale-95 ${
                  litNotes['ka']
                    ? 'bg-[#FF4D8D]/55 border-white scale-[0.97] shadow-[0_0_28px_rgba(255,77,141,0.85)]'
                    : guideNoteId === 'ka'
                      ? 'bg-[#FF4D8D]/35 border-[#FACC15] ring-4 ring-[#FACC15]/70 animate-pulse'
                      : 'bg-[#FF4D8D]/20 border-[#FF4D8D]/60 hover:bg-[#FF4D8D]/30'
                }`}
              >
                <span className="text-lg sm:text-2xl font-black text-white">KA</span>
                <span className="text-[11px] font-semibold text-white/75">Bord gauche</span>
              </button>

              {/* Right TEK */}
              <button
                type="button"
                data-jam-note="tek"
                aria-label="Darbouka TEK"
                disabled={!interactive}
                onPointerDown={(e) => {
                  e.preventDefault();
                  activePointerZoneRef.current.set(e.pointerId, 'tek');
                  fire('tek');
                }}
                className={`rounded-br-[2.4rem] rounded-tr-2xl rounded-l-2xl border-2 flex flex-col items-end justify-end p-3 sm:p-4 transition-transform duration-100 active:scale-95 ${
                  litNotes['tek']
                    ? 'bg-[#22D3EE]/55 border-white scale-[0.97] shadow-[0_0_28px_rgba(34,211,238,0.85)]'
                    : guideNoteId === 'tek'
                      ? 'bg-[#22D3EE]/35 border-[#FACC15] ring-4 ring-[#FACC15]/70 animate-pulse'
                      : 'bg-[#22D3EE]/20 border-[#22D3EE]/60 hover:bg-[#22D3EE]/30'
                }`}
              >
                <span className="text-lg sm:text-2xl font-black text-white">TEK</span>
                <span className="text-[11px] font-semibold text-white/75">Bord droit</span>
              </button>

              {/* Center DOUM concentric circle */}
              <button
                type="button"
                data-jam-note="doum"
                aria-label="Darbouka DOUM"
                disabled={!interactive}
                onPointerDown={(e) => {
                  e.preventDefault();
                  activePointerZoneRef.current.set(e.pointerId, 'doum');
                  fire('doum');
                }}
                className={`absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 w-[44%] aspect-square rounded-full border-[3px] flex flex-col items-center justify-center transition-transform duration-100 active:scale-92 shadow-2xl ${
                  litNotes['doum']
                    ? 'bg-gradient-to-br from-[#FACC15] to-[#F97316] border-white text-[#120D28] scale-95 shadow-[0_0_36px_rgba(250,204,21,0.95)]'
                    : guideNoteId === 'doum'
                      ? 'bg-gradient-to-br from-[#FACC15]/85 to-[#FB923C]/85 border-white text-[#120D28] ring-4 ring-[#FACC15] animate-pulse'
                      : 'bg-gradient-to-br from-[#FACC15]/30 to-[#F97316]/35 border-[#FACC15] text-white hover:from-[#FACC15]/45 hover:to-[#F97316]/45'
                }`}
              >
                <span className="text-xl sm:text-3xl font-black tracking-tight">DOUM</span>
                <span className="text-[10px] sm:text-xs font-bold opacity-85">Basse Centre</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. GUITARE NÉON — 6 glowing strings + 6 quick chords */}
        {instrument === 'guitar' && (
          <div className="flex-1 min-h-0 flex flex-col justify-between gap-2.5">
            {/* 6 Horizontal Vibrating Neon Strings */}
            <div className="flex-1 min-h-0 flex flex-col justify-evenly rounded-2xl bg-[#0B081B]/75 border border-white/10 px-2.5 sm:px-4 py-1.5 relative overflow-hidden">
              {/* Soundhole motif */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 sm:w-36 aspect-square rounded-full border-4 border-[#FACC15]/25 bg-[#060411]/85"
              />
              {GUITAR_STRINGS.map((str, idx) => {
                const isLit = Boolean(litNotes[str.id]) || Object.keys(litNotes).some((k) => k.startsWith('chord_'));
                const isGuided = guideNoteId === str.id;
                const thickness = 2 + idx * 0.6;
                return (
                  <button
                    key={str.id}
                    type="button"
                    data-jam-note={str.id}
                    aria-label={`Corde ${str.label}`}
                    disabled={!interactive}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      activePointerZoneRef.current.set(e.pointerId, str.id);
                      fire(str.id);
                    }}
                    className="relative z-10 w-full min-h-[26px] sm:min-h-[34px] flex items-center gap-2.5 group focus-visible:outline-none"
                  >
                    <span
                      className="w-9 text-[11px] font-extrabold text-start tabular-nums shrink-0"
                      style={{ color: str.color }}
                    >
                      {str.label}
                    </span>
                    <span className="relative flex-1 flex items-center">
                      <span
                        className={`w-full rounded-full transition-all duration-100 ${
                          isLit ? 'scale-y-150 brightness-150' : isGuided ? 'animate-pulse scale-y-150' : ''
                        }`}
                        style={{
                          height: `${thickness}px`,
                          backgroundColor: isGuided ? '#FACC15' : str.color,
                          boxShadow: isLit || isGuided ? `0 0 18px ${str.color}` : `0 0 6px ${str.color}66`,
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 6 Quick Chord Buttons (Am, C, G, F, Dm, Em) */}
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2 shrink-0">
              {GUITAR_CHORDS.map((chord) => {
                const isLit = Boolean(litNotes[chord.id]);
                const isGuided = guideNoteId === chord.id;
                return (
                  <button
                    key={chord.id}
                    type="button"
                    data-jam-note={chord.id}
                    aria-label={`Accord ${chord.label}`}
                    disabled={!interactive}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      activePointerZoneRef.current.set(e.pointerId, chord.id);
                      fire(chord.id);
                    }}
                    style={{
                      borderColor: isLit || isGuided ? '#FACC15' : `${chord.color}88`,
                      backgroundColor: isLit ? `${chord.color}66` : `${chord.color}22`,
                      boxShadow: isLit ? `0 0 22px ${chord.color}` : undefined,
                    }}
                    className={`min-h-[44px] sm:min-h-[50px] rounded-2xl border-2 text-sm sm:text-base font-black text-white transition-transform duration-100 active:scale-95 ${
                      isGuided ? 'ring-3 ring-[#FACC15] animate-pulse' : ''
                    }`}
                  >
                    {chord.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. PIANO ARCADE — 8 luminous white keys (Do4 -> Do5) + 3 accidentals (Fa#, Sol#, Sib) */}
        {instrument === 'piano' && (
          <div className="relative flex-1 min-h-[190px] w-full flex gap-1 sm:gap-1.5">
            {PIANO_WHITE_KEYS.map((key) => {
              const isLit = Boolean(litNotes[key.id]);
              const isGuided = guideNoteId === key.id;
              return (
                <button
                  key={key.id}
                  type="button"
                  data-jam-note={key.id}
                  aria-label={`Piano ${key.label}`}
                  disabled={!interactive}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    activePointerZoneRef.current.set(e.pointerId, key.id);
                    fire(key.id);
                  }}
                  style={{
                    borderColor: isLit || isGuided ? '#FACC15' : `${key.color}70`,
                    boxShadow: isLit
                      ? `0 0 28px ${key.color}`
                      : isGuided
                        ? '0 0 24px rgba(250,204,21,0.85)'
                        : undefined,
                  }}
                  className={`relative flex-1 h-full rounded-b-2xl rounded-t-xl border-2 flex flex-col items-center justify-end pb-3 sm:pb-4 transition-all duration-100 active:translate-y-0.5 ${
                    isLit
                      ? 'bg-white text-[#120D28]'
                      : isGuided
                        ? 'bg-[#FACC15]/90 text-[#120D28] animate-pulse'
                        : 'bg-gradient-to-b from-white/16 to-white/8 text-white hover:from-white/24'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mb-1.5"
                    style={{ backgroundColor: isLit || isGuided ? '#120D28' : key.color }}
                  />
                  <span className="text-xs sm:text-base font-black">{key.label}</span>
                </button>
              );
            })}

            {/* 3 Black Accidental Keys (Fa#, Sol#, Sib) */}
            {PIANO_ACCIDENTAL_KEYS.map((acc) => {
              const isLit = Boolean(litNotes[acc.id]);
              const isGuided = guideNoteId === acc.id;
              const leftPct = ((acc.afterWhiteIdx + 1) / PIANO_WHITE_KEYS.length) * 100;
              return (
                <button
                  key={acc.id}
                  type="button"
                  data-jam-note={acc.id}
                  aria-label={`Piano ${acc.label}`}
                  disabled={!interactive}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    activePointerZoneRef.current.set(e.pointerId, acc.id);
                    fire(acc.id);
                  }}
                  style={{
                    left: `${leftPct}%`,
                    borderColor: isLit || isGuided ? '#FACC15' : `${acc.color}AA`,
                    boxShadow: isLit ? `0 0 22px ${acc.color}` : undefined,
                  }}
                  className={`absolute top-0 -translate-x-1/2 z-20 w-[10.5%] sm:w-[9%] h-[54%] rounded-b-2xl rounded-t-lg border-2 flex flex-col items-center justify-end pb-2 text-[10px] sm:text-xs font-black transition-all duration-100 active:translate-y-0.5 ${
                    isLit
                      ? 'bg-[#22D3EE] text-[#120D28]'
                      : isGuided
                        ? 'bg-[#FACC15] text-[#120D28] animate-pulse'
                        : 'bg-[#171130] text-white hover:bg-[#231A47]'
                  }`}
                >
                  <span>{acc.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 4. OUD ORIENTAL — 8 luminous Hijaz scale zones (Ré, Mib, Fa#, Sol, La, Sib, Do, Ré) */}
        {instrument === 'oud' && (
          <div className="flex-1 min-h-[190px] w-full flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 text-[11px] font-bold text-[#FACC15]/90">
              <span>🪕 Gamme Hijaz Orientale</span>
              <span className="text-white/65">Glisse ou tape les cordes</span>
            </div>
            <div className="flex-1 min-h-0 grid grid-cols-4 sm:grid-cols-8 gap-1.5 sm:gap-2">
              {OUD_NOTES.map((note) => {
                const isLit = Boolean(litNotes[note.id]);
                const isGuided = guideNoteId === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    data-jam-note={note.id}
                    aria-label={`Oud ${note.label}`}
                    disabled={!interactive}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      activePointerZoneRef.current.set(e.pointerId, note.id);
                      fire(note.id);
                    }}
                    style={{
                      borderColor: isLit || isGuided ? '#FACC15' : `${note.color}75`,
                      background: isLit
                        ? `linear-gradient(180deg, ${note.color}88, ${note.color}38)`
                        : isGuided
                          ? 'linear-gradient(180deg, rgba(250,204,21,0.55), rgba(250,204,21,0.22))'
                          : `linear-gradient(180deg, ${note.color}22, rgba(16,11,36,0.9))`,
                      boxShadow: isLit ? `0 0 26px ${note.color}` : undefined,
                    }}
                    className={`relative rounded-2xl border-2 flex flex-col items-center justify-between py-2.5 sm:py-4 overflow-hidden transition-transform duration-100 active:scale-95 ${
                      isGuided ? 'ring-3 ring-[#FACC15] animate-pulse' : ''
                    }`}
                  >
                    {/* Vertical luminous double-course oud string */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] opacity-65"
                      style={{ backgroundColor: note.color }}
                    />
                    <span className="relative z-10 text-[10px] font-bold text-white/70 tabular-nums">
                      {note.subLabel}
                    </span>
                    <span className="relative z-10 px-2 py-0.5 rounded-lg bg-[#120D28]/85 text-sm sm:text-base font-black text-white">
                      {note.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Soundwave & Neon Particles + Hand Cursors Canvas Overlay */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 w-full h-full"
      />
    </div>
  );
}
