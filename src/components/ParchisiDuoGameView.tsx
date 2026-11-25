import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  Camera,
  Crown,
  Dices,
  Hand,
  Heart,
  MicOff,
  RotateCcw,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  HandMetrics,
  ParchisiEmoteKind,
  ParchisiMode,
  ParchisiPlayer,
  ParchisiState,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import { PARCHISI_THRONE_PROGRESS } from '../game/parchisiBoard';
import {
  applyParchisiMove,
  areAllPawnsOut,
  chooseAiParchisiMove,
  createHandShakeState,
  createInitialParchisiState,
  dismissParchisiKarmaCard,
  getLegalParchisiMoves,
  PARCHISI_KARMA_DECK,
  PARCHISI_MERCY_COUNTDOWN_SEC,
  passParchisiTurnNoMoves,
  resolveParchisiMercy,
  rollParchisiDie,
  startParchisiMatch,
  stepHandShakeDetector,
} from '../game/parchisiLogic';
import { soundFx } from '../utils/soundFx';
import { useI18n } from '../i18n/LanguageContext';
import { AvatarCanvas } from './AvatarCanvas';
import { ParchisiBoardSvg, type FloatingEmoteItem } from './ParchisiBoardSvg';
import { ParchisiDice3D } from './ParchisiDice3D';

interface ParchisiDuoGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micMuted: boolean;
  handTrackerStatus: TrackerStatus;
  handDiceEnabled: boolean;
  onToggleHandDice: (enabled: boolean) => void;
  localFaceMetricsRef: MutableRefObject<FaceMetrics>;
  partnerFaceMetricsRef: MutableRefObject<FaceMetrics>;
  localHandMetricsRef: MutableRefObject<HandMetrics>;
  onRecordVictory: () => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onReturnToHub: () => void;
}

const EMOTE_LIST: { kind: ParchisiEmoteKind; emoji: string }[] = [
  { kind: 'yum', emoji: '😈' },
  { kind: 'mercy', emoji: '😭' },
  { kind: 'blocked', emoji: '🚧' },
  { kind: 'lucky', emoji: '😘' },
];

const CONFETTI_COLORS = ['#F43F5E', '#06B6D4', '#FACC15', '#A855F7', '#34D399', '#FB7185'];

export function ParchisiDuoGameView({
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  micMuted,
  handTrackerStatus,
  handDiceEnabled,
  onToggleHandDice,
  localFaceMetricsRef,
  partnerFaceMetricsRef,
  localHandMetricsRef,
  onRecordVictory,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  registerPeerHandler,
  onReturnToHub,
}: ParchisiDuoGameViewProps) {
  const { t, lang } = useI18n();
  const isSolo = connectionMode === 'solo';
  const isHost = connectionMode === 'p2p-host' || isSolo;
  const localRole: ParchisiPlayer = connectionMode === 'p2p-guest' ? 'guest' : 'host';

  const hostName = localRole === 'host' ? localName : partnerName;
  const guestName = localRole === 'guest' ? localName : partnerName;

  const [selectedMode, setSelectedMode] = useState<ParchisiMode>('express');
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const showLocalLiveVideo = Boolean(localStream) && cameraEnabled;
  const showRemoteLiveVideo = Boolean(remoteStream) && !isSolo;

  useEffect(() => {
    const v = localVideoRef.current;
    if (!v) return;
    if (showLocalLiveVideo && localStream) {
      if (v.srcObject !== localStream) v.srcObject = localStream;
      v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [localStream, showLocalLiveVideo]);

  useEffect(() => {
    const v = remoteVideoRef.current;
    if (!v) return;
    if (showRemoteLiveVideo && remoteStream) {
      if (v.srcObject !== remoteStream) v.srcObject = remoteStream;
      v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [remoteStream, showRemoteLiveVideo]);
  const [state, setState] = useState<ParchisiState>(() => createInitialParchisiState('express'));
  const stateRef = useRef<ParchisiState>(state);
  stateRef.current = state;

  const [hoveredPawnId, setHoveredPawnId] = useState<number | null>(null);
  const [isRollingAnim, setIsRollingAnim] = useState(false);
  const [displayDieFace, setDisplayDieFace] = useState<number | null>(null);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const [statusBannerToast, setStatusBannerToast] = useState<string | null>(null);
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmoteItem[]>([]);
  const [mercyCountdownMs, setMercyCountdownMs] = useState(PARCHISI_MERCY_COUNTDOWN_SEC * 1000);
  const [animOverride, setAnimOverride] = useState<{
    owner: ParchisiPlayer;
    pawnId: number;
    progress: number;
    hopping: boolean;
  } | null>(null);

  const lastPlayedAnimSeqRef = useRef(0);
  const lastPlayedRollSeqRef = useRef(0);
  const lastVictorySeqRef = useRef(0);
  const hopTimersRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const rollTimerRef = useRef<number | null>(null);
  const shakeStateRef = useRef(createHandShakeState());
  const isAnimatingMoveRef = useRef(false);

  const clearHopTimers = useCallback(() => {
    for (const id of hopTimersRef.current) window.clearTimeout(id);
    hopTimersRef.current = [];
    isAnimatingMoveRef.current = false;
  }, []);

  const flashBanner = useCallback((msg: string, ms = 2200) => {
    setStatusBannerToast(msg);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setStatusBannerToast(null);
      toastTimerRef.current = null;
    }, ms);
  }, []);

  const spawnFloatingEmote = useCallback(
    (kind: ParchisiEmoteKind, from: ParchisiPlayer) => {
      const def = EMOTE_LIST.find((e) => e.kind === kind) ?? EMOTE_LIST[0];
      const id = Date.now() + Math.floor(Math.random() * 10000);
      const xPct = from === 'host' ? 24 + Math.random() * 20 : 56 + Math.random() * 20;
      const item: FloatingEmoteItem = {
        id,
        kind,
        emoji: def.emoji,
        label: t.parchisiEmotes[kind],
        from,
        xPct,
      };
      soundFx.parchisiEmotePop();
      setFloatingEmotes((prev) => [...prev.slice(-4), item]);
      window.setTimeout(() => {
        setFloatingEmotes((prev) => prev.filter((e) => e.id !== id));
      }, 2200);
    },
    [t.parchisiEmotes],
  );

  // Host commits authoritative state & broadcasts over PeerJS
  const commitHostState = useCallback(
    (next: ParchisiState) => {
      stateRef.current = next;
      setState(next);
      if (!isSolo) {
        onSendPeerMessage({ type: 'PARCHISI_STATE', state: next });
      }
    },
    [isSolo, onSendPeerMessage],
  );

  // Sync body state attribute for testability & clean up timers on unmount
  useEffect(() => {
    document.body.dataset.state =
      state.phase === 'READY'
        ? 'ready'
        : state.phase === 'GAME_OVER'
          ? 'gameover'
          : 'playing';
  }, [state.phase]);

  useEffect(() => {
    return () => {
      clearHopTimers();
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
      onToggleHandDice(false);
    };
  }, [clearHopTimers, onToggleHandDice]);

  // Step-by-step 120ms/square hop animation whenever lastMoveAnim advances
  useEffect(() => {
    const anim = state.lastMoveAnim;
    if (!anim || anim.seq === lastPlayedAnimSeqRef.current) return;
    lastPlayedAnimSeqRef.current = anim.seq;

    clearHopTimers();
    if (anim.path.length <= 1) {
      if (anim.path.length === 1) {
        soundFx.parchisiPawnHop(0);
      }
      setAnimOverride(null);
      return;
    }

    isAnimatingMoveRef.current = true;
    anim.path.forEach((prog, idx) => {
      const tid = window.setTimeout(() => {
        setAnimOverride({
          owner: anim.owner,
          pawnId: anim.pawnId,
          progress: prog,
          hopping: idx < anim.path.length - 1,
        });
        soundFx.parchisiPawnHop(idx);
      }, idx * 120);
      hopTimersRef.current.push(tid);
    });

    const endTid = window.setTimeout(() => {
      setAnimOverride(null);
      isAnimatingMoveRef.current = false;
    }, anim.path.length * 120 + 60);
    hopTimersRef.current.push(endTid);
  }, [state.lastMoveAnim, clearHopTimers]);

  // Dice rattle SFX + face tumble animation whenever rollSeq advances
  useEffect(() => {
    if (state.rollSeq === 0 || state.rollSeq === lastPlayedRollSeqRef.current) return;
    lastPlayedRollSeqRef.current = state.rollSeq;

    soundFx.parchisiDiceRoll();
    setIsRollingAnim(true);
    const targetDie = state.dieValue ?? 6;
    const ticks = [1, 4, 2, 6, 3, targetDie];
    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    ticks.forEach((face, i) => {
      window.setTimeout(() => {
        setDisplayDieFace(face);
      }, i * 55);
    });
    rollTimerRef.current = window.setTimeout(() => {
      setIsRollingAnim(false);
      setDisplayDieFace(targetDie);
      rollTimerRef.current = null;
    }, 340);

    if (state.lastEventText === 'TRIPLE_SIX_CURSED') {
      soundFx.parchisiCurseTripleSix();
      flashBanner(t.parchisiTripleSixCursed, 3000);
    } else if (state.lastEventText === 'TRIPLE_SIX_SPARED') {
      soundFx.parchisiCurseTripleSix();
      flashBanner(t.parchisiTripleSixSpared, 3000);
    } else if (state.dieValue === 6 && state.effectiveSteps === 7) {
      flashBanner(t.parchisiSixBonusSeven, 2200);
    }
  }, [
    state.rollSeq,
    state.dieValue,
    state.effectiveSteps,
    state.lastEventText,
    flashBanner,
    t.parchisiTripleSixCursed,
    t.parchisiTripleSixSpared,
    t.parchisiSixBonusSeven,
  ]);

  // Phase SFX feedback (Capture Mercy, Karma Card, Throne, Victory)
  useEffect(() => {
    if (state.phase === 'MERCY_OFFER' && state.pendingMercy?.stage === 'choose') {
      soundFx.parchisiCaptureDrama();
    } else if (state.phase === 'KARMA_CARD') {
      soundFx.parchisiKarmaChime();
    } else if (state.phase === 'BONUS_10' && state.lastEventText === 'THRONE_BONUS_10') {
      soundFx.parchisiThroneArrival();
    } else if (state.phase === 'BONUS_10' && state.lastEventText === 'MERCY_SAVED_BONUS_10') {
      soundFx.parchisiMercySaved();
    } else if (state.phase === 'GAME_OVER' && state.stateSeq !== lastVictorySeqRef.current) {
      lastVictorySeqRef.current = state.stateSeq;
      soundFx.parchisiThroneArrival();
      if (state.winner === localRole) {
        onRecordVictory();
      }
    }
  }, [state.phase, state.pendingMercy?.stage, state.lastEventText, state.stateSeq, state.winner, localRole, onRecordVictory]);

  // Legal moves for current active state
  const legalMoves = useMemo(() => getLegalParchisiMoves(state), [state]);

  // ==================== HOST ACTION PROCESSOR ====================
  const executeHostAction = useCallback(
    (
      actor: ParchisiPlayer,
      action: 'ROLL' | 'MOVE_PAWN' | 'MERCY_DECISION' | 'DISMISS_CARD' | 'EMOTE',
      payload?: {
        pawnId?: number;
        mercyChoice?: 'no_mercy' | 'offer_dare' | 'accept_dare' | 'decline_dare' | 'validate_dare';
        emote?: ParchisiEmoteKind;
      },
    ) => {
      const cur = stateRef.current;

      if (action === 'EMOTE' && payload?.emote) {
        spawnFloatingEmote(payload.emote, actor);
        return;
      }

      if (action === 'ROLL') {
        if (cur.phase !== 'WAIT_ROLL' || cur.turn !== actor) return;
        const outcome = rollParchisiDie(cur);
        commitHostState(outcome.state);
        return;
      }

      if (action === 'MOVE_PAWN' && payload?.pawnId !== undefined) {
        if (
          cur.turn !== actor ||
          (cur.phase !== 'WAIT_MOVE' && cur.phase !== 'BONUS_20' && cur.phase !== 'BONUS_10')
        ) {
          return;
        }
        const res = applyParchisiMove(cur, payload.pawnId);
        if (res.accepted) {
          setHoveredPawnId(null);
          commitHostState(res.state);
        }
        return;
      }

      if (action === 'MERCY_DECISION' && payload?.mercyChoice) {
        if (cur.phase !== 'MERCY_OFFER' || !cur.pendingMercy) return;
        const m = cur.pendingMercy;
        const c = payload.mercyChoice;
        const allowed =
          ((c === 'no_mercy' || c === 'offer_dare' || c === 'validate_dare') && actor === m.capturer) ||
          ((c === 'accept_dare' || c === 'decline_dare') && actor === m.victim);
        if (!allowed) return;
        const next = resolveParchisiMercy(cur, c);
        commitHostState(next);
        return;
      }

      if (action === 'DISMISS_CARD') {
        if (cur.phase !== 'KARMA_CARD' || cur.turn !== actor) return;
        const next = dismissParchisiKarmaCard(cur);
        commitHostState(next);
      }
    },
    [commitHostState, spawnFloatingEmote],
  );

  // ==================== USER ACTION DISPATCHERS ====================
  const handleStartMatch = useCallback(
    (mode: ParchisiMode) => {
      soundFx.click();
      setSelectedMode(mode);
      if (isHost) {
        const fresh = startParchisiMatch(mode);
        setDisplayDieFace(null);
        setHoveredPawnId(null);
        commitHostState(fresh);
      } else {
        onSendPeerMessage({ type: 'PARCHISI_START', mode });
      }
    },
    [isHost, commitHostState, onSendPeerMessage],
  );

  const handleRoll = useCallback(() => {
    const cur = stateRef.current;
    if (cur.phase !== 'WAIT_ROLL' || cur.turn !== localRole || isRollingAnim) return;
    if (isHost) {
      executeHostAction(localRole, 'ROLL');
    } else {
      onSendPeerMessage({ type: 'PARCHISI_ACTION', action: 'ROLL' });
    }
  }, [localRole, isRollingAnim, isHost, executeHostAction, onSendPeerMessage]);

  const handleSelectPawn = useCallback(
    (pawnId: number) => {
      const cur = stateRef.current;
      if (cur.turn !== localRole) return;
      if (cur.phase !== 'WAIT_MOVE' && cur.phase !== 'BONUS_20' && cur.phase !== 'BONUS_10') return;
      if (isHost) {
        executeHostAction(localRole, 'MOVE_PAWN', { pawnId });
      } else {
        onSendPeerMessage({ type: 'PARCHISI_ACTION', action: 'MOVE_PAWN', pawnId });
      }
    },
    [localRole, isHost, executeHostAction, onSendPeerMessage],
  );

  const handleMercyDecision = useCallback(
    (choice: 'no_mercy' | 'offer_dare' | 'accept_dare' | 'decline_dare' | 'validate_dare') => {
      soundFx.click();
      if (isHost) {
        executeHostAction(localRole, 'MERCY_DECISION', { mercyChoice: choice });
      } else {
        onSendPeerMessage({ type: 'PARCHISI_ACTION', action: 'MERCY_DECISION', mercyChoice: choice });
      }
    },
    [localRole, isHost, executeHostAction, onSendPeerMessage],
  );

  const handleDismissKarma = useCallback(() => {
    soundFx.click();
    if (isHost) {
      executeHostAction(localRole, 'DISMISS_CARD');
    } else {
      onSendPeerMessage({ type: 'PARCHISI_ACTION', action: 'DISMISS_CARD' });
    }
  }, [localRole, isHost, executeHostAction, onSendPeerMessage]);

  const handleSendEmote = useCallback(
    (kind: ParchisiEmoteKind) => {
      spawnFloatingEmote(kind, localRole);
      if (!isSolo) {
        onSendPeerMessage({ type: 'PARCHISI_ACTION', action: 'EMOTE', emote: kind });
      }
    },
    [spawnFloatingEmote, localRole, isSolo, onSendPeerMessage],
  );

  // ==================== PEERJS MESSAGE HANDLER ====================
  useEffect(() => {
    const handler = (msg: PeerMessage) => {
      if (msg.type === 'PARCHISI_STATE' && !isHost) {
        stateRef.current = msg.state;
        setState(msg.state);
      } else if (msg.type === 'PARCHISI_START' && isHost) {
        setSelectedMode(msg.mode);
        const fresh = startParchisiMatch(msg.mode);
        commitHostState(fresh);
      } else if (msg.type === 'PARCHISI_ACTION') {
        if (msg.action === 'EMOTE' && msg.emote) {
          const sender: ParchisiPlayer = localRole === 'host' ? 'guest' : 'host';
          spawnFloatingEmote(msg.emote, sender);
        } else if (isHost) {
          executeHostAction('guest', msg.action, {
            pawnId: msg.pawnId,
            mercyChoice: msg.mercyChoice,
            emote: msg.emote,
          });
        }
      }
    };
    registerPeerHandler(handler);
    return () => registerPeerHandler(null);
  }, [isHost, localRole, registerPeerHandler, commitHostState, executeHostAction, spawnFloatingEmote]);

  // ==================== AUTO-PASS WHEN NO LEGAL MOVES (1s TOAST) ====================
  useEffect(() => {
    if (
      state.phase !== 'WAIT_MOVE' &&
      state.phase !== 'BONUS_20' &&
      state.phase !== 'BONUS_10'
    ) {
      return;
    }
    if (legalMoves.length > 0) return;

    flashBanner(t.parchisiNoMovesToast, 1100);
    if (!isHost) return;
    const tid = window.setTimeout(() => {
      const cur = stateRef.current;
      if (
        (cur.phase === 'WAIT_MOVE' || cur.phase === 'BONUS_20' || cur.phase === 'BONUS_10') &&
        getLegalParchisiMoves(cur).length === 0
      ) {
        commitHostState(passParchisiTurnNoMoves(cur));
      }
    }, 1050);
    return () => window.clearTimeout(tid);
  }, [state.phase, state.stateSeq, legalMoves.length, isHost, commitHostState, flashBanner, t.parchisiNoMovesToast]);

  // ==================== OPTIONAL "⚡ COUP AUTO" WHEN ONLY 1 LEGAL MOVE ====================
  useEffect(() => {
    if (!autoMoveEnabled) return;
    if (state.turn !== localRole) return;
    if (state.phase !== 'WAIT_MOVE' && state.phase !== 'BONUS_20' && state.phase !== 'BONUS_10') return;
    if (legalMoves.length !== 1) return;

    const tid = window.setTimeout(() => {
      if (!isRollingAnim) {
        handleSelectPawn(legalMoves[0].pawnId);
      }
    }, 360);
    return () => window.clearTimeout(tid);
  }, [autoMoveEnabled, state.turn, state.phase, state.stateSeq, localRole, legalMoves, isRollingAnim, handleSelectPawn]);

  // ==================== MERCY RULE 8-SECOND DECISION COUNTDOWN ====================
  useEffect(() => {
    if (state.phase !== 'MERCY_OFFER' || state.pendingMercy?.stage !== 'choose') {
      setMercyCountdownMs(PARCHISI_MERCY_COUNTDOWN_SEC * 1000);
      return;
    }
    const startMs = performance.now();
    const totalMs = PARCHISI_MERCY_COUNTDOWN_SEC * 1000;
    setMercyCountdownMs(totalMs);

    const intervalId = window.setInterval(() => {
      const rem = Math.max(0, totalMs - (performance.now() - startMs));
      setMercyCountdownMs(rem);
    }, 100);

    let timeoutId: number | null = null;
    if (isHost) {
      timeoutId = window.setTimeout(() => {
        const cur = stateRef.current;
        if (cur.phase === 'MERCY_OFFER' && cur.pendingMercy?.stage === 'choose') {
          commitHostState(resolveParchisiMercy(cur, 'no_mercy'));
        }
      }, totalMs + 120);
    }

    return () => {
      window.clearInterval(intervalId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [state.phase, state.pendingMercy?.stage, state.stateSeq, isHost, commitHostState]);

  // ==================== SMART SOLO AI ("CAMILLE IA") ====================
  useEffect(() => {
    if (!isSolo) return;

    // Case A: AI's turn to roll (0.8s delay)
    if (state.turn === 'guest' && state.phase === 'WAIT_ROLL') {
      const delay = isAnimatingMoveRef.current ? 1100 : 800;
      const tid = window.setTimeout(() => {
        executeHostAction('guest', 'ROLL');
      }, delay);
      return () => window.clearTimeout(tid);
    }

    // Case B: AI's turn to pick best move (0.7s delay)
    if (
      state.turn === 'guest' &&
      (state.phase === 'WAIT_MOVE' || state.phase === 'BONUS_20' || state.phase === 'BONUS_10') &&
      legalMoves.length > 0
    ) {
      const tid = window.setTimeout(() => {
        const chosen = chooseAiParchisiMove(stateRef.current);
        if (chosen !== null) {
          executeHostAction('guest', 'MOVE_PAWN', { pawnId: chosen });
        }
      }, 700);
      return () => window.clearTimeout(tid);
    }

    // Case C: AI drew a Karma card -> display briefly then dismiss
    if (state.turn === 'guest' && state.phase === 'KARMA_CARD') {
      const tid = window.setTimeout(() => {
        executeHostAction('guest', 'DISMISS_CARD');
      }, 1850);
      return () => window.clearTimeout(tid);
    }

    // Case D: Mercy Rule interactions with AI
    if (state.phase === 'MERCY_OFFER' && state.pendingMercy) {
      const m = state.pendingMercy;
      if (m.capturer === 'guest' && m.stage === 'choose') {
        // AI playfully offers a dare ~50% of the time so solo players experience the Mercy Rule!
        const tid = window.setTimeout(() => {
          const offerDare = Math.random() < 0.55;
          executeHostAction('guest', 'MERCY_DECISION', {
            mercyChoice: offerDare ? 'offer_dare' : 'no_mercy',
          });
        }, 1200);
        return () => window.clearTimeout(tid);
      }
      if (m.victim === 'guest' && m.stage === 'waiting_partner') {
        // Host offered AI a dare -> AI accepts enthusiastically!
        const tid = window.setTimeout(() => {
          executeHostAction('guest', 'MERCY_DECISION', { mercyChoice: 'accept_dare' });
        }, 900);
        return () => window.clearTimeout(tid);
      }
      if (m.capturer === 'guest' && m.stage === 'partner_performing') {
        // Host accepted AI's dare -> AI watches for 2.4s then validates and spares Host's pawn!
        const tid = window.setTimeout(() => {
          spawnFloatingEmote('lucky', 'guest');
          executeHostAction('guest', 'MERCY_DECISION', { mercyChoice: 'validate_dare' });
        }, 2400);
        return () => window.clearTimeout(tid);
      }
    }
  }, [isSolo, state.turn, state.phase, state.pendingMercy, state.stateSeq, legalMoves.length, executeHostAction, spawnFloatingEmote]);

  // ==================== OPTIONAL MEDIAPIPE HAND SHAKE-TO-ROLL LOOP ====================
  useEffect(() => {
    if (!handDiceEnabled) {
      setShakeIntensity(0);
      shakeStateRef.current = createHandShakeState();
      return;
    }

    let rafId = 0;
    let lastMs = performance.now();

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastMs) * 0.001));
      lastMs = now;

      const cur = stateRef.current;
      const canRollNow = cur.phase === 'WAIT_ROLL' && cur.turn === localRole;
      if (!canRollNow) {
        setShakeIntensity(0);
        return;
      }

      const hm = localHandMetricsRef.current;
      const res = stepHandShakeDetector(shakeStateRef.current, hm.handDetected, hm.palmX, dt);
      shakeStateRef.current = res.next;
      setShakeIntensity(res.intensity);

      if (res.triggered) {
        handleRoll();
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [handDiceEnabled, localRole, localHandMetricsRef, handleRoll]);

  // Keyboard shortcut: Enter/Space starts from READY or rolls die on your turn
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (stateRef.current.phase === 'READY') {
          e.preventDefault();
          handleStartMatch(selectedMode);
        } else if (stateRef.current.phase === 'WAIT_ROLL' && stateRef.current.turn === localRole) {
          e.preventDefault();
          handleRoll();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedMode, localRole, handleStartMatch, handleRoll]);

  // Derived HUD strings & counts
  const canLocalRoll = state.phase === 'WAIT_ROLL' && state.turn === localRole && !isRollingAnim;
  const hostFinished = state.pawns.host.filter((p) => p.progress >= PARCHISI_THRONE_PROGRESS).length;
  const guestFinished = state.pawns.guest.filter((p) => p.progress >= PARCHISI_THRONE_PROGRESS).length;
  const activePlayerName = state.turn === 'host' ? hostName : guestName;
  const activeAccent = state.turn === 'host' ? '#F43F5E' : '#06B6D4';
  const allMyPawnsOut = areAllPawnsOut(state.pawns, localRole);

  const turnStatusLine = useMemo(() => {
    if (statusBannerToast) return statusBannerToast;
    if (state.phase === 'READY') return t.parchisiTitle;
    if (state.phase === 'GAME_OVER') {
      const winnerName = state.winner === 'host' ? hostName : guestName;
      return `👑 ${winnerName} — ${t.parchisiVictoryTitle}`;
    }
    if (state.turn === localRole) {
      if (state.phase === 'WAIT_ROLL') return t.parchisiYourTurnRoll;
      if (state.phase === 'BONUS_20') return t.parchisiBonus20Prompt;
      if (state.phase === 'BONUS_10') return t.parchisiBonus10Prompt;
      if (state.phase === 'WAIT_MOVE') return t.parchisiYourTurnMove;
    }
    if (isSolo && state.turn === 'guest') {
      return `⭐ ${guestName} ${t.parchisiAiThinking}`;
    }
    return `${t.parchisiPartnerTurn} ${activePlayerName}`;
  }, [
    statusBannerToast,
    state.phase,
    state.turn,
    state.winner,
    localRole,
    hostName,
    guestName,
    activePlayerName,
    isSolo,
    t,
  ]);

  const formatHistoryEntry = (code: string): string => {
    switch (code) {
      case 'PAWN_EXIT':
        return '🚀 Pion sorti sur le plateau';
      case 'PAWN_MOVED':
        return '✨ Pion avancé';
      case 'CAPTURE_OFFER':
        return '⚔️ Capture Royale !';
      case 'CAPTURE_BONUS_20':
        return '🔥 Sans pitié ! Bonus +20';
      case 'MERCY_SAVED_BONUS_10':
        return '💘 Gage validé · Épargné (+10)';
      case 'THRONE_BONUS_10':
        return '👑 Entrée au Trône ! (+10)';
      case 'TRIPLE_SIX_CURSED':
        return '⚡ Triple 6 ! Retour maison';
      case 'TRIPLE_SIX_SPARED':
        return '⚡ Triple 6 ! Couloir protégé';
      case 'NO_MOVES':
        return '⏭️ Aucun coup possible';
      case 'VICTORY':
        return '👑 Victoire Royale !';
      default:
        if (code.startsWith('KARMA_')) return '❤️ Carte Karma Couple';
        return code;
    }
  };

  const activeKarmaCard = state.activeKarma
    ? t.parchisiKarmaCards[state.activeKarma.cardId % t.parchisiKarmaCards.length]
    : null;
  const activeKarmaDef = state.activeKarma
    ? PARCHISI_KARMA_DECK[state.activeKarma.cardId % PARCHISI_KARMA_DECK.length]
    : null;

  const mercyDareText = state.pendingMercy
    ? t.parchisiMercyDares[state.pendingMercy.dareIndex % t.parchisiMercyDares.length]
    : '';
  const finalDareText = t.parchisiFinalDares[state.finalDareIndex % t.parchisiFinalDares.length];

  return (
    <div
      data-testid="parchisi-game-root"
      className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col select-none"
      style={{
        background:
          'radial-gradient(circle at 18% 12%, rgba(244,63,94,0.22), transparent 42%), radial-gradient(circle at 84% 16%, rgba(6,182,212,0.22), transparent 42%), linear-gradient(150deg, #100A26 0%, #1B1142 52%, #190D33 100%)',
      }}
    >
      {/* ==================== MAIN RESPONSIVE ROYAL LAYOUT ==================== */}
      <div className="relative z-10 flex-1 min-h-0 w-full max-w-[1400px] mx-auto px-1.5 sm:px-3.5 py-1 sm:py-2 flex flex-col lg:grid lg:grid-cols-[224px_minmax(0,1fr)_232px] gap-1 sm:gap-3 overflow-hidden">
        {/* ==================== MOBILE-ONLY COMPACT STATUS + TOGGLES ROW ==================== */}
        <div className="lg:hidden shrink-0">
          <div className="flex items-center gap-1">
            <div
              data-testid="parchisi-status-banner-mobile"
              style={{ borderColor: `${activeAccent}80` }}
              className="flex-1 min-w-0 h-8 px-2.5 rounded-xl bg-[#150E30]/90 border flex items-center gap-2"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeAccent, boxShadow: `0 0 10px ${activeAccent}` }}
              />
              <span className="text-[11.5px] font-extrabold text-white truncate">{turnStatusLine}</span>
            </div>

            <button
              type="button"
              onClick={() => onToggleHandDice(!handDiceEnabled)}
              title={t.parchisiHandDiceToggle}
              aria-pressed={handDiceEnabled}
              className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                handDiceEnabled
                  ? 'bg-[#F59E0B] text-[#140C29] border-[#FDE68A]'
                  : 'bg-white/10 text-white/85 border-white/15'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAutoMoveEnabled((v) => !v)}
              title={t.parchisiAutoMoveToggle}
              aria-pressed={autoMoveEnabled}
              className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                autoMoveEnabled
                  ? 'bg-[#06B6D4] text-[#082F49] border-[#A5F3FC]'
                  : 'bg-white/10 text-white/85 border-white/15'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ==================== DESKTOP LEFT COLUMN: SCOREBOARD + TOGGLES ==================== */}
        <aside className="hidden lg:flex flex-col gap-3 min-h-0 overflow-hidden justify-between">

          {/* Royal Couple Scoreboard */}
          <div className="rounded-3xl bg-[#181036]/85 border border-[#F59E0B]/30 p-3.5 space-y-2.5 shadow-xl">
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-[#FDE68A]">
              <span className="flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-[#FACC15]" />
                Royal Love
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/90">
                {state.mode === 'express' ? '⚡ Express' : '👑 Classique'}
              </span>
            </div>

            {/* Host Row */}
            <div
              className={`rounded-2xl p-2.5 border transition-all ${
                state.turn === 'host'
                  ? 'bg-[#F43F5E]/22 border-[#FDA4AF]/70'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-white truncate">❤️ {hostName}</span>
                <span className="text-xs font-black text-[#FDA4AF] tabular-nums">{hostFinished}/4 👑</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-white/75 tabular-nums">
                <span>⚔️ {state.stats.host.captures}</span>
                <span>🎲6 ×{state.stats.host.sixesRolled}</span>
                {state.stats.host.tenderHearts > 0 && (
                  <span className="text-[#FDA4AF] font-bold">💖 {t.parchisiTenderHeartBadge}</span>
                )}
              </div>
            </div>

            {/* Guest Row */}
            <div
              className={`rounded-2xl p-2.5 border transition-all ${
                state.turn === 'guest'
                  ? 'bg-[#06B6D4]/22 border-[#67E8F9]/70'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-white truncate">⭐ {guestName}</span>
                <span className="text-xs font-black text-[#67E8F9] tabular-nums">{guestFinished}/4 👑</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-white/75 tabular-nums">
                <span>⚔️ {state.stats.guest.captures}</span>
                <span>🎲6 ×{state.stats.guest.sixesRolled}</span>
                {state.stats.guest.tenderHearts > 0 && (
                  <span className="text-[#67E8F9] font-bold">💖 {t.parchisiTenderHeartBadge}</span>
                )}
              </div>
            </div>
          </div>

          {/* Controls: Hand-Shake Dice & Auto-Move */}
          <div className="rounded-3xl bg-[#181036]/85 border border-white/15 p-3 space-y-2 mt-auto">
            <button
              type="button"
              data-testid="parchisi-hand-dice-toggle"
              aria-pressed={handDiceEnabled}
              onClick={() => onToggleHandDice(!handDiceEnabled)}
              className={`w-full min-h-[42px] px-3 py-2 rounded-2xl border text-xs font-extrabold flex items-center justify-between gap-2 transition-all ${
                handDiceEnabled
                  ? 'bg-gradient-to-r from-[#F59E0B] to-[#FACC15] text-[#1A1033] border-[#FEF08A]'
                  : 'bg-white/8 hover:bg-white/14 text-white border-white/15'
              }`}
            >
              <span className="flex items-center gap-2">
                <Hand className="w-4 h-4 shrink-0" />
                ✋ {t.parchisiHandDiceToggle}
              </span>
              <span className="text-[10px] uppercase font-black">
                {handDiceEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            {handDiceEnabled && (
              <div className="space-y-1 px-1">
                <p className="text-[11px] text-[#FDE68A] leading-tight">
                  {t.parchisiHandShakeHint}
                </p>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#F59E0B] to-[#F43F5E] transition-all duration-75"
                    style={{ width: `${Math.round(shakeIntensity * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              data-testid="parchisi-automove-toggle"
              aria-pressed={autoMoveEnabled}
              onClick={() => setAutoMoveEnabled((v) => !v)}
              className={`w-full min-h-[42px] px-3 py-2 rounded-2xl border text-xs font-extrabold flex items-center justify-between gap-2 transition-all ${
                autoMoveEnabled
                  ? 'bg-[#06B6D4]/25 text-[#A5F3FC] border-[#22D3EE]/60'
                  : 'bg-white/8 hover:bg-white/14 text-white/90 border-white/15'
              }`}
            >
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 shrink-0" />
                {t.parchisiAutoMoveToggle}
              </span>
              <span className="text-[10px] uppercase font-black">
                {autoMoveEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </aside>

        {/* ==================== CENTER COLUMN: DESKTOP STATUS BAR + SQUARE 68-CASE VECTOR BOARD ==================== */}
        <main className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 overflow-hidden">
          {/* Desktop Turn Status Banner */}
          <div
            data-testid="parchisi-status-banner"
            style={{ borderColor: `${activeAccent}88` }}
            className="hidden lg:flex shrink-0 w-full max-w-[680px] h-11 px-4 rounded-2xl bg-[#160F33]/92 border items-center justify-between gap-3 shadow-lg"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: activeAccent, boxShadow: `0 0 12px ${activeAccent}` }}
              />
              <span className="text-sm font-extrabold text-white truncate">{turnStatusLine}</span>
            </div>
            {state.dieValue !== null && state.phase !== 'READY' && (
              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/50 text-xs font-extrabold text-[#FDE68A] tabular-nums">
                🎲 {state.dieValue}
                {state.dieValue === 6 && state.effectiveSteps === 7 ? ' → 7!' : ''}
              </span>
            )}
          </div>

          {/* Perfectly Constrained Square Board Container (aspect-square + max-h-[85dvh], zero overflow on any mobile screen!) */}
          <div
            className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
            style={{ containerType: 'size' }}
          >
            <div
              data-testid="parchisi-board-frame"
              className="relative aspect-square max-h-[85dvh] max-w-full"
              style={{
                width: 'min(100cqw, 100cqh, 85dvh)',
                height: 'min(100cqw, 100cqh, 85dvh)',
              }}
            >
              <ParchisiBoardSvg
                state={state}
                localRole={localRole}
                hostName={hostName}
                guestName={guestName}
                legalMoves={legalMoves}
                hoveredPawnId={hoveredPawnId}
                onHoverPawn={setHoveredPawnId}
                onSelectPawn={handleSelectPawn}
                animOverride={animOverride}
                floatingEmotes={floatingEmotes}
              />

              {/* FLOATING z-50 MINI-VIGNETTE #1: PARTNER CAMERA IN TOP-LEFT DECORATIVE CORNER */}
              <div
                data-testid="parchisi-cam-partner"
                className={`absolute top-[3%] left-[3%] w-[30.8%] h-[30.8%] z-50 rounded-xl sm:rounded-2xl overflow-hidden bg-[#142240]/95 border-2 shadow-xl shadow-black/70 transition-all ${
                  state.turn !== localRole
                    ? 'border-[#FACC15] ring-2 ring-[#FACC15]/35'
                    : 'border-[#38BDF8]/55'
                }`}
              >
                {showRemoteLiveVideo ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <AvatarCanvas
                    name={partnerName}
                    metricsRef={partnerFaceMetricsRef}
                    accentColor="#38BDF8"
                    bgTop="#1E2C59"
                    bgBottom="#111833"
                    isAi={isSolo}
                  />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#090617]/95 via-[#090617]/55 to-transparent" />
                <div className="pointer-events-none absolute inset-x-1.5 bottom-1 flex items-center justify-between gap-1">
                  <span className="text-[9.5px] sm:text-[11px] font-extrabold text-white truncate drop-shadow">
                    {partnerName}
                  </span>
                  <span className="shrink-0 text-[9.5px] sm:text-[10.5px] font-black text-[#67E8F9] tabular-nums drop-shadow">
                    {localRole === 'host' ? '⭐' : '❤️'} {localRole === 'host' ? guestFinished : hostFinished}/4
                  </span>
                </div>
              </div>

              {/* FLOATING z-50 MINI-VIGNETTE #2: LOCAL CAMERA IN OPPOSITE BOTTOM-RIGHT DECORATIVE CORNER */}
              <div
                data-testid="parchisi-cam-local"
                className={`absolute bottom-[3%] right-[3%] w-[30.8%] h-[30.8%] z-50 rounded-xl sm:rounded-2xl overflow-hidden bg-[#1D1540]/95 border-2 shadow-xl shadow-black/70 transition-all ${
                  state.turn === localRole
                    ? 'border-[#FACC15] ring-2 ring-[#FACC15]/35'
                    : 'border-[#FB7185]/55'
                }`}
              >
                {showLocalLiveVideo ? (
                  <video
                    ref={(el) => {
                      localVideoRef.current = el;
                      if (el) onVideoRef(el);
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror-video"
                  />
                ) : (
                  <AvatarCanvas
                    name={localName}
                    metricsRef={localFaceMetricsRef}
                    accentColor="#FF4D8D"
                    bgTop="#2C1E59"
                    bgBottom="#15102B"
                  />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#090617]/95 via-[#090617]/55 to-transparent" />
                <div className="pointer-events-none absolute inset-x-1.5 bottom-1 flex items-center justify-between gap-1">
                  <span className="text-[9.5px] sm:text-[11px] font-extrabold text-white truncate drop-shadow">
                    {localName}
                  </span>
                  <span className="shrink-0 text-[9.5px] sm:text-[10.5px] font-black text-[#FDA4AF] tabular-nums drop-shadow">
                    {localRole === 'host' ? '❤️' : '⭐'} {localRole === 'host' ? hostFinished : guestFinished}/4
                  </span>
                </div>

                {/* Top status / one-tap enable camera controls inside local mini-vignette */}
                <div className="absolute top-1 inset-x-1 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {micMuted && (
                      <span
                        title={t.micMuted}
                        className="w-5 h-5 rounded-md bg-black/70 border border-rose-400/50 text-rose-300 flex items-center justify-center"
                      >
                        <MicOff className="w-3 h-3" />
                      </span>
                    )}
                    {handDiceEnabled && handTrackerStatus === 'ready' && (
                      <span
                        title={t.parchisiHandDiceToggle}
                        className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black/60"
                      />
                    )}
                  </div>
                  {!showLocalLiveVideo && (
                    <button
                      type="button"
                      onClick={onRequestCamera}
                      aria-label={t.enableCamera}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#120C28]/82 hover:bg-[#1E1442] border border-white/25 text-white flex items-center justify-center shadow"
                    >
                      <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ==================== DESKTOP RIGHT COLUMN: ROYAL DICE + EMOTES + LOG ==================== */}
        <aside className="hidden lg:flex flex-col gap-3 min-h-0 overflow-hidden">

          {/* Royal Dice Roll Panel */}
          <div className="rounded-3xl bg-[#181036]/90 border border-[#F59E0B]/35 p-4 flex flex-col items-center gap-3 shadow-xl">
            <ParchisiDice3D
              value={displayDieFace ?? state.dieValue}
              rolling={isRollingAnim}
              shakeIntensity={shakeIntensity}
              accentColor={activeAccent}
              disabled={!canLocalRoll}
              canRoll={canLocalRoll}
              onRoll={handleRoll}
              ariaLabel={t.parchisiRollBtn}
            />

            <button
              type="button"
              data-testid="parchisi-roll-btn"
              disabled={!canLocalRoll}
              onClick={handleRoll}
              style={
                canLocalRoll
                  ? {
                      background:
                        localRole === 'host'
                          ? 'linear-gradient(135deg, #F43F5E 0%, #F59E0B 100%)'
                          : 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
                    }
                  : undefined
              }
              className={`w-full min-h-[46px] px-4 py-2.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                canLocalRoll
                  ? 'text-white shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-white/10 text-white/45 cursor-not-allowed'
              }`}
            >
              <Dices className="w-4 h-4" />
              <span>{t.parchisiRollBtn}</span>
            </button>

            {allMyPawnsOut && state.phase !== 'READY' && (
              <span className="text-[11px] font-bold text-[#FDE68A] text-center">
                {t.parchisiSixBonusSeven}
              </span>
            )}
          </div>

          {/* 4 Quick Live Teasing Emotes */}
          <div className="rounded-3xl bg-[#181036]/85 border border-white/15 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {EMOTE_LIST.map((em) => (
                <button
                  key={em.kind}
                  type="button"
                  data-testid={`parchisi-emote-${em.kind}`}
                  onClick={() => handleSendEmote(em.kind)}
                  className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white/8 hover:bg-white/16 active:scale-95 border border-white/15 text-xs font-extrabold text-white flex items-center justify-center gap-1.5 transition-all"
                >
                  <span className="text-base">{em.emoji}</span>
                  <span className="truncate">{t.parchisiEmotes[em.kind]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Compact Turn Log */}
          <div className="rounded-3xl bg-[#181036]/75 border border-white/10 p-3 flex-1 min-h-0 overflow-hidden flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/60">
              <Shield className="w-3.5 h-3.5 text-[#FACC15]" />
              Journal Royal
            </div>
            <div className="space-y-1 overflow-hidden text-xs text-white/80">
              {state.history.length === 0 ? (
                <p className="text-white/45 text-[11px]">★ 12 Cases Safe · ♥ 4 Cartes Karma</p>
              ) : (
                state.history.slice(0, 3).map((entry, idx) => (
                  <p key={`${entry}-${idx}`} className="truncate text-[11px]">
                    {formatHistoryEntry(entry)}
                  </p>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* ==================== MOBILE-ONLY BOTTOM THUMB-FRIENDLY DICE & EMOTE DOCK ==================== */}
        <div className="lg:hidden shrink-0 rounded-2xl bg-[#160F33]/94 border border-[#F59E0B]/30 px-2 py-1.5 space-y-1 shadow-2xl">
          <div className="flex items-center gap-2">
            <ParchisiDice3D
              value={displayDieFace ?? state.dieValue}
              rolling={isRollingAnim}
              shakeIntensity={shakeIntensity}
              accentColor={activeAccent}
              disabled={!canLocalRoll}
              canRoll={canLocalRoll}
              onRoll={handleRoll}
              ariaLabel={t.parchisiRollBtn}
            />

            <button
              type="button"
              data-testid="parchisi-roll-btn-mobile"
              disabled={!canLocalRoll}
              onClick={handleRoll}
              style={
                canLocalRoll
                  ? {
                      background:
                        localRole === 'host'
                          ? 'linear-gradient(135deg, #F43F5E 0%, #F59E0B 100%)'
                          : 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
                    }
                  : undefined
              }
              className={`flex-1 min-h-[44px] px-4 py-2 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                canLocalRoll
                  ? 'text-white shadow-lg active:scale-[0.97]'
                  : 'bg-white/10 text-white/50 cursor-not-allowed'
              }`}
            >
              <Dices className="w-4 h-4 shrink-0" />
              <span>{t.parchisiRollBtn}</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {EMOTE_LIST.map((em) => (
              <button
                key={em.kind}
                type="button"
                onClick={() => handleSendEmote(em.kind)}
                className="min-h-[32px] px-1 py-0.5 rounded-xl bg-white/8 active:scale-95 border border-white/12 text-[10px] font-bold text-white flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <span className="text-xs">{em.emoji}</span>
                <span>{t.parchisiEmotes[em.kind]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== ROOT-LEVEL VIEWPORT-SAFE MODALS (NEVER CLIPPED ON MOBILE!) ==================== */}

      {/* READY / MODE SELECT MODAL */}
      {state.phase === 'READY' && (
        <div className="absolute inset-0 z-40 bg-[#0F0924]/82 flex justify-center overflow-y-auto p-3 sm:p-6 text-center">
          <div className="my-auto w-full max-w-sm rounded-3xl bg-[#160E32]/96 border border-[#F59E0B]/55 p-3.5 sm:p-5 shadow-2xl shadow-black/75 space-y-2.5 sm:space-y-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/50 text-[10.5px] sm:text-[11px] font-extrabold text-[#FDE68A]">
                <Crown className="w-3.5 h-3.5" />
                {lang === 'en'
                  ? 'Royal Love Edition · 68 Squares'
                  : lang === 'ar'
                    ? 'إصدار الحب الملكي · 68 خانة'
                    : 'Royal Love Edition · 68 Cases'}
              </span>
              <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                {t.parchisiTitle}
              </h1>
              <p className="text-xs sm:text-sm text-white/80 leading-snug sm:leading-relaxed">
                {t.parchisiDesc}
              </p>
            </div>

            {/* 2 Mode Selector Cards */}
            <div className="grid grid-cols-1 gap-2 text-start">
              <button
                type="button"
                data-testid="parchisi-mode-express"
                onClick={() => setSelectedMode('express')}
                className={`p-2.5 sm:p-3 rounded-2xl border transition-all ${
                  selectedMode === 'express'
                    ? 'bg-gradient-to-r from-[#F43F5E]/30 to-[#F59E0B]/25 border-[#FACC15] shadow-lg shadow-[#F59E0B]/20'
                    : 'bg-white/8 border-white/15 hover:bg-white/12'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-white">
                    {t.parchisiModeExpress}
                  </span>
                  {selectedMode === 'express' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FACC15] text-[#1A1033] shrink-0">
                      {lang === 'en' ? 'Recommended' : lang === 'ar' ? 'مُوصى به' : 'Recommandé'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/75 mt-0.5 leading-snug">
                  {t.parchisiModeExpressHint}
                </p>
              </button>

              <button
                type="button"
                data-testid="parchisi-mode-classic"
                onClick={() => setSelectedMode('classic')}
                className={`p-2.5 sm:p-3 rounded-2xl border transition-all ${
                  selectedMode === 'classic'
                    ? 'bg-gradient-to-r from-[#06B6D4]/30 to-[#6366F1]/25 border-[#67E8F9] shadow-lg shadow-[#06B6D4]/20'
                    : 'bg-white/8 border-white/15 hover:bg-white/12'
                }`}
              >
                <div className="text-sm font-extrabold text-white">
                  {t.parchisiModeClassic}
                </div>
                <p className="text-[11px] text-white/75 mt-0.5 leading-snug">
                  {t.parchisiModeClassicHint}
                </p>
              </button>
            </div>

            <button
              type="button"
              data-start="true"
              data-testid="parchisi-start-btn"
              onClick={() => handleStartMatch(selectedMode)}
              className="btn-shine w-full min-h-[48px] px-5 py-3 rounded-2xl font-black text-sm sm:text-base text-[#190F33] bg-gradient-to-r from-[#FDE047] via-[#F59E0B] to-[#FB7185] shadow-xl shadow-[#F59E0B]/35 hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <Dices className="w-5 h-5" />
              {t.parchisiStartBtn}
            </button>
          </div>
        </div>
      )}

      {/* MERCY RULE ("RACHAT PAR GAGE") MODAL */}
      {state.phase === 'MERCY_OFFER' && state.pendingMercy && (
        <div
          data-testid="parchisi-mercy-modal"
          className="absolute inset-0 z-40 bg-[#120826]/84 flex justify-center overflow-y-auto p-3 sm:p-4"
        >
          <div className="my-auto w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#2B124C] to-[#170C30] border-2 border-[#FB7185]/70 p-4 sm:p-5 text-center space-y-3.5 shadow-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F43F5E]/25 border border-[#FDA4AF]/50 text-xs font-extrabold text-[#FFE4E6]">
              <Heart className="w-3.5 h-3.5 fill-current" />
              {t.parchisiMercyTitle}
            </div>

            {/* Stage 1: Capturer chooses within 8s */}
            {state.pendingMercy.stage === 'choose' && (
              <>
                {state.pendingMercy.capturer === localRole ? (
                  <div className="space-y-3">
                    <p className="text-xs sm:text-sm text-white/90 font-semibold">
                      {t.parchisiMercySub}
                    </p>
                    <div className="rounded-2xl bg-black/30 border border-[#F59E0B]/35 p-2.5 text-xs text-[#FDE68A] font-semibold">
                      💘 « {mercyDareText} »
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#FACC15] to-[#F43F5E] transition-all duration-100"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                (mercyCountdownMs / (PARCHISI_MERCY_COUNTDOWN_SEC * 1000)) * 100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] font-bold text-white/70 tabular-nums">
                        {(mercyCountdownMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => handleMercyDecision('no_mercy')}
                        className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#EF4444] to-[#F43F5E] text-white font-extrabold text-xs sm:text-sm shadow-lg"
                      >
                        {t.parchisiMercyNoMercyBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMercyDecision('offer_dare')}
                        className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#F59E0B] to-[#EC4899] text-white font-extrabold text-xs sm:text-sm shadow-lg"
                      >
                        {t.parchisiMercyOfferDareBtn}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-2">
                    <p className="text-sm font-bold text-white">
                      {state.pendingMercy.capturer === 'host' ? hostName : guestName}{' '}
                      décide du sort de ton pion…
                    </p>
                    <p className="text-xs text-[#FDE68A] tabular-nums">
                      {(mercyCountdownMs / 1000).toFixed(1)}s
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Stage 2: Partner decides to accept or decline the dare */}
            {state.pendingMercy.stage === 'waiting_partner' && (
              <div className="space-y-3">
                <p className="text-xs sm:text-sm font-bold text-white">
                  {state.pendingMercy.victim === localRole
                    ? t.parchisiMercyPartnerOffered
                    : t.parchisiMercyWaitingPartner}
                </p>
                <div className="rounded-2xl bg-black/35 border border-[#F59E0B]/45 p-3 text-sm font-bold text-[#FEF08A]">
                  « {mercyDareText} »
                </div>
                {state.pendingMercy.victim === localRole && (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => handleMercyDecision('accept_dare')}
                      className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#EC4899] to-[#F59E0B] text-white font-extrabold text-xs sm:text-sm"
                    >
                      {t.parchisiMercyAcceptBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMercyDecision('decline_dare')}
                      className="min-h-[40px] px-4 py-2 rounded-2xl bg-white/10 text-white/80 font-bold text-xs"
                    >
                      {t.parchisiMercyDeclineBtn}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stage 3: Victim performing dare on webcam -> Capturer validates! */}
            {state.pendingMercy.stage === 'partner_performing' && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-black/35 border border-[#F59E0B]/45 p-3 text-sm font-bold text-[#FEF08A]">
                  « {mercyDareText} »
                </div>
                {state.pendingMercy.capturer === localRole ? (
                  <>
                    <p className="text-xs text-white/85">
                      {isSolo
                        ? `${guestName} ${t.parchisiMercyAiPerforming}`
                        : 'Regarde ton/ta partenaire à la caméra et valide son gage !'}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => handleMercyDecision('validate_dare')}
                        className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#10B981] to-[#06B6D4] text-[#052E16] font-black text-xs sm:text-sm"
                      >
                        {t.parchisiMercyValidateBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMercyDecision('no_mercy')}
                        className="min-h-[40px] px-4 py-2 rounded-2xl bg-white/10 text-white/80 font-bold text-xs"
                      >
                        {t.parchisiMercyCancelBtn}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs font-bold text-[#67E8F9] animate-pulse">
                    🎥 À toi de jouer devant la caméra ! En attente de validation…
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* KARMA COUPLE CARD MODAL */}
      {state.phase === 'KARMA_CARD' && state.activeKarma && activeKarmaCard && activeKarmaDef && (
        <div
          data-testid="parchisi-karma-modal"
          className="absolute inset-0 z-40 bg-[#120826]/84 flex justify-center overflow-y-auto p-3 sm:p-4"
        >
          <div className="my-auto w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#4C0519] via-[#2B124C] to-[#170C30] border-2 border-[#F59E0B] p-5 text-center space-y-3.5 shadow-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F59E0B]/20 border border-[#FDE68A]/50 text-xs font-extrabold text-[#FDE68A]">
              <Sparkles className="w-3.5 h-3.5" />
              {t.parchisiKarmaTitle}
            </div>
            <div className="text-4xl">{activeKarmaDef.emoji}</div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              {activeKarmaCard.title}
            </h2>
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
              {activeKarmaCard.body}
            </p>
            {state.activeKarma.triggeredBy === localRole ? (
              <button
                type="button"
                data-testid="parchisi-karma-continue"
                onClick={handleDismissKarma}
                className="w-full min-h-[44px] px-5 py-2.5 rounded-2xl font-black text-sm text-[#1A1033] bg-gradient-to-r from-[#FDE047] to-[#F59E0B] shadow-lg"
              >
                {t.parchisiKarmaContinueBtn}
              </button>
            ) : (
              <p className="text-xs text-[#FDE68A] font-bold">
                {state.activeKarma.triggeredBy === 'host' ? hostName : guestName} lit sa carte…
              </p>
            )}
          </div>
        </div>
      )}

      {/* GAME OVER VICTORY MODAL */}
      {state.phase === 'GAME_OVER' && state.winner && (
        <div
          data-testid="parchisi-victory-modal"
          className="absolute inset-0 z-40 bg-[#0E0720]/88 flex justify-center overflow-y-auto p-3 sm:p-4"
        >
          {/* Festive Confetti Dots */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                style={{
                  left: `${(i * 19) % 96}%`,
                  top: `${(i * 29) % 90}%`,
                  backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                }}
                className="absolute w-2.5 h-2.5 rounded-sm opacity-75 animate-bounce"
              />
            ))}
          </div>

          <div className="my-auto relative z-10 w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#2A1452] to-[#140B2D] border-2 border-[#FACC15] p-4 sm:p-5 text-center space-y-3 sm:space-y-3.5 shadow-2xl">
            <div className="text-4xl">👑</div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#FDE68A]">
                {t.parchisiVictoryTitle}
              </p>
              <h2 className="text-2xl font-black text-white mt-0.5">
                {state.winner === 'host' ? hostName : guestName}{' '}
                {lang === 'en' ? 'wins!' : lang === 'ar' ? 'يفوز!' : 'gagne !'}
              </h2>
            </div>

            {/* 3 Tabular Couple Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/8 border border-white/10 p-2">
                <div className="text-lg font-black text-[#FDA4AF] tabular-nums">
                  {state.stats.host.captures + state.stats.guest.captures}
                </div>
                <div className="text-[10px] font-bold text-white/75">
                  {t.parchisiStatCaptures}
                </div>
              </div>
              <div className="rounded-2xl bg-white/8 border border-white/10 p-2">
                <div className="text-lg font-black text-[#FDE047] tabular-nums">
                  {state.stats.host.daresCompleted + state.stats.guest.daresCompleted}
                </div>
                <div className="text-[10px] font-bold text-white/75">
                  {t.parchisiStatDares}
                </div>
              </div>
              <div className="rounded-2xl bg-white/8 border border-white/10 p-2">
                <div className="text-lg font-black text-[#67E8F9] tabular-nums">
                  {state.stats.host.sixesRolled + state.stats.guest.sixesRolled}
                </div>
                <div className="text-[10px] font-bold text-white/75">
                  {t.parchisiStatSixes}
                </div>
              </div>
            </div>

            {/* Final Loser Dare */}
            <div className="rounded-2xl bg-[#4C0519]/75 border border-[#FB7185]/45 p-3 text-start">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#FDA4AF]">
                💘 {t.parchisiFinalDareLabel}
              </p>
              <p className="text-xs font-semibold text-white mt-1 leading-relaxed">
                {finalDareText}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-start="true"
                onClick={() => handleStartMatch(state.mode)}
                className="min-h-[44px] px-3 py-2.5 rounded-2xl font-black text-xs sm:text-sm text-[#190F33] bg-gradient-to-r from-[#FDE047] to-[#F59E0B] flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                {t.playAgain}
              </button>
              <button
                type="button"
                onClick={onReturnToHub}
                className="min-h-[44px] px-3 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-white/12 border border-white/20"
              >
                {t.changeGame}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
