import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Clock,
  Heart,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  HandMetrics,
  PeerMessage,
  TrackerStatus,
  XoNeonState,
  XoSymbolTheme,
  XoVariant,
} from '../types/duoplay';
import {
  applyXoMove,
  cellIndexToCenterNorm,
  chooseAiXoMove,
  createInitialXoState,
  cursorToCellIndex,
  getFadingCellIndex,
  handleXoTurnTimeout,
  startNextXoRound,
  startXoMatch,
  XO_DEFAULT_TARGET_WINS,
  XO_HOVER_LOCK_SEC,
} from '../game/xoNeonLogic';
import { useI18n } from '../i18n/LanguageContext';
import { soundFx } from '../utils/soundFx';
import { CameraFeedTile } from './CameraFeedTile';

interface XoNeonGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micMuted: boolean;
  handTrackerStatus: TrackerStatus;
  localFaceMetricsRef: MutableRefObject<FaceMetrics>;
  partnerFaceMetricsRef: MutableRefObject<FaceMetrics>;
  localHandMetricsRef: MutableRefObject<HandMetrics>;
  onRecordVictory: () => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  onSendPeerRealtime: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onReturnToHub: () => void;
}

interface ConfettiPiece {
  id: number;
  leftPct: number;
  delayMs: number;
  color: string;
  rotateDeg: number;
}

function getWinLineCoords(line: number[]): { x1: number; y1: number; x2: number; y2: number } {
  const start = cellIndexToCenterNorm(line[0]);
  const end = cellIndexToCenterNorm(line[2]);
  return {
    x1: start.x * 100,
    y1: start.y * 100,
    x2: end.x * 100,
    y2: end.y * 100,
  };
}

export function XoNeonGameView({
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  micMuted,
  handTrackerStatus,
  localFaceMetricsRef,
  partnerFaceMetricsRef,
  localHandMetricsRef,
  onRecordVictory,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  onSendPeerRealtime,
  registerPeerHandler,
  onReturnToHub,
}: XoNeonGameViewProps) {
  const { t } = useI18n();
  const isSolo = connectionMode === 'solo';
  const isHost = connectionMode !== 'p2p-guest';
  const localRole: 'host' | 'guest' = isHost ? 'host' : 'guest';

  const [variant, setVariant] = useState<XoVariant>('infinite');
  const [symbolTheme, setSymbolTheme] = useState<XoSymbolTheme>('xo');
  const [targetWins, setTargetWins] = useState<number>(XO_DEFAULT_TARGET_WINS);
  const [game, setGame] = useState<XoNeonState>(() =>
    createInitialXoState('infinite', 'xo', XO_DEFAULT_TARGET_WINS),
  );
  const gameRef = useRef<XoNeonState>(game);
  gameRef.current = game;

  // Live bluff cursors (normalized 0..1 on the 3x3 board)
  const [localCursor, setLocalCursor] = useState<{ x: number; y: number; active: boolean }>({
    x: 0.5,
    y: 0.5,
    active: false,
  });
  const [partnerCursor, setPartnerCursor] = useState<{ x: number; y: number; active: boolean }>({
    x: 0.5,
    y: 0.5,
    active: false,
  });
  const partnerCursorRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0.5,
    y: 0.5,
    active: false,
  });
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [hoverProgress, setHoverProgress] = useState<number>(0);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  const boardElRef = useRef<HTMLDivElement | null>(null);
  const localPointerActiveRef = useRef(false);
  const localPointerNormRef = useRef({ x: 0.5, y: 0.5 });
  const prevPinchingRef = useRef(false);
  const hoverCellRef = useRef<number | null>(null);
  const hoverAccumRef = useRef(0);
  const lastSoundSecRef = useRef(99);
  const lastMoveSeqRef = useRef(0);
  const aiPlanRef = useRef<{
    targetCell: number | null;
    elapsedSec: number;
    durationSec: number;
    startX: number;
    startY: number;
  }>({
    targetCell: null,
    elapsedSec: 0,
    durationSec: 0.8,
    startX: 0.5,
    startY: 0.5,
  });

  const triggerConfetti = useCallback(() => {
    const palette = ['#FF4D8D', '#22D3EE', '#FACC15', '#A855F7', '#34D399'];
    const burst: ConfettiPiece[] = Array.from({ length: 28 }, (_, idx) => ({
      id: Date.now() + idx,
      leftPct: 6 + ((idx * 3.25 + Math.random() * 6) % 88),
      delayMs: Math.floor(Math.random() * 240),
      color: palette[idx % palette.length],
      rotateDeg: Math.floor(Math.random() * 360),
    }));
    setConfetti(burst);
    window.setTimeout(() => setConfetti([]), 1900);
  }, []);

  const broadcastState = useCallback(
    (s: XoNeonState) => {
      if (!isHost || isSolo) return;
      onSendPeerMessage({
        type: 'XO_STATE',
        phase: s.phase,
        variant: s.variant,
        symbolTheme: s.symbolTheme,
        board: s.board,
        hostQueue: s.hostQueue,
        guestQueue: s.guestQueue,
        turn: s.turn,
        turnTimeLeftSec: s.turnTimeLeftSec,
        round: s.round,
        targetWins: s.targetWins,
        hostWins: s.hostWins,
        guestWins: s.guestWins,
        winLine: s.winLine,
        roundWinner: s.roundWinner,
        matchWinner: s.matchWinner,
        dareIndex: s.dareIndex,
        lastPlacedCell: s.lastPlacedCell,
        moveSeq: s.moveSeq,
      });
    },
    [isHost, isSolo, onSendPeerMessage],
  );

  const commitAuthoritativeState = useCallback(
    (next: XoNeonState, placedBy?: 'host' | 'guest') => {
      gameRef.current = next;
      setGame(next);
      lastSoundSecRef.current = 99;
      hoverAccumRef.current = 0;
      setHoverProgress(0);

      if (placedBy === 'host') soundFx.xoPlaceX();
      else if (placedBy === 'guest') soundFx.xoPlaceO();

      if (next.phase === 'round_over' || next.phase === 'match_over') {
        if (next.roundWinner === 'draw') {
          soundFx.xoDraw();
        } else if (next.roundWinner) {
          soundFx.xoWin();
          triggerConfetti();
          if (next.phase === 'match_over' && next.matchWinner === localRole) {
            onRecordVictory();
          }
        }
        document.body.dataset.state = next.phase === 'match_over' ? 'gameover' : 'playing';
      } else if (next.phase === 'playing') {
        document.body.dataset.state = 'playing';
      }

      broadcastState(next);
    },
    [broadcastState, localRole, onRecordVictory, triggerConfetti],
  );

  const handleStartMatch = useCallback(
    (v: XoVariant, theme: XoSymbolTheme, winsTarget: number, broadcast: boolean) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setVariant(v);
      setSymbolTheme(theme);
      setTargetWins(winsTarget);
      aiPlanRef.current = { targetCell: null, elapsedSec: 0, durationSec: 0.8, startX: 0.5, startY: 0.5 };
      const fresh = startXoMatch(v, theme, winsTarget);
      gameRef.current = fresh;
      setGame(fresh);
      document.body.dataset.state = 'playing';
      soundFx.countdownGo();
      if (broadcast && isHost) {
        onSendPeerMessage({ type: 'XO_START', variant: v, symbolTheme: theme, targetWins: winsTarget });
        broadcastState(fresh);
      }
    },
    [broadcastState, isHost, onSendPeerMessage],
  );

  const handleNextRound = useCallback(() => {
    if (!isHost) return;
    aiPlanRef.current = { targetCell: null, elapsedSec: 0, durationSec: 0.8, startX: 0.5, startY: 0.5 };
    const next = startNextXoRound(gameRef.current);
    soundFx.click();
    commitAuthoritativeState(next);
  }, [commitAuthoritativeState, isHost]);

  const handleRematch = useCallback(() => {
    if (isHost) {
      handleStartMatch(gameRef.current.variant, gameRef.current.symbolTheme, gameRef.current.targetWins, true);
    } else {
      onSendPeerMessage({ type: 'XO_REMATCH' });
    }
  }, [handleStartMatch, isHost, onSendPeerMessage]);

  const attemptLocalMove = useCallback(
    (cellIndex: number) => {
      const cur = gameRef.current;
      if (cur.phase !== 'playing' || cur.turn !== localRole) return;
      if (cur.board[cellIndex] !== null) return;

      hoverAccumRef.current = 0;
      setHoverProgress(0);

      if (isHost) {
        const res = applyXoMove(cur, 'host', cellIndex, t.xoDares.length);
        if (res.accepted) {
          commitAuthoritativeState(res.state, 'host');
        }
      } else {
        // Guest sends move request to authoritative Host
        soundFx.xoPlaceO();
        onSendPeerMessage({ type: 'XO_MOVE', cellIndex });
      }
    },
    [commitAuthoritativeState, isHost, localRole, onSendPeerMessage, t.xoDares.length],
  );

  // PeerJS message handler
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'XO_CURSOR') {
        const nextCursor = { x: msg.x, y: msg.y, active: msg.active };
        partnerCursorRef.current = nextCursor;
        setPartnerCursor(nextCursor);
      } else if (msg.type === 'XO_START' && !isHost) {
        handleStartMatch(msg.variant, msg.symbolTheme, msg.targetWins, false);
      } else if (msg.type === 'XO_MOVE' && isHost) {
        const res = applyXoMove(gameRef.current, 'guest', msg.cellIndex, t.xoDares.length);
        if (res.accepted) {
          commitAuthoritativeState(res.state, 'guest');
        }
      } else if (msg.type === 'XO_REMATCH' && isHost) {
        handleStartMatch(
          gameRef.current.variant,
          gameRef.current.symbolTheme,
          gameRef.current.targetWins,
          true,
        );
      } else if (msg.type === 'XO_STATE' && !isHost) {
        const prevSeq = lastMoveSeqRef.current;
        lastMoveSeqRef.current = msg.moveSeq;
        const incoming: XoNeonState = {
          phase: msg.phase,
          variant: msg.variant,
          symbolTheme: msg.symbolTheme,
          board: msg.board,
          hostQueue: msg.hostQueue,
          guestQueue: msg.guestQueue,
          turn: msg.turn,
          turnDurationSec: 12,
          turnTimeLeftSec: msg.turnTimeLeftSec,
          round: msg.round,
          targetWins: msg.targetWins,
          hostWins: msg.hostWins,
          guestWins: msg.guestWins,
          winLine: msg.winLine,
          roundWinner: msg.roundWinner,
          matchWinner: msg.matchWinner,
          dareIndex: msg.dareIndex,
          lastPlacedCell: msg.lastPlacedCell,
          moveSeq: msg.moveSeq,
        };
        const prevPhase = gameRef.current.phase;
        gameRef.current = incoming;
        setGame(incoming);
        setVariant(msg.variant);
        setSymbolTheme(msg.symbolTheme);
        setTargetWins(msg.targetWins);

        if (msg.moveSeq > prevSeq && msg.lastPlacedCell !== null) {
          const placedMark = msg.board[msg.lastPlacedCell];
          if (placedMark === 'host') soundFx.xoPlaceX();
          else if (placedMark === 'guest') soundFx.xoPlaceO();
        }
        if (prevPhase === 'playing' && (msg.phase === 'round_over' || msg.phase === 'match_over')) {
          if (msg.roundWinner === 'draw') {
            soundFx.xoDraw();
          } else {
            soundFx.xoWin();
            triggerConfetti();
            if (msg.phase === 'match_over' && msg.matchWinner === 'guest') {
              onRecordVictory();
            }
          }
        }
        document.body.dataset.state =
          msg.phase === 'ready' ? 'title' : msg.phase === 'match_over' ? 'gameover' : 'playing';
      }
    });

    return () => registerPeerHandler(null);
  }, [
    commitAuthoritativeState,
    handleStartMatch,
    isHost,
    onRecordVictory,
    registerPeerHandler,
    t.xoDares.length,
    triggerConfetti,
  ]);

  // Enter / Space starts from ready screen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Enter' || e.code === 'Space') && gameRef.current.phase === 'ready' && isHost) {
        e.preventDefault();
        handleStartMatch(variant, symbolTheme, targetWins, true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStartMatch, isHost, symbolTheme, targetWins, variant]);

  // Mark initial title state once on mount
  useEffect(() => {
    document.body.dataset.state = 'title';
  }, []);

  // Main 60 FPS loop: HandLandmarker index + pinch + 1.2s hover-lock + 12s timer + Solo AI cursor + 20fps bluff cursor sync
  useEffect(() => {
    let rafId = 0;
    let lastMs = performance.now();
    let cursorSendTimer = 0;
    let timerUiAccum = 0;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastMs) * 0.001));
      lastMs = now;

      const cur = gameRef.current;

      // 1. HandLandmarker Index cursor (lerp 0.35) + Quick Pinch + 1.2s Hover-to-Lock
      const hm = localHandMetricsRef.current;
      let activeCursorX = localPointerNormRef.current.x;
      let activeCursorY = localPointerNormRef.current.y;
      let cursorVisible = localPointerActiveRef.current;
      let usedHand = false;

      if (hm.handDetected && !localPointerActiveRef.current) {
        // Map full webcam area with comfortable central margin (0.12..0.88 -> 0..1) so corners are effortless!
        activeCursorX = Math.max(0, Math.min(1, (hm.smoothIndexX - 0.12) / 0.76));
        activeCursorY = Math.max(0, Math.min(1, (hm.smoothIndexY - 0.12) / 0.76));
        cursorVisible = true;
        usedHand = true;
      }

      if (cursorVisible) {
        setLocalCursor({ x: activeCursorX, y: activeCursorY, active: true });
      } else {
        setLocalCursor((prev) => (prev.active ? { ...prev, active: false } : prev));
      }

      // Stream live bluff cursor to partner at 20 fps
      if (!isSolo && cur.phase === 'playing') {
        cursorSendTimer += dt;
        if (cursorSendTimer >= 0.05) {
          cursorSendTimer = 0;
          onSendPeerRealtime({
            type: 'XO_CURSOR',
            x: activeCursorX,
            y: activeCursorY,
            active: cursorVisible,
          });
        }
      }

      // Evaluate cell hover & validation when playing and it's local player's turn
      const cellIdx = cursorVisible ? cursorToCellIndex(activeCursorX, activeCursorY) : null;
      if (cellIdx !== hoverCellRef.current) {
        hoverCellRef.current = cellIdx;
        hoverAccumRef.current = 0;
        setHoveredCell(cellIdx);
        setHoverProgress(0);
        if (cellIdx !== null && cur.phase === 'playing' && cur.board[cellIdx] === null) {
          soundFx.xoHover();
        }
      }

      if (usedHand && cur.phase === 'playing' && cur.turn === localRole && cellIdx !== null && cur.board[cellIdx] === null) {
        const justPinched = hm.isPinching && !prevPinchingRef.current;
        if (justPinched) {
          attemptLocalMove(cellIdx);
        } else {
          // Hover-to-Lock (1.2s)
          hoverAccumRef.current += dt;
          const pct = Math.min(1, hoverAccumRef.current / XO_HOVER_LOCK_SEC);
          setHoverProgress(pct);
          if (hoverAccumRef.current >= XO_HOVER_LOCK_SEC) {
            attemptLocalMove(cellIdx);
          }
        }
      } else if (hoverAccumRef.current > 0) {
        hoverAccumRef.current = 0;
        setHoverProgress(0);
      }
      prevPinchingRef.current = hm.handDetected && hm.isPinching;

      // 2. Turn Countdown (12 seconds)
      if (cur.phase === 'playing') {
        const nextTime = Math.max(0, cur.turnTimeLeftSec - dt);
        gameRef.current = { ...cur, turnTimeLeftSec: nextTime };

        const ceilSec = Math.ceil(nextTime);
        if (ceilSec <= 3 && ceilSec >= 1 && ceilSec !== lastSoundSecRef.current) {
          lastSoundSecRef.current = ceilSec;
          soundFx.xoTimerTick(ceilSec);
        }

        timerUiAccum += dt;
        if (timerUiAccum >= 0.1) {
          timerUiAccum = 0;
          setGame((g) => (g.phase === 'playing' ? { ...g, turnTimeLeftSec: nextTime } : g));
        }

        if (isHost && nextTime <= 0) {
          const timeoutRes = handleXoTurnTimeout(gameRef.current, t.xoDares.length);
          if (timeoutRes.playedCell !== null) {
            commitAuthoritativeState(timeoutRes.state, cur.turn);
          }
        }
      }

      // 3. Solo Mode AI Partner (0.8s reflection with animated bluff cursor)
      if (isSolo && gameRef.current.phase === 'playing' && gameRef.current.turn === 'guest') {
        const plan = aiPlanRef.current;
        if (plan.targetCell === null) {
          const chosen = chooseAiXoMove(gameRef.current, 'guest');
          if (chosen !== null) {
            aiPlanRef.current = {
              targetCell: chosen,
              elapsedSec: 0,
              durationSec: 0.8,
              startX: partnerCursorRef.current.x || 0.5,
              startY: partnerCursorRef.current.y || 0.5,
            };
          }
        } else {
          plan.elapsedSec += dt;
          const targetPt = cellIndexToCenterNorm(plan.targetCell);
          const p = Math.min(1, plan.elapsedSec / plan.durationSec);
          const ease = 1 - Math.pow(1 - p, 3);
          const cx = plan.startX + (targetPt.x - plan.startX) * ease;
          const cy = plan.startY + (targetPt.y - plan.startY) * ease;

          if (p >= 1) {
            const moveCell = plan.targetCell;
            aiPlanRef.current.targetCell = null;
            const hiddenCursor = { x: cx, y: cy, active: false };
            partnerCursorRef.current = hiddenCursor;
            setPartnerCursor(hiddenCursor);
            const res = applyXoMove(gameRef.current, 'guest', moveCell, t.xoDares.length);
            if (res.accepted) {
              commitAuthoritativeState(res.state, 'guest');
            }
          } else {
            const activeCursor = { x: cx, y: cy, active: true };
            partnerCursorRef.current = activeCursor;
            setPartnerCursor(activeCursor);
          }
        }
      } else if (isSolo) {
        if (aiPlanRef.current.targetCell !== null) {
          aiPlanRef.current.targetCell = null;
        }
        if (partnerCursorRef.current.active) {
          const hiddenCursor = { ...partnerCursorRef.current, active: false };
          partnerCursorRef.current = hiddenCursor;
          setPartnerCursor(hiddenCursor);
        }
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [
    attemptLocalMove,
    commitAuthoritativeState,
    isHost,
    isSolo,
    localHandMetricsRef,
    localRole,
    onSendPeerRealtime,
    t.xoDares.length,
  ]);

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = boardElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    localPointerActiveRef.current = true;
    localPointerNormRef.current = { x: nx, y: ny };
  };

  const handleBoardPointerLeave = () => {
    localPointerActiveRef.current = false;
  };

  const fadingCell = getFadingCellIndex(game);
  const hostDisplayName = isHost ? localName : partnerName;
  const guestDisplayName = isHost ? partnerName : localName;
  const isMyTurn = game.phase === 'playing' && game.turn === localRole;
  const hasHandSensor = Boolean(localStream) && handTrackerStatus === 'ready';
  const timerPct = Math.max(0, Math.min(100, (game.turnTimeLeftSec / game.turnDurationSec) * 100));
  const dareText = t.xoDares[game.dareIndex % t.xoDares.length] ?? t.xoDares[0];

  const renderMark = (mark: 'host' | 'guest', isFading: boolean, isWinning: boolean) => {
    const isHostMark = mark === 'host';
    if (game.symbolTheme === 'hearts') {
      return isHostMark ? (
        <Heart
          className={`w-12 h-12 sm:w-16 sm:h-16 fill-[#FF6B57] text-[#FF6B57] transition-all duration-300 ${
            isFading
              ? 'opacity-40 scale-90 animate-pulse'
              : isWinning
                ? 'scale-110 drop-shadow-[0_6px_14px_rgba(255,107,87,0.45)]'
                : 'drop-shadow-[0_4px_10px_rgba(255,107,87,0.28)]'
          }`}
        />
      ) : (
        <Star
          className={`w-12 h-12 sm:w-16 sm:h-16 fill-[#7C5CFC] text-[#7C5CFC] transition-all duration-300 ${
            isFading
              ? 'opacity-40 scale-90 animate-pulse'
              : isWinning
                ? 'scale-110 drop-shadow-[0_6px_14px_rgba(124,92,252,0.45)]'
                : 'drop-shadow-[0_4px_10px_rgba(124,92,252,0.28)]'
          }`}
        />
      );
    }

    // Crisp Coral X (#FF6B57) and Violet O (#7C5CFC) SVG sculptures
    return isHostMark ? (
      <svg
        viewBox="0 0 80 80"
        className={`w-14 h-14 sm:w-20 sm:h-20 transition-all duration-300 ${
          isFading
            ? 'opacity-38 scale-90 animate-pulse'
            : isWinning
              ? 'scale-110 drop-shadow-[0_6px_14px_rgba(255,107,87,0.45)]'
              : 'drop-shadow-[0_4px_10px_rgba(255,107,87,0.25)]'
        }`}
        aria-hidden="true"
      >
        <line
          x1="18"
          y1="18"
          x2="62"
          y2="62"
          stroke="#FF6B57"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <line
          x1="62"
          y1="18"
          x2="18"
          y2="62"
          stroke="#FF6B57"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <line
          x1="18"
          y1="18"
          x2="62"
          y2="62"
          stroke="#FFE8E2"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="62"
          y1="18"
          x2="18"
          y2="62"
          stroke="#FFE8E2"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    ) : (
      <svg
        viewBox="0 0 80 80"
        className={`w-14 h-14 sm:w-20 sm:h-20 transition-all duration-300 ${
          isFading
            ? 'opacity-38 scale-90 animate-pulse'
            : isWinning
              ? 'scale-110 drop-shadow-[0_6px_14px_rgba(124,92,252,0.45)]'
              : 'drop-shadow-[0_4px_10px_rgba(124,92,252,0.25)]'
        }`}
        aria-hidden="true"
      >
        <circle cx="40" cy="40" r="24" fill="none" stroke="#7C5CFC" strokeWidth="10" />
        <circle cx="40" cy="40" r="24" fill="none" stroke="#EFE9FB" strokeWidth="2.5" />
      </svg>
    );
  };

  return (
    <main className="relative flex-1 w-full max-w-6xl mx-auto px-2 sm:px-6 py-2 sm:py-4 space-y-2.5 sm:space-y-4">
      {/* Celebratory Confetti Explosion Overlay */}
      {confetti.length > 0 && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {confetti.map((c) => (
            <span
              key={c.id}
              style={{
                left: `${c.leftPct}%`,
                backgroundColor: c.color,
                animationDelay: `${c.delayMs}ms`,
                transform: `rotate(${c.rotateDeg}deg)`,
              }}
              className="absolute -top-3 w-3 h-3 rounded-sm animate-bounce opacity-90"
            />
          ))}
        </div>
      )}

      {/* Unified Top Scoreboard & 12-Second Turn Timer Bar */}
      <section className="rounded-3xl bg-white border border-[#EAE4DC] px-3 py-2 sm:px-5 sm:py-3.5 shadow-[0_6px_24px_rgba(31,36,45,0.06)] space-y-1.5 sm:space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-y-1.5 gap-x-2 sm:gap-3">
          {/* Host score (X / Heart) */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FFE8E2] border border-[#FF6B57]/35 flex items-center justify-center text-sm sm:text-base font-extrabold text-[#FF6B57] shrink-0">
              {game.symbolTheme === 'hearts' ? '💖' : 'X'}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#FF6B57] truncate">{hostDisplayName}</p>
              <p
                data-testid="xo-host-wins"
                className="font-mono text-base sm:text-xl font-extrabold text-[#1F242D] tabular-nums leading-none mt-0.5"
              >
                {game.hostWins}
                {game.targetWins > 0 && (
                  <span className="text-xs text-[#6B7280]">/{game.targetWins}</span>
                )}
              </p>
            </div>
          </div>

          {/* Center Turn / Mode indicator (full-width row 2 on mobile, centered col 2 on sm+) */}
          <div className="col-span-2 order-3 sm:col-span-1 sm:order-2 text-center pt-1.5 border-t border-[#EAE4DC] sm:border-t-0 sm:pt-0 sm:px-2">
            <p className="text-[11px] font-bold text-[#6B7280]">
              {game.variant === 'infinite' ? t.xoVariantInfinite : t.xoVariantClassic} ·{' '}
              {t.roundLabel} {game.round}
            </p>
            <p
              data-testid="xo-turn-banner"
              className={`text-sm sm:text-base font-extrabold mt-0.5 leading-snug ${
                game.phase !== 'playing'
                  ? 'text-[#D97706]'
                  : game.turn === 'host'
                    ? 'text-[#FF6B57]'
                    : 'text-[#7C5CFC]'
              }`}
            >
              {game.phase === 'ready'
                ? t.xoTitle
                : game.phase === 'round_over'
                  ? game.roundWinner === 'draw'
                    ? t.xoRoundDraw
                    : game.roundWinner === localRole
                      ? t.xoRoundWinYou
                      : `${partnerName} ${t.xoRoundWinPartner}`
                  : game.phase === 'match_over'
                    ? game.matchWinner === localRole
                      ? t.xoMatchWinYou
                      : `${partnerName} ${t.xoMatchWinPartner}`
                    : isMyTurn
                      ? t.xoYourTurn
                      : isSolo
                        ? `${partnerName} ${t.xoAiThinking}`
                        : `${t.xoPartnerTurn} ${partnerName}`}
            </p>
          </div>

          {/* Guest score (O / Star) */}
          <div className="order-2 sm:order-3 flex items-center justify-end gap-2 sm:gap-2.5 min-w-0">
            <div className="min-w-0 text-end">
              <p className="text-xs font-bold text-[#7C5CFC] truncate">{guestDisplayName}</p>
              <p
                data-testid="xo-guest-wins"
                className="font-mono text-base sm:text-xl font-extrabold text-[#1F242D] tabular-nums leading-none mt-0.5"
              >
                {game.guestWins}
                {game.targetWins > 0 && (
                  <span className="text-xs text-[#6B7280]">/{game.targetWins}</span>
                )}
              </p>
            </div>
            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EFE9FB] border border-[#7C5CFC]/35 flex items-center justify-center text-sm sm:text-base font-extrabold text-[#7C5CFC] shrink-0">
              {game.symbolTheme === 'hearts' ? '⭐' : 'O'}
            </span>
          </div>
        </div>

        {/* 12s Draining Turn Timer Bar */}
        {game.phase === 'playing' && (
          <div className="flex items-center gap-2.5">
            <Clock
              className={`w-4 h-4 shrink-0 ${
                game.turnTimeLeftSec <= 3 ? 'text-[#E11D48] animate-pulse' : 'text-[#6B7280]'
              }`}
            />
            <div className="flex-1 h-2.5 rounded-full bg-[#F3EFE8] overflow-hidden">
              <div
                style={{
                  width: `${timerPct}%`,
                  background:
                    game.turnTimeLeftSec <= 3
                      ? 'linear-gradient(90deg, #EF4444, #F97316)'
                      : game.turn === 'host'
                        ? 'linear-gradient(90deg, #FF6B57, #FF8E7A)'
                        : 'linear-gradient(90deg, #7C5CFC, #A78BFA)',
                }}
                className="h-full rounded-full transition-[width] duration-100"
              />
            </div>
            <span
              data-testid="xo-turn-timer"
              className={`font-mono text-xs font-extrabold tabular-nums w-8 text-end ${
                game.turnTimeLeftSec <= 3 ? 'text-[#E11D48]' : 'text-[#1F242D]'
              }`}
            >
              {Math.ceil(game.turnTimeLeftSec)}s
            </span>
          </div>
        )}
      </section>

      {/* Main Arena: Flanking Couple Webcams on Desktop + Centered 3×3 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,460px)_230px] items-center justify-center gap-4">
        {/* Desktop Left Camera (Local) */}
        <div className="hidden lg:block">
          <CameraFeedTile
            name={localName}
            subtitle={hasHandSensor ? t.xoSensorReady : t.xoSensorFallback}
            stream={localStream}
            isLocal
            cameraEnabled={cameraEnabled}
            micMuted={micMuted}
            metricsRef={localFaceMetricsRef}
            onVideoRef={onVideoRef}
            onRequestCamera={onRequestCamera}
          />
        </div>

        {/* Center 3×3 Pastel Grid Stage */}
        <section className="relative mx-auto w-full max-w-[460px]">
          <div
            ref={boardElRef}
            data-testid="xo-board"
            onPointerMove={handleBoardPointerMove}
            onPointerLeave={handleBoardPointerLeave}
            className="relative aspect-square w-full rounded-3xl p-3.5 sm:p-4 bg-white border border-[#EAE4DC] shadow-[0_10px_34px_rgba(31,36,45,0.08)] grid grid-cols-3 grid-rows-3 gap-2.5 sm:gap-3.5 overflow-hidden"
          >
            {game.board.map((cell, idx) => {
              const isFading = fadingCell === idx;
              const isWinning = game.winLine?.includes(idx) ?? false;
              const isHovered = hoveredCell === idx && game.phase === 'playing' && cell === null;
              const canPlayHere = game.phase === 'playing' && isMyTurn && cell === null;

              return (
                <button
                  key={idx}
                  type="button"
                  data-testid={`xo-cell-${idx}`}
                  data-cell-mark={cell ?? 'empty'}
                  data-fading={isFading ? 'true' : 'false'}
                  disabled={!canPlayHere}
                  onClick={() => attemptLocalMove(idx)}
                  aria-label={`Case ${idx + 1}`}
                  className={`relative rounded-2xl flex items-center justify-center border-2 transition-all duration-200 select-none ${
                    isWinning
                      ? 'bg-[#FEF6DC] border-[#F59E0B] shadow-md shadow-[#F59E0B]/20'
                      : isFading
                        ? 'bg-[#FAF7F2] border-dashed border-[#D1C9BE]'
                        : isHovered && isMyTurn
                          ? localRole === 'host'
                            ? 'bg-[#FFE8E2] border-[#FF6B57]/70 shadow-sm'
                            : 'bg-[#EFE9FB] border-[#7C5CFC]/70 shadow-sm'
                          : 'bg-[#FAF7F2] border-[#EAE4DC] hover:bg-[#F3EFE8]'
                  } ${canPlayHere ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  {cell && renderMark(cell, isFading, isWinning)}

                  {/* Subtle fading badge on oldest Infinite Mode piece */}
                  {isFading && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 end-1.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-white border border-[#EAE4DC] text-[#6B7280] shadow-xs"
                    >
                      ↻
                    </span>
                  )}

                  {/* 1.2s Hover-to-Lock circular SVG progress ring */}
                  {isHovered && hoverProgress > 0.04 && isMyTurn && (
                    <svg
                      viewBox="0 0 64 64"
                      className="pointer-events-none absolute inset-0 m-auto w-14 h-14 sm:w-16 sm:h-16 -rotate-90"
                      aria-hidden="true"
                    >
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        fill="none"
                        stroke="rgba(31,36,45,0.12)"
                        strokeWidth="5"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        fill="none"
                        stroke={localRole === 'host' ? '#FF6B57' : '#7C5CFC'}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - hoverProgress)}
                      />
                    </svg>
                  )}
                </button>
              );
            })}

            {/* Victory Line */}
            {game.winLine && (
              <svg
                viewBox="0 0 100 100"
                className="pointer-events-none absolute inset-3.5 sm:inset-4 w-[calc(100%-1.75rem)] h-[calc(100%-1.75rem)] sm:w-[calc(100%-2rem)] sm:h-[calc(100%-2rem)] z-10"
                aria-hidden="true"
              >
                {(() => {
                  const { x1, y1, x2, y2 } = getWinLineCoords(game.winLine);
                  const strokeColor = game.roundWinner === 'host' ? '#FF6B57' : '#7C5CFC';
                  return (
                    <>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={strokeColor}
                        strokeWidth="5.5"
                        strokeLinecap="round"
                        opacity="0.45"
                      />
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={strokeColor}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </>
                  );
                })()}
              </svg>
            )}

            {/* Live Partner Bluff Cursor */}
            {game.phase === 'playing' && partnerCursor.active && (
              <div
                aria-hidden="true"
                style={{
                  left: `${partnerCursor.x * 100}%`,
                  top: `${partnerCursor.y * 100}%`,
                }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-[left,top] duration-75"
              >
                <div
                  className={`w-7 h-7 rounded-full border-2 shadow-md flex items-center justify-center ${
                    isHost
                      ? 'border-[#7C5CFC] bg-[#7C5CFC]/20'
                      : 'border-[#FF6B57] bg-[#FF6B57]/20'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white" />
                </div>
              </div>
            )}

            {/* Live Local Hand / Bluff Cursor */}
            {game.phase === 'playing' && localCursor.active && hasHandSensor && (
              <div
                aria-hidden="true"
                style={{
                  left: `${localCursor.x * 100}%`,
                  top: `${localCursor.y * 100}%`,
                }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20"
              >
                <div
                  className={`w-8 h-8 rounded-full border-2 shadow-md flex items-center justify-center ${
                    localRole === 'host'
                      ? 'border-[#FF6B57] bg-[#FF6B57]/20'
                      : 'border-[#7C5CFC] bg-[#7C5CFC]/20'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white" />
                </div>
              </div>
            )}
          </div>

          {/* Concise live footer clue underneath board */}
          <p className="text-center text-xs font-medium text-[#6B7280] mt-2">
            {fadingCell !== null ? t.xoFadingHint : hasHandSensor ? t.xoHoverHint : t.xoSensorFallback}
          </p>
        </section>

        {/* Desktop Right Camera (Partner) */}
        <div className="hidden lg:block">
          <CameraFeedTile
            name={partnerName}
            subtitle={isSolo ? t.partnerAiSub : t.partnerLiveSub}
            stream={remoteStream}
            isAi={isSolo}
            metricsRef={partnerFaceMetricsRef}
          />
        </div>
      </div>

      {/* Mobile Compact Side-by-Side Couple Cameras underneath */}
      <section className="lg:hidden max-w-md mx-auto grid grid-cols-2 gap-2.5">
        <CameraFeedTile
          name={localName}
          subtitle={hasHandSensor ? t.xoSensorReady : t.xoSensorFallback}
          stream={localStream}
          isLocal
          cameraEnabled={cameraEnabled}
          micMuted={micMuted}
          metricsRef={localFaceMetricsRef}
          onVideoRef={onVideoRef}
          onRequestCamera={onRequestCamera}
          compact
        />
        <CameraFeedTile
          name={partnerName}
          subtitle={isSolo ? t.partnerAiSub : t.partnerLiveSub}
          stream={remoteStream}
          isAi={isSolo}
          metricsRef={partnerFaceMetricsRef}
          compact
        />
      </section>

      {/* ==================== ROOT-LEVEL VIEWPORT-SAFE MODALS (ZERO CLIPPING ON PHONES) ==================== */}

      {/* READY / SETUP OVERLAY */}
      {game.phase === 'ready' && (
        <div className="fixed inset-x-0 top-[60px] bottom-0 sm:absolute sm:inset-0 z-40 flex justify-center overflow-y-auto bg-[#FAF7F2]/85 backdrop-blur-sm p-3.5 sm:p-5">
          <div className="my-auto w-full max-w-sm rounded-3xl bg-white border border-[#EAE4DC] p-4 sm:p-5 text-center space-y-3.5 shadow-[0_14px_40px_rgba(31,36,45,0.12)]">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1F242D]">{t.xoTitle}</h1>
              <p className="text-xs text-[#6B7280] leading-relaxed font-medium">{t.xoDesc}</p>
            </div>

            {isHost ? (
              <div className="space-y-2">
                {/* Mode Infini (default) vs Mode Classique */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC]">
                  <button
                    type="button"
                    onClick={() => setVariant('infinite')}
                    className={`min-h-[42px] px-2 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold inline-flex items-center justify-center whitespace-nowrap transition-all ${
                      variant === 'infinite'
                        ? 'bg-[#FF6B57] text-white shadow-sm'
                        : 'text-[#6B7280] hover:text-[#1F242D]'
                    }`}
                  >
                    <span>{t.xoVariantInfinite}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariant('classic')}
                    className={`min-h-[42px] px-2 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold inline-flex items-center justify-center whitespace-nowrap transition-all ${
                      variant === 'classic'
                        ? 'bg-[#7C5CFC] text-white shadow-sm'
                        : 'text-[#6B7280] hover:text-[#1F242D]'
                    }`}
                  >
                    <span>{t.xoVariantClassic}</span>
                  </button>
                </div>

                {/* Symbol Theme & Target Format */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSymbolTheme((th) => (th === 'xo' ? 'hearts' : 'xo'))}
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] text-xs font-bold text-[#1F242D] hover:bg-[#F1ECE3] transition-colors"
                  >
                    {symbolTheme === 'xo' ? t.xoThemeXo : t.xoThemeHearts}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetWins((w) => (w === 3 ? 0 : 3))}
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] text-xs font-bold text-[#1F242D] hover:bg-[#F1ECE3] transition-colors"
                  >
                    {targetWins === 3 ? t.xoFormatFirstTo3 : t.xoFormatFree}
                  </button>
                </div>

                <button
                  type="button"
                  data-start="true"
                  onClick={() => handleStartMatch(variant, symbolTheme, targetWins, true)}
                  className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-base font-extrabold bg-[#FF6B57] hover:bg-[#F25743] text-white transition-all shadow-md shadow-[#FF6B57]/25 whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" />
                  <span>{t.xoStartBtn}</span>
                </button>
              </div>
            ) : (
              <p className="text-xs font-bold text-[#7C5CFC]">{t.slingWaitingHost}</p>
            )}
          </div>
        </div>
      )}

      {/* ROUND OVER OVERLAY */}
      {game.phase === 'round_over' && (
        <div className="fixed inset-x-0 top-[60px] bottom-0 sm:absolute sm:inset-0 z-40 flex justify-center overflow-y-auto bg-[#FAF7F2]/80 backdrop-blur-sm p-4">
          <div className="my-auto w-full max-w-xs rounded-3xl bg-white border border-[#EAE4DC] p-5 text-center space-y-4 shadow-[0_14px_40px_rgba(31,36,45,0.12)]">
            <Sparkles className="w-8 h-8 mx-auto text-[#F59E0B]" />
            <h2 className="text-xl font-extrabold text-[#1F242D]">
              {game.roundWinner === 'draw'
                ? t.xoRoundDraw
                : game.roundWinner === localRole
                  ? t.xoRoundWinYou
                  : `${partnerName} ${t.xoRoundWinPartner}`}
            </h2>
            {isHost ? (
              <button
                type="button"
                data-testid="xo-next-round-btn"
                onClick={handleNextRound}
                className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-base font-extrabold bg-[#FF6B57] text-white hover:bg-[#F25743] shadow-md shadow-[#FF6B57]/20 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{t.xoNextRoundBtn}</span>
              </button>
            ) : (
              <p className="text-xs font-semibold text-[#6B7280]">{t.slingWaitingHost}</p>
            )}
          </div>
        </div>
      )}

      {/* MATCH OVER + COUPLE DARE MODAL */}
      {game.phase === 'match_over' && (
        <div className="fixed inset-x-0 top-[60px] bottom-0 sm:absolute sm:inset-0 z-40 flex justify-center overflow-y-auto bg-[#FAF7F2]/85 backdrop-blur-sm p-3.5 sm:p-5">
          <div className="my-auto w-full max-w-sm rounded-3xl bg-white border border-[#EAE4DC] p-4 sm:p-5 text-center space-y-3.5 shadow-[0_14px_40px_rgba(31,36,45,0.14)]">
            <div className="mx-auto w-11 h-11 rounded-2xl bg-[#FEF6DC] border border-[#F5D782] flex items-center justify-center text-[#D97706]">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1F242D]">
                {game.matchWinner === localRole
                  ? t.xoMatchWinYou
                  : `${partnerName} ${t.xoMatchWinPartner}`}
              </h2>
              <p className="font-mono text-sm text-[#6B7280] font-semibold tabular-nums">
                {hostDisplayName} {game.hostWins} — {game.guestWins} {guestDisplayName}
              </p>
            </div>

            {/* Couple Dare Card */}
            <div
              data-testid="xo-couple-dare"
              className="rounded-2xl bg-[#FFE8E2]/70 border border-[#FF6B57]/30 p-3.5 text-start space-y-1"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#FF6B57]">
                🎲 {t.xoDareLabel}
              </p>
              <p className="text-xs sm:text-sm font-semibold text-[#1F242D] leading-snug">
                « {dareText} »
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                data-start="true"
                onClick={handleRematch}
                className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-extrabold bg-[#FF6B57] hover:bg-[#F25743] text-white shadow-md shadow-[#FF6B57]/20 transition-all"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>{t.xoRematchBtn}</span>
              </button>
              <button
                type="button"
                onClick={onReturnToHub}
                className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl text-sm font-bold bg-[#FAF7F2] text-[#1F242D] border border-[#EAE4DC] hover:bg-[#F1ECE3] transition-all"
              >
                {t.backToHub}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
