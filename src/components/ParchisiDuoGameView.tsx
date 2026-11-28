import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Crown,
  MessageCircle,
  MessageSquare,
  MicOff,
  RotateCcw,
  SlidersHorizontal,
  Smile,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  ConnectionMode,
  ParchisiColor,
  ParchisiDiceCount,
  ParchisiMode,
  ParchisiMoveOption,
  ParchisiState,
  PeerMessage,
} from '../types/duoplay';
import { COLOR_PALETTE, PARCHISI_HOME_PROGRESS } from '../game/parchisiBoard';
import {
  applyParchisiMove,
  chooseAiParchisiMove,
  createInitialParchisiState,
  getLegalParchisiMoves,
  PARCHISI_TURN_SECONDS,
  passParchisiTurnOrBonus,
  rollParchisiDice,
  startParchisiMatch,
} from '../game/parchisiLogic';
import { useI18n } from '../i18n/LanguageContext';
import { soundFx } from '../utils/soundFx';
import { ParchisiBoardSvg, type FloatingReactionItem } from './ParchisiBoardSvg';
import { PARCHISI_DICE_ROLL_MS, ParchisiDice3D } from './ParchisiDice3D';

interface ParchisiDuoGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  initialDiceCount: ParchisiDiceCount;
  onSyncDiceCount: (count: ParchisiDiceCount) => void;
  micMuted: boolean;
  partnerMicMuted: boolean;
  localSpeaking: boolean;
  remoteSpeaking: boolean;
  unreadChatCount: number;
  onOpenLiveChat: () => void;
  onRecordVictory: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onReturnToRoomMenu: () => void;
}

const QUICK_EMOJIS = ['😀', '😈', '😭', '🔥', '👏', '😱'] as const;
const QUICK_CHATS = [
  'Good luck!',
  'Nooo!',
  'Blocked!',
  'Oops!',
  'Nice move!',
  'Rematch?',
] as const;

const CONFETTI_COLORS = ['#E53935', '#FBC02D', '#2E9E5B', '#1E88E5', '#FEF08A', '#FFFFFF'];

interface PlayerAvatarBadgeProps {
  color: ParchisiColor;
  name: string;
  homeCount: number;
  isActiveTurn: boolean;
  turnRemainingFrac: number; // 0..1
  align?: 'left' | 'right';
  showMicMuted?: boolean;
  isSpeaking?: boolean;
  isBot?: boolean;
}

function PlayerAvatarBadge({
  color,
  name,
  homeCount,
  isActiveTurn,
  turnRemainingFrac,
  align = 'left',
  showMicMuted = false,
  isSpeaking = false,
  isBot = false,
}: PlayerAvatarBadgeProps) {
  const pal = COLOR_PALETTE[color];
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const clampedFrac = Math.max(0, Math.min(1, turnRemainingFrac));
  const dashOffset = circumference * (1 - clampedFrac);
  const urgentTimer = isActiveTurn && clampedFrac < 0.25;
  const activeVoice = isSpeaking && !showMicMuted && !isBot;

  const avatarEl = (
    <div className="relative w-11 h-11 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center">
      {/* Animated 30-second radial countdown ring around the active player's avatar */}
      <svg
        viewBox="0 0 52 52"
        className="pointer-events-none absolute -inset-0.5 w-[calc(100%+4px)] h-[calc(100%+4px)] -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke={isActiveTurn ? 'rgba(31,36,45,0.14)' : 'rgba(31,36,45,0.08)'}
          strokeWidth={isActiveTurn ? '3.5' : '2.5'}
        />
        {isActiveTurn ? (
          <circle
            cx="26"
            cy="26"
            r={radius}
            fill="none"
            stroke={urgentTimer ? '#EF4444' : '#FF6B57'}
            strokeWidth="3.8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 220ms linear, stroke 200ms ease' }}
          />
        ) : (
          <circle
            cx="26"
            cy="26"
            r={radius}
            fill="none"
            stroke={pal.fill}
            strokeWidth="2.5"
            opacity="0.75"
          />
        )}
      </svg>

      {/* Circular Pastel Voice Avatar (ZERO <video>) */}
      <div
        style={{
          boxShadow: activeVoice
            ? '0 0 18px rgba(22, 163, 74, 0.55)'
            : isActiveTurn
              ? `0 0 14px ${pal.fill}66`
              : '0 2px 8px rgba(31,36,45,0.12)',
          borderColor: activeVoice ? '#16A34A' : pal.fill,
          background: `radial-gradient(circle at 35% 30%, ${pal.light}, ${pal.dark})`,
        }}
        className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 flex items-center justify-center text-xs sm:text-sm font-black text-white transition-transform duration-150 ${
          activeVoice ? 'scale-105' : ''
        }`}
      >
        {isBot ? <Bot className="w-4 h-4 sm:w-5 sm:h-5" /> : <span>{name.slice(0, 2).toUpperCase()}</span>}

        {showMicMuted && !isBot && (
          <span
            aria-label="Microphone muted"
            className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#EF4444] text-white flex items-center justify-center border border-white"
          >
            <MicOff className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
    </div>
  );

  const infoEl = (
    <div className={`min-w-0 flex flex-col ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      <span className="max-w-[82px] sm:max-w-[116px] truncate text-xs sm:text-sm font-bold text-[#1F242D] leading-tight">
        {name}
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B7280] tabular-nums leading-tight">
        <span
          style={{ backgroundColor: pal.fill }}
          className="inline-block w-2 h-2 rounded-full shrink-0"
        />
        <span>{homeCount}/4</span>
      </span>
    </div>
  );

  return (
    <div
      data-testid={`parchisi-hud-${color}`}
      className="flex items-center gap-2 min-w-0 shrink-0"
    >
      {align === 'left' ? (
        <>
          {avatarEl}
          {infoEl}
        </>
      ) : (
        <>
          {infoEl}
          {avatarEl}
        </>
      )}
    </div>
  );
}

export function ParchisiDuoGameView({
  localName,
  partnerName,
  connectionMode,
  initialDiceCount,
  onSyncDiceCount,
  micMuted,
  partnerMicMuted,
  localSpeaking,
  remoteSpeaking,
  unreadChatCount,
  onOpenLiveChat,
  onRecordVictory,
  onSendPeerMessage,
  registerPeerHandler,
  onReturnToRoomMenu,
}: ParchisiDuoGameViewProps) {
  const { t } = useI18n();
  const isSolo = connectionMode === 'solo';
  const isHost = connectionMode === 'p2p-host' || isSolo;
  const localColor: ParchisiColor = connectionMode === 'p2p-guest' ? 'yellow' : 'red';

  const colorNames: Record<ParchisiColor, string> = useMemo(
    () => ({
      red: localColor === 'red' ? localName || 'You' : partnerName || 'Host',
      yellow:
        localColor === 'yellow'
          ? localName || 'You'
          : isSolo
            ? 'Yellow AI'
            : partnerName || 'Partner',
      green: 'Green AI',
      blue: 'Blue AI',
    }),
    [localColor, localName, partnerName, isSolo],
  );

  const [selectedMode, setSelectedMode] = useState<ParchisiMode>('1v1');
  const [selectedDiceCount, setSelectedDiceCount] = useState<ParchisiDiceCount>(initialDiceCount);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  // Host & Solo start immediately into 1v1 with the diceCount chosen in Room Menu!
  // Guest initializes cleanly and receives Host's live PARCHISI_STATE immediately.
  const [gameState, setGameState] = useState<ParchisiState>(() =>
    isHost
      ? startParchisiMatch('1v1', Date.now(), initialDiceCount)
      : createInitialParchisiState('1v1', Date.now(), initialDiceCount),
  );
  const stateRef = useRef<ParchisiState>(gameState);
  stateRef.current = gameState;

  const [isRollingAnim, setIsRollingAnim] = useState(false);
  const [completedAnimSeq, setCompletedAnimSeq] = useState(0);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [hoveredTokenId, setHoveredTokenId] = useState<number | null>(null);
  const [hoveredOption, setHoveredOption] = useState<ParchisiMoveOption | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReactionItem[]>([]);
  const [openDrawer, setOpenDrawer] = useState<'none' | 'emoji' | 'chat'>('none');
  const [sfxMutedLocal, setSfxMutedLocal] = useState(() => soundFx.muted);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(PARCHISI_TURN_SECONDS);
  const [noMovesBanner, setNoMovesBanner] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState(0);

  const reactionIdRef = useRef(1);
  const lastRollSeqRef = useRef(0);
  const victoryRecordedRef = useRef(false);

  // Sync diceCount if changed externally from Room Menu
  useEffect(() => {
    setSelectedDiceCount(initialDiceCount);
  }, [initialDiceCount]);

  // Mirror phase to document.body.dataset.state for testability
  useEffect(() => {
    if (gameState.phase === 'READY') {
      document.body.dataset.state = 'title';
    } else if (gameState.phase === 'GAME_OVER') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [gameState.phase]);

  const spawnReaction = useCallback(
    (color: ParchisiColor, text: string, kind: 'emoji' | 'chat') => {
      const id = reactionIdRef.current++;
      soundFx.parchisiEmotePop();
      setFloatingReactions((prev) => [...prev.slice(-4), { id, color, text, kind }]);
      window.setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((item) => item.id !== id));
      }, 2100);
    },
    [],
  );

  // Host-authoritative state commit + Firestore/WebRTC broadcast
  const commitHostState = useCallback(
    (next: ParchisiState) => {
      stateRef.current = next;
      setGameState(next);
      setSelectedTokenId(null);
      setHoveredTokenId(null);
      setHoveredOption(null);
      if (connectionMode === 'p2p-host') {
        onSendPeerMessage({ type: 'PARCHISI_STATE', state: next });
      }
    },
    [connectionMode, onSendPeerMessage],
  );

  // Broadcast initial active state when Host enters Parcheesi, and let Guest request sync on mount/reconnect!
  useEffect(() => {
    if (connectionMode === 'p2p-host') {
      const t1 = window.setTimeout(() => {
        onSendPeerMessage({ type: 'PARCHISI_STATE', state: stateRef.current });
      }, 80);
      return () => window.clearTimeout(t1);
    }
    if (connectionMode === 'p2p-guest') {
      onSendPeerMessage({ type: 'PARCHISI_SYNC_REQ' });
      const retry = window.setTimeout(() => {
        if (stateRef.current.phase === 'READY') {
          onSendPeerMessage({ type: 'PARCHISI_SYNC_REQ' });
        }
      }, 650);
      return () => window.clearTimeout(retry);
    }
  }, [connectionMode, onSendPeerMessage]);

  const legalMoves = useMemo(() => getLegalParchisiMoves(gameState), [gameState]);

  const isBotTurn = useCallback(
    (st: ParchisiState): boolean => {
      if (st.phase !== 'WAIT_ROLL' && st.phase !== 'WAIT_MOVE') return false;
      if (st.turn === 'green' || st.turn === 'blue') return true;
      if (isSolo && st.turn === 'yellow') return true;
      return false;
    },
    [isSolo],
  );

  const isLocalTurn =
    gameState.turn === localColor &&
    (gameState.phase === 'WAIT_ROLL' || gameState.phase === 'WAIT_MOVE');

  // Synchronously detect pending move animation on Render #1 so pawns NEVER teleport before hopping!
  const pendingMoveAnim =
    gameState.lastMoveAnim && gameState.lastMoveAnim.seq > completedAnimSeq
      ? gameState.lastMoveAnim
      : null;
  const isMoveAnimating = pendingMoveAnim !== null;

  const handleMoveAnimComplete = useCallback((seq: number) => {
    setCompletedAnimSeq((prev) => (seq > prev ? seq : prev));
  }, []);

  const handleTriggerCelebration = useCallback(() => {
    setConfettiSeed((s) => s + 1);
  }, []);

  const canRollNow =
    isLocalTurn && gameState.phase === 'WAIT_ROLL' && !isRollingAnim && !isMoveAnimating;
  const canInteractBoard =
    isLocalTurn &&
    gameState.phase === 'WAIT_MOVE' &&
    !isRollingAnim &&
    !isMoveAnimating &&
    legalMoves.length > 0;

  // Trigger synchronized 3D cube dice roll duration + Web Audio rattle whenever rollSeq advances
  useEffect(() => {
    if (gameState.rollSeq === 0) {
      lastRollSeqRef.current = 0;
      setIsRollingAnim(false);
      return;
    }
    if (gameState.rollSeq === lastRollSeqRef.current) return;
    lastRollSeqRef.current = gameState.rollSeq;
    soundFx.parchisiDiceRoll();
    setIsRollingAnim(true);

    const stopTimer = window.setTimeout(() => {
      setIsRollingAnim(false);
      if (stateRef.current.lastEventTone === 'warning') {
        soundFx.parchisiCurseTripleSix();
      }
    }, PARCHISI_DICE_ROLL_MS);

    return () => {
      window.clearTimeout(stopTimer);
    };
  }, [gameState.rollSeq]);

  // Record victory once + victory fanfare + confetti
  useEffect(() => {
    if (gameState.phase === 'GAME_OVER' && gameState.winner) {
      soundFx.victoryFanfare();
      setConfettiSeed((s) => s + 1);
      if (!victoryRecordedRef.current && gameState.winner === localColor) {
        victoryRecordedRef.current = true;
        onRecordVictory();
      }
    } else if (gameState.phase !== 'GAME_OVER') {
      victoryRecordedRef.current = false;
    }
  }, [gameState.phase, gameState.winner, localColor, onRecordVictory]);

  // Host real-time setup config sync (Mode + 1 Dé / 2 Dés)
  const handleSelectSetupConfig = useCallback(
    (mode: ParchisiMode, diceCount: ParchisiDiceCount) => {
      if (!isHost) return;
      soundFx.click();
      setSelectedMode(mode);
      setSelectedDiceCount(diceCount);
      onSyncDiceCount(diceCount);
      if (connectionMode === 'p2p-host') {
        onSendPeerMessage({ type: 'PARCHISI_CONFIG', mode, diceCount });
      }
    },
    [isHost, connectionMode, onSyncDiceCount, onSendPeerMessage],
  );

  // Start or Restart match
  const handleStartMatch = useCallback(
    (mode: ParchisiMode = selectedMode, diceCount: ParchisiDiceCount = selectedDiceCount) => {
      if (!isHost) return;
      soundFx.click();
      setOpenDrawer('none');
      setSetupModalOpen(false);
      setNoMovesBanner(false);
      lastRollSeqRef.current = 0;
      setCompletedAnimSeq(0);
      setIsRollingAnim(false);
      onSyncDiceCount(diceCount);
      const fresh = startParchisiMatch(mode, Date.now(), diceCount);
      commitHostState(fresh);
      if (connectionMode === 'p2p-host') {
        onSendPeerMessage({ type: 'PARCHISI_START', mode, diceCount });
      }
    },
    [
      isHost,
      selectedMode,
      selectedDiceCount,
      onSyncDiceCount,
      commitHostState,
      connectionMode,
      onSendPeerMessage,
    ],
  );

  // Roll dice (Host executes directly; Guest sends action)
  const handleRollDice = useCallback(() => {
    const st = stateRef.current;
    if (st.phase !== 'WAIT_ROLL' || st.turn !== localColor) return;
    if (isRollingAnim || isMoveAnimating) return;

    if (isHost) {
      commitHostState(rollParchisiDice(st));
    } else {
      onSendPeerMessage({ type: 'PARCHISI_ACTION', action: 'ROLL' });
    }
  }, [localColor, isRollingAnim, isMoveAnimating, isHost, commitHostState, onSendPeerMessage]);

  // Execute a chosen move option
  const handleExecuteMove = useCallback(
    (move: ParchisiMoveOption) => {
      const st = stateRef.current;
      if (st.phase !== 'WAIT_MOVE' || st.turn !== localColor) return;
      if (isRollingAnim || isMoveAnimating) return;

      setSelectedTokenId(null);
      setHoveredTokenId(null);
      setHoveredOption(null);

      if (isHost) {
        commitHostState(applyParchisiMove(st, move.id));
      } else {
        onSendPeerMessage({
          type: 'PARCHISI_ACTION',
          action: 'MOVE_TOKEN',
          tokenId: move.tokenId,
          moveOptionId: move.id,
        });
      }
    },
    [localColor, isRollingAnim, isMoveAnimating, isHost, commitHostState, onSendPeerMessage],
  );

  // Token click: immediately execute if only 1 move option applies, else open crisp floating move picker
  const handleTokenClick = useCallback(
    (tokenId: number) => {
      if (!canInteractBoard) return;
      const options = legalMoves.filter((m) => m.tokenId === tokenId);
      if (options.length === 0) return;
      if (options.length === 1) {
        handleExecuteMove(options[0]);
      } else {
        soundFx.click();
        setSelectedTokenId((prev) => (prev === tokenId ? null : tokenId));
      }
    },
    [canInteractBoard, legalMoves, handleExecuteMove],
  );

  // Send Emoji or Quick Chat taunt
  const handleSendEmoji = useCallback(
    (emoji: string) => {
      setOpenDrawer('none');
      spawnReaction(localColor, emoji, 'emoji');
      if (!isSolo) {
        onSendPeerMessage({ type: 'PARCHISI_ACTION', action: 'EMOJI', emoji });
      }
    },
    [localColor, isSolo, spawnReaction, onSendPeerMessage],
  );

  const handleSendQuickChat = useCallback(
    (chatText: string) => {
      setOpenDrawer('none');
      spawnReaction(localColor, chatText, 'chat');
      if (!isSolo) {
        onSendPeerMessage({ type: 'PARCHISI_ACTION', action: 'QUICK_CHAT', chatText });
      }
    },
    [localColor, isSolo, spawnReaction, onSendPeerMessage],
  );

  // Incoming Firestore/WebRTC Parcheesi message handler
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'PARCHISI_SYNC_REQ' && isHost) {
        if (connectionMode === 'p2p-host') {
          onSendPeerMessage({ type: 'PARCHISI_STATE', state: stateRef.current });
        }
        return;
      }

      if (msg.type === 'PARCHISI_CONFIG' && !isHost) {
        setSelectedMode(msg.mode);
        setSelectedDiceCount(msg.diceCount);
        if (stateRef.current.phase === 'READY') {
          const preview = createInitialParchisiState(msg.mode, Date.now(), msg.diceCount);
          stateRef.current = preview;
          setGameState(preview);
        }
        return;
      }

      if (msg.type === 'PARCHISI_STATE' && !isHost) {
        const normalizedState: ParchisiState = {
          ...msg.state,
          diceCount: msg.state.diceCount ?? 2,
        };
        setSelectedMode(normalizedState.mode);
        setSelectedDiceCount(normalizedState.diceCount);
        if (normalizedState.lastMoveAnim === null) {
          setCompletedAnimSeq(0);
        }
        if (normalizedState.rollSeq === 0) {
          lastRollSeqRef.current = 0;
          setIsRollingAnim(false);
        }
        stateRef.current = normalizedState;
        setGameState(normalizedState);
        setSelectedTokenId(null);
        setHoveredTokenId(null);
        setHoveredOption(null);
        return;
      }

      if (msg.type === 'PARCHISI_ACTION') {
        if (msg.action === 'EMOJI' && msg.emoji) {
          const senderColor: ParchisiColor = isHost ? 'yellow' : 'red';
          spawnReaction(senderColor, msg.emoji, 'emoji');
          return;
        }
        if (msg.action === 'QUICK_CHAT' && msg.chatText) {
          const senderColor: ParchisiColor = isHost ? 'yellow' : 'red';
          spawnReaction(senderColor, msg.chatText, 'chat');
          return;
        }

        if (!isHost) return;
        const st = stateRef.current;
        if (st.turn !== 'yellow') return;

        if (msg.action === 'ROLL' && st.phase === 'WAIT_ROLL') {
          commitHostState(rollParchisiDice(st));
        } else if (msg.action === 'MOVE_TOKEN' && st.phase === 'WAIT_MOVE' && msg.moveOptionId) {
          commitHostState(applyParchisiMove(st, msg.moveOptionId));
        }
      }
    });

    return () => registerPeerHandler(null);
  }, [registerPeerHandler, isHost, connectionMode, onSendPeerMessage, commitHostState, spawnReaction]);

  // Host Auto-Skip: if active player has 0 legal moves during WAIT_MOVE, advance automatically
  useEffect(() => {
    if (gameState.phase !== 'WAIT_MOVE' || isRollingAnim || isMoveAnimating) {
      setNoMovesBanner(false);
      return;
    }
    if (legalMoves.length > 0) {
      setNoMovesBanner(false);
      return;
    }

    setNoMovesBanner(true);
    if (!isHost) return;

    const skipDelayMs = gameState.diceCount === 1 ? 800 : 1000;
    const timer = window.setTimeout(() => {
      setNoMovesBanner(false);
      commitHostState(passParchisiTurnOrBonus(stateRef.current));
    }, skipDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    gameState.phase,
    gameState.stateSeq,
    gameState.diceCount,
    legalMoves.length,
    isRollingAnim,
    isMoveAnimating,
    isHost,
    commitHostState,
  ]);

  // Host Smart AI Loop (~700ms natural pacing for Yellow AI in Solo & Blue/Green AI in 4-Player)
  useEffect(() => {
    if (!isHost || isRollingAnim || isMoveAnimating) return;
    if (!isBotTurn(gameState)) return;

    if (gameState.phase === 'WAIT_ROLL') {
      const timer = window.setTimeout(() => {
        const cur = stateRef.current;
        if (cur.phase === 'WAIT_ROLL' && isBotTurn(cur)) {
          commitHostState(rollParchisiDice(cur));
        }
      }, 700);
      return () => window.clearTimeout(timer);
    }

    if (gameState.phase === 'WAIT_MOVE' && legalMoves.length > 0) {
      const timer = window.setTimeout(() => {
        const cur = stateRef.current;
        if (cur.phase === 'WAIT_MOVE' && isBotTurn(cur)) {
          const choice = chooseAiParchisiMove(cur);
          if (choice) {
            commitHostState(applyParchisiMove(cur, choice.id));
          }
        }
      }, 720);
      return () => window.clearTimeout(timer);
    }
  }, [
    isHost,
    gameState,
    legalMoves.length,
    isRollingAnim,
    isMoveAnimating,
    isBotTurn,
    commitHostState,
  ]);

  // 30-second Turn Countdown Timer (visual ring + Host auto-action on timeout)
  useEffect(() => {
    if (gameState.phase !== 'WAIT_ROLL' && gameState.phase !== 'WAIT_MOVE') {
      setTurnSecondsLeft(PARCHISI_TURN_SECONDS);
      return;
    }

    const startedAt = gameState.turnStartedAt || Date.now();
    const updateRemaining = () => {
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const rem = Math.max(0, PARCHISI_TURN_SECONDS - elapsedSec);
      setTurnSecondsLeft(rem);

      if (rem <= 0 && isHost && !isRollingAnim && !isMoveAnimating) {
        const cur = stateRef.current;
        if (cur.phase === 'WAIT_ROLL') {
          commitHostState(rollParchisiDice(cur));
        } else if (cur.phase === 'WAIT_MOVE') {
          const moves = getLegalParchisiMoves(cur);
          if (moves.length > 0) {
            const fallback = chooseAiParchisiMove(cur) ?? moves[0];
            commitHostState(applyParchisiMove(cur, fallback.id));
          } else {
            commitHostState(passParchisiTurnOrBonus(cur));
          }
        }
      }
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(interval);
  }, [
    gameState.phase,
    gameState.turnStartedAt,
    gameState.stateSeq,
    isHost,
    isRollingAnim,
    isMoveAnimating,
    commitHostState,
  ]);

  // Resolve active hover target preview on the board
  const activeHoveredMove = useMemo<ParchisiMoveOption | null>(() => {
    if (!canInteractBoard) return null;
    if (hoveredOption) return hoveredOption;
    if (hoveredTokenId !== null) {
      const opts = legalMoves.filter((m) => m.tokenId === hoveredTokenId);
      if (opts.length === 1) return opts[0];
    }
    return null;
  }, [canInteractBoard, hoveredOption, hoveredTokenId, legalMoves]);

  // Home counts per color (0..4)
  const homeCount = useCallback(
    (color: ParchisiColor) =>
      gameState.tokens[color].filter((tok) => tok.progress >= PARCHISI_HOME_PROGRESS).length,
    [gameState.tokens],
  );

  const displayedDice = gameState.dice;
  const activeBonus = gameState.pendingBonuses[0] ?? null;
  const turnFrac = turnSecondsLeft / PARCHISI_TURN_SECONDS;
  const isTopTurn = gameState.turn === 'yellow' || gameState.turn === 'blue';
  const isBottomTurn = gameState.turn === 'red' || gameState.turn === 'green';

  // Live concise turn prompt text
  const turnStatusLine = useMemo(() => {
    if (gameState.phase === 'READY') {
      return gameState.diceCount === 1 ? 'Official 1-Die Parcheesi' : 'Official 2-Dice Parcheesi';
    }
    if (gameState.phase === 'GAME_OVER' && gameState.winner) {
      return `${colorNames[gameState.winner]} wins!`;
    }
    if (noMovesBanner) return 'No legal moves';
    if (activeBonus !== null) {
      return isLocalTurn
        ? `Bonus +${activeBonus}! Pick a token`
        : `${colorNames[gameState.turn]} plays +${activeBonus} bonus`;
    }
    if (gameState.mustBreakBlockade && isLocalTurn && gameState.phase === 'WAIT_MOVE') {
      return 'Doubles! Break your blockade';
    }
    if (gameState.phase === 'WAIT_ROLL') {
      return isLocalTurn
        ? gameState.diceCount === 1
          ? 'Your turn · Roll the die'
          : 'Your turn · Roll both dice'
        : `${colorNames[gameState.turn]} is rolling…`;
    }
    return isLocalTurn ? 'Pick a highlighted token' : `${colorNames[gameState.turn]} is moving…`;
  }, [
    gameState.phase,
    gameState.diceCount,
    gameState.winner,
    gameState.turn,
    gameState.mustBreakBlockade,
    noMovesBanner,
    activeBonus,
    isLocalTurn,
    colorNames,
  ]);

  const handleToggleSoundMute = () => {
    const next = !sfxMutedLocal;
    soundFx.muted = next;
    setSfxMutedLocal(next);
    if (!next) soundFx.click();
  };

  const redIsLocal = localColor === 'red';
  const yellowIsLocal = localColor === 'yellow';
  const showSetupOverlay = setupModalOpen || (gameState.phase === 'READY' && isHost);

  return (
    <section
      data-testid="parchisi-game-root"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 42%, #FFFDF9 0%, #FAF7F2 60%, #F4EFE6 100%)',
        WebkitTapHighlightColor: 'transparent',
      }}
      className="relative flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col items-center justify-between px-1 sm:px-4 py-1 sm:py-2 select-none touch-manipulation text-[#1F242D]"
    >
      {/* CENTERED STAGE: Top HUD + Square Wooden Board + Bottom HUD */}
      <div className="relative z-10 flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-1.5 sm:gap-2 overflow-hidden">
        {/* 1. CLASSIC TOP PLAYER HUD BAR (Blue TL in 4P · Yellow TR + Active Top Dice Tray) */}
        <div className="relative z-20 w-full max-w-[660px] flex items-center justify-between gap-2 px-1 shrink-0 min-h-[48px]">
          <div className="flex items-center gap-2 min-w-0">
            {gameState.mode === '4p' ? (
              <>
                <PlayerAvatarBadge
                  color="blue"
                  name={colorNames.blue}
                  homeCount={homeCount('blue')}
                  isActiveTurn={gameState.turn === 'blue' && gameState.phase !== 'READY'}
                  turnRemainingFrac={turnFrac}
                  align="left"
                  isBot
                />
                {gameState.turn === 'blue' && gameState.phase !== 'READY' && (
                  <ParchisiDice3D
                    dice={displayedDice}
                    usedDice={gameState.usedDice}
                    diceCount={gameState.diceCount}
                    pendingBonus={activeBonus}
                    rollSeq={gameState.rollSeq}
                    rolling={isRollingAnim}
                    shakeIntensity={0}
                    canRoll={false}
                    isActiveTray
                    compact
                    accentColor={COLOR_PALETTE.blue.fill}
                    onRoll={handleRollDice}
                    ariaLabel="Blue AI dice"
                  />
                )}
              </>
            ) : (
              <div className="min-w-0 flex flex-col">
                <span
                  data-testid="parchisi-turn-status"
                  className={`text-xs sm:text-sm font-extrabold truncate ${
                    noMovesBanner
                      ? 'text-[#DC2626]'
                      : activeBonus !== null
                        ? 'text-[#D97706]'
                        : 'text-[#1F242D]'
                  }`}
                >
                  {turnStatusLine}
                </span>
                {gameState.lastEventText && gameState.phase !== 'READY' && (
                  <span className="text-[11px] text-[#6B7280] font-medium truncate max-w-[165px] sm:max-w-[260px]">
                    {gameState.lastEventText}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Top-Right: Yellow Dice Tray + Yellow Voice Avatar */}
          <div className="flex items-center gap-2 shrink-0">
            {isTopTurn && gameState.turn === 'yellow' && gameState.phase !== 'READY' && (
              <ParchisiDice3D
                dice={displayedDice}
                usedDice={gameState.usedDice}
                diceCount={gameState.diceCount}
                pendingBonus={activeBonus}
                rollSeq={gameState.rollSeq}
                rolling={isRollingAnim}
                shakeIntensity={0}
                canRoll={localColor === 'yellow' && canRollNow}
                isActiveTray
                compact={gameState.mode === '4p'}
                accentColor={COLOR_PALETTE.yellow.fill}
                onRoll={handleRollDice}
                ariaLabel={gameState.diceCount === 1 ? 'Roll die for Yellow' : 'Roll both dice for Yellow'}
              />
            )}
            <PlayerAvatarBadge
              color="yellow"
              name={colorNames.yellow}
              homeCount={homeCount('yellow')}
              isActiveTurn={gameState.turn === 'yellow' && gameState.phase !== 'READY'}
              turnRemainingFrac={turnFrac}
              align="right"
              showMicMuted={yellowIsLocal ? micMuted : !isSolo && partnerMicMuted}
              isSpeaking={yellowIsLocal ? localSpeaking : !isSolo && remoteSpeaking}
              isBot={isSolo && !yellowIsLocal}
            />
          </div>
        </div>

        {/* 2. CENTER SQUARE WOODEN PARCHEESI BOARD */}
        <div className="relative z-10 w-full flex-1 min-h-0 max-h-[min(100%,98vw)] flex items-center justify-center [container-type:size]">
          <div className="relative w-[min(100cqw,100cqh)] h-[min(100cqw,100cqh)] flex items-center justify-center">
            <ParchisiBoardSvg
              state={gameState}
              legalMoves={legalMoves}
              canInteract={canInteractBoard}
              selectedTokenId={selectedTokenId}
              hoveredMove={activeHoveredMove}
              pendingMoveAnim={pendingMoveAnim}
              onMoveAnimComplete={handleMoveAnimComplete}
              onTriggerCelebration={handleTriggerCelebration}
              floatingReactions={floatingReactions}
              onTokenClick={handleTokenClick}
              onTokenHover={setHoveredTokenId}
              onSelectMoveOption={handleExecuteMove}
              onHoverMoveOption={setHoveredOption}
              onDismissPicker={() => setSelectedTokenId(null)}
            />

            {/* Compact "No legal moves" toast over center hub when auto-skipping */}
            {noMovesBanner && (
              <div
                role="status"
                data-testid="parchisi-no-moves-toast"
                className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-white/95 border border-[#EAE4DC] text-xs sm:text-sm font-extrabold text-[#1F242D] shadow-lg whitespace-nowrap"
              >
                No legal moves
              </div>
            )}

            {/* Setup / Match Options Modal Overlay (Host-only switch 1v1 / 4P & 1 Dé / 2 Dés) */}
            {showSetupOverlay && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-3 bg-[#1F242D]/35 backdrop-blur-xs rounded-2xl">
                <div
                  data-testid="parchisi-setup-modal"
                  className="w-full max-w-[336px] rounded-3xl bg-white border border-[#EAE4DC] shadow-[0_18px_48px_rgba(31,36,45,0.18)] p-5 text-center space-y-3.5"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-[#FEF6DC] border border-[#F3E3BE] text-[#D97706] shadow-xs">
                      <Crown className="w-5 h-5" />
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1F242D]">
                      Official Parcheesi
                    </h2>
                    <p className="text-xs text-[#6B7280] font-medium">
                      {selectedDiceCount === 1
                        ? '1 Dé · Sortie sur 5 · Rejoue sur 6 · +20 / +10'
                        : '2 Dés · Sortie sur 5 · Capture +20 · Centre +10'}
                    </p>
                  </div>

                  {/* 1 Dé / 2 Dés Pill Selector */}
                  <div
                    role="group"
                    aria-label="Nombre de dés"
                    className="grid grid-cols-2 gap-2 p-1 rounded-full bg-[#FAF7F2] border border-[#EAE4DC]"
                  >
                    <button
                      type="button"
                      data-testid="parchisi-dice-count-1"
                      aria-pressed={selectedDiceCount === 1}
                      disabled={!isHost}
                      onClick={() => handleSelectSetupConfig(selectedMode, 1)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                        selectedDiceCount === 1
                          ? 'bg-[#FF6B57] text-white shadow-[0_4px_12px_rgba(255,107,87,0.32)]'
                          : 'text-[#6B7280] hover:text-[#1F242D]'
                      }`}
                    >
                      🎲 1 Dé
                    </button>
                    <button
                      type="button"
                      data-testid="parchisi-dice-count-2"
                      aria-pressed={selectedDiceCount === 2}
                      disabled={!isHost}
                      onClick={() => handleSelectSetupConfig(selectedMode, 2)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                        selectedDiceCount === 2
                          ? 'bg-[#FF6B57] text-white shadow-[0_4px_12px_rgba(255,107,87,0.32)]'
                          : 'text-[#6B7280] hover:text-[#1F242D]'
                      }`}
                    >
                      🎲🎲 2 Dés
                    </button>
                  </div>

                  {/* Mode selector */}
                  <div className="grid grid-cols-1 gap-2 text-left">
                    <button
                      type="button"
                      data-testid="parchisi-mode-1v1"
                      disabled={!isHost}
                      onClick={() => handleSelectSetupConfig('1v1', selectedDiceCount)}
                      className={`w-full px-3.5 py-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        selectedMode === '1v1'
                          ? 'bg-[#FFE8E2]/65 border-[#FF6B57] text-[#1F242D] shadow-xs'
                          : 'bg-[#FAF7F2] border-[#EAE4DC] text-[#6B7280] hover:border-[#FF6B57]/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1F242D] leading-tight flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-[#FF6B57] shrink-0" />
                          <span>1v1 Classic</span>
                        </p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          Red vs Yellow · Opposite corners
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-[#FF6B57] shrink-0">Default</span>
                    </button>

                    <button
                      type="button"
                      data-testid="parchisi-mode-4p"
                      disabled={!isHost}
                      onClick={() => handleSelectSetupConfig('4p', selectedDiceCount)}
                      className={`w-full px-3.5 py-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        selectedMode === '4p'
                          ? 'bg-[#EFE9FB] border-[#7C5CFC] text-[#1F242D] shadow-xs'
                          : 'bg-[#FAF7F2] border-[#EAE4DC] text-[#6B7280] hover:border-[#7C5CFC]/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1F242D] leading-tight flex items-center gap-1.5">
                          <Crown className="w-4 h-4 text-[#7C5CFC] shrink-0" />
                          <span>4-Player Classic</span>
                        </p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          Red, Yellow + Blue & Green AI Bots
                        </p>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {gameState.phase !== 'READY' && (
                      <button
                        type="button"
                        onClick={() => setSetupModalOpen(false)}
                        className="min-h-[46px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold bg-[#FAF7F2] hover:bg-[#F1ECE3] text-[#1F242D] border border-[#EAE4DC] cursor-pointer"
                      >
                        {t.cancelBtn}
                      </button>
                    )}
                    <button
                      type="button"
                      data-start="true"
                      data-testid="parchisi-start-btn"
                      onClick={() => handleStartMatch(selectedMode, selectedDiceCount)}
                      className="flex-1 min-h-[46px] px-5 py-2.5 rounded-2xl text-sm sm:text-base font-extrabold text-white bg-[#FF6B57] hover:bg-[#F25743] active:scale-[0.98] shadow-[0_6px_18px_rgba(255,107,87,0.35)] transition-all whitespace-nowrap cursor-pointer"
                    >
                      Start Match
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Victory Modal Overlay (GAME_OVER phase) */}
            {gameState.phase === 'GAME_OVER' && gameState.winner && (
              <div className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-[#1F242D]/40 backdrop-blur-xs rounded-2xl">
                <div
                  data-testid="parchisi-victory-modal"
                  className="w-full max-w-[336px] rounded-3xl bg-white border border-[#EAE4DC] shadow-[0_20px_54px_rgba(31,36,45,0.2)] p-5 text-center space-y-4"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      style={{ backgroundColor: COLOR_PALETTE[gameState.winner].fill }}
                      className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-white text-white shadow-md"
                    >
                      <Crown className="w-6 h-6" />
                    </span>
                    <h2 className="text-2xl font-extrabold text-[#1F242D]">
                      {colorNames[gameState.winner]} Wins!
                    </h2>
                    <p className="text-xs text-[#6B7280] font-medium">
                      All 4 tokens reached the Center Goal
                    </p>
                  </div>

                  {/* 3 Tabular Stats */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#EAE4DC]">
                    <div>
                      <p className="text-lg font-extrabold text-[#FF6B57] tabular-nums">
                        {gameState.stats[gameState.winner].captures}
                      </p>
                      <p className="text-[11px] text-[#6B7280] font-semibold">Captures</p>
                    </div>
                    <div>
                      <p className="text-lg font-extrabold text-[#7C5CFC] tabular-nums">
                        {gameState.stats[gameState.winner].doublesRolled}
                      </p>
                      <p className="text-[11px] text-[#6B7280] font-semibold">Doubles</p>
                    </div>
                    <div>
                      <p className="text-lg font-extrabold text-[#16A34A] tabular-nums">
                        {gameState.stats[gameState.winner].homeEntries}/4
                      </p>
                      <p className="text-[11px] text-[#6B7280] font-semibold">Home</p>
                    </div>
                  </div>

                  {isHost ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-start="true"
                        data-testid="parchisi-play-again-btn"
                        onClick={() => handleStartMatch(gameState.mode, gameState.diceCount)}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-extrabold text-white bg-[#FF6B57] hover:bg-[#F25743] shadow-sm whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 shrink-0" />
                        <span>Play Again</span>
                      </button>
                      <button
                        type="button"
                        onClick={onReturnToRoomMenu}
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-bold bg-[#FAF7F2] hover:bg-[#F1ECE3] text-[#1F242D] border border-[#EAE4DC] whitespace-nowrap cursor-pointer"
                      >
                        {t.backToRoomMenu}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-[#7C5CFC] py-1">
                      {t.roomMenuGuestWaitingBadge}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. CLASSIC BOTTOM PLAYER HUD BAR (Red BL + Active Bottom Dice Tray · Green BR in 4P) */}
        <div className="relative z-20 w-full max-w-[660px] flex items-center justify-between gap-2 px-1 shrink-0 min-h-[48px]">
          <div className="flex items-center gap-2 min-w-0">
            <PlayerAvatarBadge
              color="red"
              name={colorNames.red}
              homeCount={homeCount('red')}
              isActiveTurn={gameState.turn === 'red' && gameState.phase !== 'READY'}
              turnRemainingFrac={turnFrac}
              align="left"
              showMicMuted={redIsLocal ? micMuted : partnerMicMuted}
              isSpeaking={redIsLocal ? localSpeaking : remoteSpeaking}
            />
            {(gameState.turn === 'red' || gameState.phase === 'READY') && (
              <ParchisiDice3D
                dice={
                  gameState.phase === 'READY'
                    ? gameState.diceCount === 1
                      ? [5]
                      : [5, 6]
                    : displayedDice
                }
                usedDice={gameState.usedDice}
                diceCount={gameState.diceCount}
                pendingBonus={activeBonus}
                rollSeq={gameState.rollSeq}
                rolling={isRollingAnim}
                shakeIntensity={0}
                canRoll={localColor === 'red' && canRollNow}
                isActiveTray={gameState.turn === 'red' && gameState.phase !== 'READY'}
                compact={gameState.mode === '4p'}
                accentColor={COLOR_PALETTE.red.fill}
                onRoll={handleRollDice}
                ariaLabel={gameState.diceCount === 1 ? 'Roll die for Red' : 'Roll both dice for Red'}
              />
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {gameState.mode === '4p' ? (
              <>
                {isBottomTurn && gameState.turn === 'green' && gameState.phase !== 'READY' && (
                  <ParchisiDice3D
                    dice={displayedDice}
                    usedDice={gameState.usedDice}
                    diceCount={gameState.diceCount}
                    pendingBonus={activeBonus}
                    rollSeq={gameState.rollSeq}
                    rolling={isRollingAnim}
                    shakeIntensity={0}
                    canRoll={false}
                    isActiveTray
                    compact
                    accentColor={COLOR_PALETTE.green.fill}
                    onRoll={handleRollDice}
                    ariaLabel="Green AI dice"
                  />
                )}
                <PlayerAvatarBadge
                  color="green"
                  name={colorNames.green}
                  homeCount={homeCount('green')}
                  isActiveTurn={gameState.turn === 'green' && gameState.phase !== 'READY'}
                  turnRemainingFrac={turnFrac}
                  align="right"
                  isBot
                />
              </>
            ) : (
              <div className="text-right text-[11px] sm:text-xs font-bold text-[#6B7280] tabular-nums">
                {gameState.phase === 'WAIT_ROLL' || gameState.phase === 'WAIT_MOVE' ? (
                  <span>
                    {Math.ceil(turnSecondsLeft)}s · {gameState.diceCount === 1 ? '1 Dé' : '2 Dés'}
                  </span>
                ) : (
                  <span>1v1 Classic</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. BOTTOM QUICK BAR (EMOJI · QUICK TAUNTS · LIVE CHAT DRAWER · MODE OPTIONS · SFX) */}
      <div className="relative z-30 w-full max-w-[660px] flex items-center justify-center gap-1.5 sm:gap-2 pt-1 shrink-0 touch-manipulation select-none">
        {openDrawer !== 'none' && (
          <div
            data-testid={`parchisi-${openDrawer}-drawer`}
            className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-1.5 max-w-[94vw] px-2.5 py-2 rounded-2xl bg-white border border-[#EAE4DC] shadow-[0_12px_32px_rgba(31,36,45,0.16)]"
          >
            {openDrawer === 'emoji'
              ? QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleSendEmoji(em)}
                    aria-label={`Send ${em} reaction`}
                    className="w-11 h-11 rounded-full bg-[#FAF7F2] hover:bg-[#FFE8E2] active:scale-90 text-xl flex items-center justify-center transition-transform cursor-pointer"
                  >
                    {em}
                  </button>
                ))
              : QUICK_CHATS.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => handleSendQuickChat(phrase)}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-[#FFE8E2] border border-[#EAE4DC] text-xs font-bold text-[#1F242D] whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {phrase}
                  </button>
                ))}
          </div>
        )}

        <button
          type="button"
          data-testid="parchisi-emoji-btn"
          aria-expanded={openDrawer === 'emoji'}
          onClick={() => setOpenDrawer((prev) => (prev === 'emoji' ? 'none' : 'emoji'))}
          className={`min-h-[40px] inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold tracking-wide border transition-colors whitespace-nowrap shadow-xs cursor-pointer ${
            openDrawer === 'emoji'
              ? 'bg-[#FF6B57] text-white border-[#FF6B57]'
              : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
          }`}
        >
          <Smile className="w-3.5 h-3.5 shrink-0" />
          <span>EMOJI</span>
        </button>

        <button
          type="button"
          data-testid="parchisi-chat-btn"
          aria-expanded={openDrawer === 'chat'}
          onClick={() => setOpenDrawer((prev) => (prev === 'chat' ? 'none' : 'chat'))}
          className={`min-h-[40px] inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold tracking-wide border transition-colors whitespace-nowrap shadow-xs cursor-pointer ${
            openDrawer === 'chat'
              ? 'bg-[#FF6B57] text-white border-[#FF6B57]'
              : 'bg-white text-[#1F242D] border-[#EAE4DC] hover:bg-[#FFFDF9]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span>TAUNT</span>
        </button>

        <button
          type="button"
          data-testid="parchisi-live-chat-btn"
          onClick={() => {
            setOpenDrawer('none');
            onOpenLiveChat();
          }}
          className="relative min-h-[40px] inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold bg-[#FFE8E2] text-[#C8412F] border border-[#FFD1C7] hover:bg-[#FFDAD0] transition-colors whitespace-nowrap shadow-xs cursor-pointer"
        >
          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{t.chatToggleLabel}</span>
          {unreadChatCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B57] text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </button>

        {isHost && (
          <button
            type="button"
            data-testid="parchisi-mode-btn"
            onClick={() => {
              soundFx.click();
              setOpenDrawer('none');
              setSetupModalOpen(true);
            }}
            title="1v1 / 4P · 1 Dé / 2 Dés"
            className="min-h-[40px] inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FFFDF9] transition-colors whitespace-nowrap shadow-xs cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#7C5CFC] shrink-0" />
            <span>{gameState.mode === '4p' ? '4P' : '1v1'}</span>
          </button>
        )}

        <button
          type="button"
          data-testid="parchisi-mute-toggle"
          aria-label={sfxMutedLocal ? 'Unmute sound' : 'Mute sound'}
          aria-pressed={sfxMutedLocal}
          onClick={handleToggleSoundMute}
          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full bg-white text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FFFDF9] transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          {sfxMutedLocal ? (
            <VolumeX className="w-4 h-4 text-[#6B7280]" />
          ) : (
            <Volume2 className="w-4 h-4 text-[#FF6B57]" />
          )}
        </button>
      </div>

      {/* Celebratory Confetti Burst on Center Home Entry & Victory */}
      {confettiSeed > 0 && (
        <div
          key={`confetti-${confettiSeed}`}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        >
          {Array.from({ length: 24 }, (_, idx) => {
            const left = (idx * 4.3 + ((confettiSeed * 13) % 9)) % 100;
            const delay = (idx % 6) * 0.08;
            const color = CONFETTI_COLORS[idx % CONFETTI_COLORS.length];
            return (
              <span
                key={idx}
                style={{
                  left: `${left}%`,
                  top: '-14px',
                  backgroundColor: color,
                  animationDelay: `${delay}s`,
                  animationDuration: '1.5s',
                }}
                className="absolute w-2.5 h-3.5 rounded-sm opacity-90 animate-bounce"
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
