import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  Camera,
  Crown,
  Hand,
  MessageSquare,
  MicOff,
  RotateCcw,
  Smile,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  HandMetrics,
  ParchisiColor,
  ParchisiMode,
  ParchisiMoveOption,
  ParchisiState,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import { COLOR_PALETTE, PARCHISI_HOME_PROGRESS } from '../game/parchisiBoard';
import {
  applyParchisiMove,
  chooseAiParchisiMove,
  createHandShakeState,
  createInitialParchisiState,
  getLegalParchisiMoves,
  PARCHISI_STEP_ANIM_MS,
  PARCHISI_TURN_SECONDS,
  passParchisiTurnOrBonus,
  rollParchisiDice,
  startParchisiMatch,
  stepHandShakeDetector,
} from '../game/parchisiLogic';
import { soundFx } from '../utils/soundFx';
import { AvatarCanvas } from './AvatarCanvas';
import { ParchisiBoardSvg, type FloatingReactionItem } from './ParchisiBoardSvg';
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
const BASE_CAMS_STORAGE_KEY = 'parchisi_base_cams';

function readStoredBaseCams(): boolean {
  try {
    const raw = window.localStorage.getItem(BASE_CAMS_STORAGE_KEY);
    if (raw === '0' || raw === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

/** Subtle inline SVG damask pattern for the deep aubergine/plum backdrop */
const DAMASK_BG_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%23E8C4A0' stroke-opacity='0.065' stroke-width='1'%3E%3Cpath d='M32 4 L60 32 L32 60 L4 32 Z'/%3E%3Ccircle cx='32' cy='32' r='10'/%3E%3Cpath d='M32 14 L42 32 L32 50 L22 32 Z'/%3E%3Ccircle cx='0' cy='0' r='6'/%3E%3Ccircle cx='64' cy='0' r='6'/%3E%3Ccircle cx='0' cy='64' r='6'/%3E%3Ccircle cx='64' cy='64' r='6'/%3E%3C/g%3E%3C/svg%3E")`;

interface PlayerAvatarBadgeProps {
  color: ParchisiColor;
  name: string;
  homeCount: number;
  isActiveTurn: boolean;
  turnRemainingFrac: number; // 0..1
  align?: 'left' | 'right';
  videoRef?: MutableRefObject<HTMLVideoElement | null>;
  showLiveVideo?: boolean;
  mirrorVideo?: boolean;
  showMicMuted?: boolean;
  faceMetricsRef?: MutableRefObject<FaceMetrics>;
  isBot?: boolean;
}

function PlayerAvatarBadge({
  color,
  name,
  homeCount,
  isActiveTurn,
  turnRemainingFrac,
  align = 'left',
  videoRef,
  showLiveVideo = false,
  mirrorVideo = false,
  showMicMuted = false,
  faceMetricsRef,
  isBot = false,
}: PlayerAvatarBadgeProps) {
  const pal = COLOR_PALETTE[color];
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const clampedFrac = Math.max(0, Math.min(1, turnRemainingFrac));
  const dashOffset = circumference * (1 - clampedFrac);
  const urgentTimer = isActiveTurn && clampedFrac < 0.25;

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
          stroke={isActiveTurn ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)'}
          strokeWidth={isActiveTurn ? '3.5' : '2.5'}
        />
        {isActiveTurn ? (
          <circle
            cx="26"
            cy="26"
            r={radius}
            fill="none"
            stroke={urgentTimer ? '#EF4444' : '#FACC15'}
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
            opacity="0.8"
          />
        )}
      </svg>

      {/* Circular Avatar / Live Webcam Frame */}
      <div
        style={{
          boxShadow: isActiveTurn
            ? `0 0 16px ${pal.fill}99`
            : '0 2px 8px rgba(0,0,0,0.45)',
          borderColor: pal.fill,
        }}
        className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 bg-[#1A0E1A] flex items-center justify-center"
      >
        {videoRef && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={mirrorVideo}
            className={`w-full h-full object-cover ${mirrorVideo ? 'mirror-video' : ''} ${
              showLiveVideo ? 'block' : 'hidden'
            }`}
          />
        )}
        {!showLiveVideo && faceMetricsRef ? (
          <AvatarCanvas
            name={name}
            metricsRef={faceMetricsRef}
            accentColor={pal.fill}
            bgTop={pal.dark}
            bgBottom="#1A0E1A"
            isAi={isBot}
          />
        ) : !showLiveVideo ? (
          <div
            style={{ background: `radial-gradient(circle at 35% 30%, ${pal.light}, ${pal.dark})` }}
            className="w-full h-full flex items-center justify-center text-xs sm:text-sm font-black text-white"
          >
            {name.slice(0, 2).toUpperCase()}
          </div>
        ) : null}

        {showMicMuted && (
          <span
            aria-label="Microphone muted"
            className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#EF4444] text-white flex items-center justify-center border border-[#1E101D]"
          >
            <MicOff className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
    </div>
  );

  const infoEl = (
    <div className={`min-w-0 flex flex-col ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      <span className="max-w-[82px] sm:max-w-[116px] truncate text-xs sm:text-sm font-bold text-[#FFF7ED] leading-tight">
        {name}
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E8C4A0]/85 tabular-nums leading-tight">
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
  const [gameState, setGameState] = useState<ParchisiState>(() =>
    createInitialParchisiState('1v1'),
  );
  const stateRef = useRef<ParchisiState>(gameState);
  stateRef.current = gameState;

  const [isRollingAnim, setIsRollingAnim] = useState(false);
  const [tumbleDice, setTumbleDice] = useState<[number, number] | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [hoveredTokenId, setHoveredTokenId] = useState<number | null>(null);
  const [hoveredOption, setHoveredOption] = useState<ParchisiMoveOption | null>(null);
  const [animOverride, setAnimOverride] = useState<{
    color: ParchisiColor;
    tokenId: number;
    progress: number;
    hopBoost: boolean;
  } | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReactionItem[]>([]);
  const [openDrawer, setOpenDrawer] = useState<'none' | 'emoji' | 'chat'>('none');
  const [sfxMutedLocal, setSfxMutedLocal] = useState(() => soundFx.muted);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(PARCHISI_TURN_SECONDS);
  const [noMovesBanner, setNoMovesBanner] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState(0);
  const [baseCamsEnabled, setBaseCamsEnabled] = useState<boolean>(readStoredBaseCams);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const showLocalLiveVideo = Boolean(localStream) && cameraEnabled;
  const showRemoteLiveVideo = Boolean(remoteStream) && !isSolo;

  // Base Camera Mode mapping: Red Base = Host, Yellow Base = Guest; mirror ONLY localStream
  const redBaseStream =
    localColor === 'red'
      ? showLocalLiveVideo
        ? localStream
        : null
      : showRemoteLiveVideo
        ? remoteStream
        : null;
  const yellowBaseStream =
    localColor === 'yellow'
      ? showLocalLiveVideo
        ? localStream
        : null
      : showRemoteLiveVideo
        ? remoteStream
        : null;
  const mirrorRedBase = localColor === 'red';
  const mirrorYellowBase = localColor === 'yellow';

  const handleToggleBaseCams = useCallback(() => {
    soundFx.click();
    setBaseCamsEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(BASE_CAMS_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore storage quota / private-mode errors
      }
      return next;
    });
  }, []);

  const handDetectorRef = useRef(createHandShakeState());
  const reactionIdRef = useRef(1);
  const lastRollSeqRef = useRef(0);
  const lastAnimSeqRef = useRef(0);
  const victoryRecordedRef = useRef(false);

  // Attach local & remote MediaStreams cleanly into HUD avatar videos
  useEffect(() => {
    const v = localVideoRef.current;
    onVideoRef(v);
    if (!v) return;
    if (showLocalLiveVideo && localStream) {
      if (v.srcObject !== localStream) v.srcObject = localStream;
      v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
    return () => {
      onVideoRef(null);
    };
  }, [localStream, showLocalLiveVideo, onVideoRef]);

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

  // Cleanup hand tracker toggle on unmount
  useEffect(() => {
    return () => {
      onToggleHandDice(false);
    };
  }, [onToggleHandDice]);

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

  // Host-authoritative state commit + PeerJS broadcast
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

  const canRollNow = isLocalTurn && gameState.phase === 'WAIT_ROLL' && !isRollingAnim && !animOverride;
  const canInteractBoard =
    isLocalTurn &&
    gameState.phase === 'WAIT_MOVE' &&
    !isRollingAnim &&
    !animOverride &&
    legalMoves.length > 0;

  // Trigger dice tumbling visual + Web Audio rattle whenever rollSeq advances
  useEffect(() => {
    if (gameState.rollSeq === 0 || gameState.rollSeq === lastRollSeqRef.current) return;
    lastRollSeqRef.current = gameState.rollSeq;
    soundFx.parchisiDiceRoll();
    setIsRollingAnim(true);

    let tick = 0;
    const tumbleInterval = window.setInterval(() => {
      tick += 1;
      setTumbleDice([
        ((tick * 3 + 1) % 6) + 1,
        ((tick * 5 + 2) % 6) + 1,
      ]);
    }, 65);

    const stopTimer = window.setTimeout(() => {
      window.clearInterval(tumbleInterval);
      setTumbleDice(null);
      setIsRollingAnim(false);
      if (gameState.lastEventTone === 'warning') {
        soundFx.parchisiCurseTripleSix();
      }
    }, 390);

    return () => {
      window.clearInterval(tumbleInterval);
      window.clearTimeout(stopTimer);
    };
  }, [gameState.rollSeq, gameState.lastEventTone]);

  // Smooth step-by-step 105ms tile hop animation + authentic Web Audio SFX
  useEffect(() => {
    const anim = gameState.lastMoveAnim;
    if (!anim || anim.seq === lastAnimSeqRef.current) return;
    lastAnimSeqRef.current = anim.seq;

    if (anim.path.length === 0) return;

    let stepIdx = 0;
    let hopTimer: number | null = null;
    let settleTimer: number | null = null;

    const advanceStep = () => {
      const prog = anim.path[stepIdx];
      setAnimOverride({
        color: anim.color,
        tokenId: anim.tokenId,
        progress: prog,
        hopBoost: true,
      });
      soundFx.parchisiPawnHop(stepIdx);

      stepIdx += 1;
      if (stepIdx < anim.path.length) {
        hopTimer = window.setTimeout(advanceStep, PARCHISI_STEP_ANIM_MS);
      } else {
        settleTimer = window.setTimeout(() => {
          setAnimOverride(null);
          if (anim.captured.length > 0) {
            soundFx.parchisiCaptureDrama();
            window.setTimeout(() => soundFx.parchisiBonusPowerChime(20), 210);
          } else if (anim.reachedHome) {
            soundFx.parchisiThroneArrival();
            setConfettiSeed((s) => s + 1);
            window.setTimeout(() => soundFx.parchisiBonusPowerChime(10), 220);
          } else if (anim.landedSafe) {
            soundFx.parchisiSafeStarChime();
          }
        }, PARCHISI_STEP_ANIM_MS);
      }
    };

    advanceStep();

    return () => {
      if (hopTimer !== null) window.clearTimeout(hopTimer);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
    };
  }, [gameState.lastMoveAnim]);

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

  // Start or Restart match
  const handleStartMatch = useCallback(
    (mode: ParchisiMode = selectedMode) => {
      if (!isHost) return;
      soundFx.click();
      setOpenDrawer('none');
      setNoMovesBanner(false);
      lastRollSeqRef.current = 0;
      lastAnimSeqRef.current = 0;
      const fresh = startParchisiMatch(mode, Date.now());
      commitHostState(fresh);
      if (connectionMode === 'p2p-host') {
        onSendPeerMessage({ type: 'PARCHISI_START', mode });
      }
    },
    [isHost, selectedMode, commitHostState, connectionMode, onSendPeerMessage],
  );

  // Bind Enter / Space while in READY title card to start match immediately
  useEffect(() => {
    if (gameState.phase !== 'READY' || !isHost) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleStartMatch(selectedMode);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState.phase, isHost, handleStartMatch, selectedMode]);

  // Roll both dice (Host executes directly; Guest sends PeerJS action)
  const handleRollDice = useCallback(() => {
    const st = stateRef.current;
    if (st.phase !== 'WAIT_ROLL' || st.turn !== localColor) return;
    if (isRollingAnim || animOverride) return;

    if (isHost) {
      commitHostState(rollParchisiDice(st));
    } else {
      onSendPeerMessage({ type: 'PARCHISI_ACTION', action: 'ROLL' });
    }
  }, [localColor, isRollingAnim, animOverride, isHost, commitHostState, onSendPeerMessage]);

  // Execute a chosen move option
  const handleExecuteMove = useCallback(
    (move: ParchisiMoveOption) => {
      const st = stateRef.current;
      if (st.phase !== 'WAIT_MOVE' || st.turn !== localColor) return;
      if (isRollingAnim || animOverride) return;

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
    [localColor, isRollingAnim, animOverride, isHost, commitHostState, onSendPeerMessage],
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

  // PeerJS incoming message handler
  useEffect(() => {
    registerPeerHandler((msg) => {
      if (msg.type === 'PARCHISI_STATE' && !isHost) {
        stateRef.current = msg.state;
        setGameState(msg.state);
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
  }, [registerPeerHandler, isHost, commitHostState, spawnReaction]);

  // Host Auto-Skip: if active player has 0 legal moves during WAIT_MOVE, show "No legal moves" for 1.1s & advance
  useEffect(() => {
    if (gameState.phase !== 'WAIT_MOVE' || isRollingAnim || animOverride) {
      setNoMovesBanner(false);
      return;
    }
    if (legalMoves.length > 0) {
      setNoMovesBanner(false);
      return;
    }

    setNoMovesBanner(true);
    if (!isHost) return;

    const timer = window.setTimeout(() => {
      setNoMovesBanner(false);
      commitHostState(passParchisiTurnOrBonus(stateRef.current));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [gameState.phase, gameState.stateSeq, legalMoves.length, isRollingAnim, animOverride, isHost, commitHostState]);

  // Host Smart AI Loop (~700ms natural pacing for Yellow AI in Solo & Blue/Green AI in 4-Player)
  useEffect(() => {
    if (!isHost || isRollingAnim || animOverride) return;
    if (!isBotTurn(gameState)) return;

    if (gameState.phase === 'WAIT_ROLL') {
      const t = window.setTimeout(() => {
        const cur = stateRef.current;
        if (cur.phase === 'WAIT_ROLL' && isBotTurn(cur)) {
          commitHostState(rollParchisiDice(cur));
        }
      }, 700);
      return () => window.clearTimeout(t);
    }

    if (gameState.phase === 'WAIT_MOVE' && legalMoves.length > 0) {
      const t = window.setTimeout(() => {
        const cur = stateRef.current;
        if (cur.phase === 'WAIT_MOVE' && isBotTurn(cur)) {
          const choice = chooseAiParchisiMove(cur);
          if (choice) {
            commitHostState(applyParchisiMove(cur, choice.id));
          }
        }
      }, 720);
      return () => window.clearTimeout(t);
    }
  }, [
    isHost,
    gameState,
    legalMoves.length,
    isRollingAnim,
    animOverride,
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

      if (rem <= 0 && isHost && !isRollingAnim && !animOverride) {
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
    animOverride,
    commitHostState,
  ]);

  // Optional Hand-Shake Dice Roll (MediaPipe HandLandmarker)
  useEffect(() => {
    if (!handDiceEnabled || !canRollNow) {
      setShakeIntensity(0);
      return;
    }

    let rafId = 0;
    const poll = () => {
      rafId = requestAnimationFrame(poll);
      const hm = localHandMetricsRef.current;
      const res = stepHandShakeDetector(
        handDetectorRef.current,
        hm.handDetected,
        hm.palmX,
        hm.palmY,
        performance.now(),
      );
      setShakeIntensity(res.intensity);
      if (res.triggered) {
        handleRollDice();
      }
    };
    rafId = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafId);
      setShakeIntensity(0);
    };
  }, [handDiceEnabled, canRollNow, localHandMetricsRef, handleRollDice]);

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
      gameState.tokens[color].filter((t) => t.progress >= PARCHISI_HOME_PROGRESS).length,
    [gameState.tokens],
  );

  const displayedDice = isRollingAnim && tumbleDice ? tumbleDice : gameState.dice;
  const activeBonus = gameState.pendingBonuses[0] ?? null;
  const turnFrac = turnSecondsLeft / PARCHISI_TURN_SECONDS;
  const isTopTurn = gameState.turn === 'yellow' || gameState.turn === 'blue';
  const isBottomTurn = gameState.turn === 'red' || gameState.turn === 'green';

  // Live concise turn prompt text (clean unboxed text)
  const turnStatusLine = useMemo(() => {
    if (gameState.phase === 'READY') return 'Official 2-Dice Parcheesi';
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
        ? 'Your turn · Roll both dice'
        : `${colorNames[gameState.turn]} is rolling…`;
    }
    return isLocalTurn
      ? 'Pick a highlighted token'
      : `${colorNames[gameState.turn]} is moving…`;
  }, [gameState.phase, gameState.winner, gameState.turn, gameState.mustBreakBlockade, noMovesBanner, activeBonus, isLocalTurn, colorNames]);

  const handleToggleSoundMute = () => {
    const next = !sfxMutedLocal;
    soundFx.muted = next;
    setSfxMutedLocal(next);
    if (!next) soundFx.click();
  };

  return (
    <section
      data-testid="parchisi-game-root"
      style={{
        backgroundImage: `${DAMASK_BG_SVG}, radial-gradient(circle at 50% 42%, #3B1F37 0%, #2D182A 52%, #1E101D 100%)`,
        WebkitTapHighlightColor: 'transparent',
      }}
      className="relative flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col items-center justify-between px-1 sm:px-4 py-1 sm:py-2 select-none touch-manipulation text-[#FFF7ED]"
    >
      {/* CENTERED STAGE: Top HUD + Square Wooden Board (96-100% mobile width) + Bottom HUD snugly framed together */}
      <div className="relative z-10 flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-1.5 sm:gap-2 overflow-hidden">
      {/* 1. CLASSIC TOP PLAYER HUD BAR (Blue TL in 4P · Yellow TR + Active Top Dice Tray) */}
      <div className="relative z-20 w-full max-w-[660px] flex items-center justify-between gap-2 px-1 shrink-0 min-h-[48px]">
        {/* Top-Left slot: Blue AI (4P) or clean event status readout (1v1) */}
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
                  pendingBonus={activeBonus}
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
                className={`text-xs sm:text-sm font-bold truncate ${
                  noMovesBanner
                    ? 'text-[#FCA5A5]'
                    : activeBonus !== null
                      ? 'text-[#FDE047]'
                      : 'text-[#FDE8D3]'
                }`}
              >
                {turnStatusLine}
              </span>
              {gameState.lastEventText && gameState.phase !== 'READY' && (
                <span className="text-[11px] text-[#E8C4A0]/75 truncate max-w-[165px] sm:max-w-[260px]">
                  {gameState.lastEventText}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Top-Right slot: Yellow's 2-Dice Tray (when Yellow active) + Yellow Avatar Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {isTopTurn && gameState.turn === 'yellow' && gameState.phase !== 'READY' && (
            <ParchisiDice3D
              dice={displayedDice}
              usedDice={gameState.usedDice}
              pendingBonus={activeBonus}
              rolling={isRollingAnim}
              shakeIntensity={localColor === 'yellow' ? shakeIntensity : 0}
              canRoll={localColor === 'yellow' && canRollNow}
              isActiveTray
              compact={gameState.mode === '4p'}
              accentColor={COLOR_PALETTE.yellow.fill}
              onRoll={handleRollDice}
              ariaLabel="Roll both dice for Yellow"
            />
          )}
          <PlayerAvatarBadge
            color="yellow"
            name={colorNames.yellow}
            homeCount={homeCount('yellow')}
            isActiveTurn={gameState.turn === 'yellow' && gameState.phase !== 'READY'}
            turnRemainingFrac={turnFrac}
            align="right"
            videoRef={localColor === 'yellow' ? localVideoRef : remoteVideoRef}
            showLiveVideo={localColor === 'yellow' ? showLocalLiveVideo : showRemoteLiveVideo}
            mirrorVideo={localColor === 'yellow'}
            showMicMuted={localColor === 'yellow' && micMuted}
            faceMetricsRef={localColor === 'yellow' ? localFaceMetricsRef : partnerFaceMetricsRef}
            isBot={isSolo && localColor !== 'yellow'}
          />
        </div>
      </div>

      {/* 2. CENTER SQUARE WOODEN PARCHEESI BOARD (96-100% mobile width, HD crisp, zero scroll) */}
      <div className="relative z-10 w-full flex-1 min-h-0 max-h-[min(100%,98vw)] flex items-center justify-center [container-type:size]">
        <div className="relative w-[min(100cqw,100cqh)] h-[min(100cqw,100cqh)] flex items-center justify-center">
          <ParchisiBoardSvg
            state={gameState}
            legalMoves={legalMoves}
            canInteract={canInteractBoard}
            selectedTokenId={selectedTokenId}
            hoveredMove={activeHoveredMove}
            animOverride={animOverride}
            floatingReactions={floatingReactions}
            baseCamsEnabled={baseCamsEnabled}
            redBaseStream={redBaseStream}
            yellowBaseStream={yellowBaseStream}
            mirrorRedBase={mirrorRedBase}
            mirrorYellowBase={mirrorYellowBase}
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
              className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-[#241222]/95 border border-[#FACC15]/75 text-xs sm:text-sm font-bold text-[#FEF3C7] shadow-xl whitespace-nowrap"
            >
              No legal moves
            </div>
          )}

          {/* Setup Modal Overlay (READY phase) */}
          {gameState.phase === 'READY' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-3 bg-[#1E101D]/65 rounded-2xl">
              <div
                data-testid="parchisi-setup-modal"
                style={{
                  background: 'linear-gradient(180deg, #3A1F36 0%, #241222 100%)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,232,190,0.22)',
                }}
                className="w-full max-w-[330px] rounded-2xl border-2 border-[#C58B58]/80 p-4 sm:p-5 text-center space-y-3.5"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-b from-[#FEF08A] to-[#D97706] text-[#2B1503] shadow-lg">
                    <Crown className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#FFF7ED]">
                    Official Parcheesi
                  </h2>
                  <p className="text-xs text-[#E8C4A0]/85">
                    2 Dice · Exit on 5 · Capture +20 · Home +10
                  </p>
                </div>

                {/* Mode selector (Host picks; Guest sees live selection) */}
                <div className="grid grid-cols-1 gap-2 text-left">
                  <button
                    type="button"
                    data-testid="parchisi-mode-1v1"
                    disabled={!isHost}
                    onClick={() => {
                      soundFx.click();
                      setSelectedMode('1v1');
                      setGameState(createInitialParchisiState('1v1'));
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      selectedMode === '1v1'
                        ? 'bg-[#C58B58]/22 border-[#FACC15] text-white shadow'
                        : 'bg-black/25 border-white/15 text-[#E8C4A0]/80 hover:border-white/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#FACC15] shrink-0" />
                        <span>1v1 Classic</span>
                      </p>
                      <p className="text-[11px] text-[#E8C4A0]/80 mt-0.5">
                        Red vs Yellow · Opposite corners
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-[#FDE047] shrink-0">Default</span>
                  </button>

                  <button
                    type="button"
                    data-testid="parchisi-mode-4p"
                    disabled={!isHost}
                    onClick={() => {
                      soundFx.click();
                      setSelectedMode('4p');
                      setGameState(createInitialParchisiState('4p'));
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      selectedMode === '4p'
                        ? 'bg-[#C58B58]/22 border-[#FACC15] text-white shadow'
                        : 'bg-black/25 border-white/15 text-[#E8C4A0]/80 hover:border-white/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-[#64B5F6] shrink-0" />
                        <span>4-Player Classic</span>
                      </p>
                      <p className="text-[11px] text-[#E8C4A0]/80 mt-0.5">
                        Red, Yellow + Blue & Green AI Bots
                      </p>
                    </div>
                  </button>
                </div>

                {isHost ? (
                  <button
                    type="button"
                    data-start="true"
                    data-testid="parchisi-start-btn"
                    onClick={() => handleStartMatch(selectedMode)}
                    className="w-full min-h-[46px] px-5 py-2.5 rounded-xl text-sm sm:text-base font-extrabold text-[#2B1503] bg-gradient-to-b from-[#FEF08A] via-[#FACC15] to-[#D97706] hover:brightness-105 active:scale-[0.98] shadow-[0_6px_18px_rgba(250,204,21,0.4)] transition-all whitespace-nowrap"
                  >
                    Start Match
                  </button>
                ) : (
                  <p className="text-xs font-semibold text-[#FDE047] py-1">
                    Waiting for {colorNames.red} to start the match…
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Victory Modal Overlay (GAME_OVER phase) */}
          {gameState.phase === 'GAME_OVER' && gameState.winner && (
            <div className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-[#1E101D]/78 rounded-2xl">
              <div
                data-testid="parchisi-victory-modal"
                style={{
                  background: 'linear-gradient(180deg, #3A1F36 0%, #241222 100%)',
                  boxShadow: '0 22px 54px rgba(0,0,0,0.75)',
                }}
                className="w-full max-w-[330px] rounded-2xl border-2 border-[#FACC15] p-5 text-center space-y-4"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    style={{ backgroundColor: COLOR_PALETTE[gameState.winner].fill }}
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-[#FEF08A] text-white shadow-lg"
                  >
                    <Crown className="w-6 h-6" />
                  </span>
                  <h2 className="text-2xl font-extrabold text-[#FFF7ED]">
                    {colorNames[gameState.winner]} Wins!
                  </h2>
                  <p className="text-xs text-[#E8C4A0]">
                    All 4 tokens reached the Center Goal
                  </p>
                </div>

                {/* 3 Tabular Stats */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/12">
                  <div>
                    <p className="text-lg font-extrabold text-[#FDE047] tabular-nums">
                      {gameState.stats[gameState.winner].captures}
                    </p>
                    <p className="text-[11px] text-[#E8C4A0]/80">Captures</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-[#FDE047] tabular-nums">
                      {gameState.stats[gameState.winner].doublesRolled}
                    </p>
                    <p className="text-[11px] text-[#E8C4A0]/80">Doubles</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-[#FDE047] tabular-nums">
                      {gameState.stats[gameState.winner].homeEntries}/4
                    </p>
                    <p className="text-[11px] text-[#E8C4A0]/80">Home</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isHost && (
                    <button
                      type="button"
                      data-start="true"
                      data-testid="parchisi-play-again-btn"
                      onClick={() => handleStartMatch(gameState.mode)}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-extrabold text-[#2B1503] bg-gradient-to-b from-[#FEF08A] to-[#EAB308] hover:brightness-105 whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4 shrink-0" />
                      <span>Play Again</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onReturnToHub}
                    className="flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/18 text-[#FFF7ED] border border-white/20 whitespace-nowrap"
                  >
                    Switch Game
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. CLASSIC BOTTOM PLAYER HUD BAR (Red BL + Active Bottom Dice Tray · Green BR in 4P) */}
      <div className="relative z-20 w-full max-w-[660px] flex items-center justify-between gap-2 px-1 shrink-0 min-h-[48px]">
        {/* Bottom-Left: Red Avatar Badge + 2-Dice Tray right beside it when Red is active (or Ready) */}
        <div className="flex items-center gap-2 min-w-0">
          <PlayerAvatarBadge
            color="red"
            name={colorNames.red}
            homeCount={homeCount('red')}
            isActiveTurn={gameState.turn === 'red' && gameState.phase !== 'READY'}
            turnRemainingFrac={turnFrac}
            align="left"
            videoRef={localColor === 'red' ? localVideoRef : remoteVideoRef}
            showLiveVideo={localColor === 'red' ? showLocalLiveVideo : showRemoteLiveVideo}
            mirrorVideo={localColor === 'red'}
            showMicMuted={localColor === 'red' && micMuted}
            faceMetricsRef={localColor === 'red' ? localFaceMetricsRef : partnerFaceMetricsRef}
          />
          {(gameState.turn === 'red' || gameState.phase === 'READY') && (
            <ParchisiDice3D
              dice={gameState.phase === 'READY' ? [5, 6] : displayedDice}
              usedDice={gameState.usedDice}
              pendingBonus={activeBonus}
              rolling={isRollingAnim}
              shakeIntensity={localColor === 'red' ? shakeIntensity : 0}
              canRoll={localColor === 'red' && canRollNow}
              isActiveTray={gameState.turn === 'red' && gameState.phase !== 'READY'}
              compact={gameState.mode === '4p'}
              accentColor={COLOR_PALETTE.red.fill}
              onRoll={handleRollDice}
              ariaLabel="Roll both dice for Red"
            />
          )}
        </div>

        {/* Bottom-Right: Green AI (4P) or clean inline turn status (4P/1v1) */}
        <div className="flex items-center gap-2 shrink-0">
          {gameState.mode === '4p' ? (
            <>
              {isBottomTurn && gameState.turn === 'green' && gameState.phase !== 'READY' && (
                <ParchisiDice3D
                  dice={displayedDice}
                  usedDice={gameState.usedDice}
                  pendingBonus={activeBonus}
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
            <div className="text-right text-[11px] sm:text-xs font-semibold text-[#E8C4A0]/85 tabular-nums">
              {gameState.phase === 'WAIT_ROLL' || gameState.phase === 'WAIT_MOVE' ? (
                <span>
                  {Math.ceil(turnSecondsLeft)}s · {COLOR_PALETTE[gameState.turn].label}
                </span>
              ) : (
                <span>1v1 Classic</span>
              )}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* 4. BOTTOM QUICK BAR (EMOJI · CHAT · Base Cameras Toggle · Hand · Mute · Hot Camera Enable) */}
      <div className="relative z-30 w-full max-w-[660px] flex items-center justify-center gap-1 sm:gap-2 pt-1 shrink-0 touch-manipulation select-none">
        {/* Inline Popover Drawer for EMOJI or CHAT */}
        {openDrawer !== 'none' && (
          <div
            data-testid={`parchisi-${openDrawer}-drawer`}
            className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-1.5 max-w-[94vw] px-2.5 py-2 rounded-2xl bg-[#241222]/96 border border-[#C58B58]/80 shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
          >
            {openDrawer === 'emoji'
              ? QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleSendEmoji(em)}
                    aria-label={`Send ${em} reaction`}
                    className="w-11 h-11 rounded-full bg-white/8 hover:bg-white/18 active:scale-90 text-xl flex items-center justify-center transition-transform"
                  >
                    {em}
                  </button>
                ))
              : QUICK_CHATS.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => handleSendQuickChat(phrase)}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-[#C58B58]/35 text-xs font-bold text-[#FFF7ED] whitespace-nowrap transition-colors"
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
          className={`min-h-[40px] inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold tracking-wide border transition-colors whitespace-nowrap ${
            openDrawer === 'emoji'
              ? 'bg-[#C58B58] text-[#1E101D] border-[#FEF08A]'
              : 'bg-[#361D33]/90 text-[#FFF7ED] border-[#C58B58]/50 hover:bg-[#472743]'
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
          className={`min-h-[40px] inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold tracking-wide border transition-colors whitespace-nowrap ${
            openDrawer === 'chat'
              ? 'bg-[#C58B58] text-[#1E101D] border-[#FEF08A]'
              : 'bg-[#361D33]/90 text-[#FFF7ED] border-[#C58B58]/50 hover:bg-[#472743]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span>CHAT</span>
        </button>

        {/* Base Cameras Mode Toggle (persisted in localStorage 'parchisi_base_cams') */}
        <button
          type="button"
          data-testid="parchisi-base-cams-toggle"
          aria-pressed={baseCamsEnabled}
          onClick={handleToggleBaseCams}
          title={baseCamsEnabled ? 'Caméras dans les bases activées' : 'Tapis Classique opaque'}
          className={`min-h-[40px] inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold border transition-colors whitespace-nowrap ${
            baseCamsEnabled
              ? 'bg-[#C58B58]/30 text-[#FEF3C7] border-[#FACC15]/75 hover:bg-[#C58B58]/42'
              : 'bg-[#361D33]/90 text-[#E8C4A0] border-[#C58B58]/50 hover:bg-[#472743]'
          }`}
        >
          {baseCamsEnabled ? (
            <>
              <span className="sm:hidden">🎥 Cam : ON</span>
              <span className="hidden sm:inline">🎥 Caméras : ON</span>
            </>
          ) : (
            <>
              <span className="sm:hidden">🎨 Classique</span>
              <span className="hidden sm:inline">🎨 Tapis Classique</span>
            </>
          )}
        </button>

        <button
          type="button"
          data-testid="parchisi-hand-toggle"
          aria-pressed={handDiceEnabled}
          onClick={() => {
            soundFx.click();
            onToggleHandDice(!handDiceEnabled);
          }}
          title="Hand-Shake Dice Roll (MediaPipe)"
          aria-label="Hand-Shake Dice Roll"
          className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
            handDiceEnabled
              ? 'bg-[#2E9E5B]/30 text-[#D1FAE5] border-[#4ADE80]/70'
              : 'bg-[#361D33]/90 text-[#E8C4A0] border-[#C58B58]/40 hover:bg-[#472743]'
          }`}
        >
          <Hand className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">
            {handDiceEnabled
              ? handTrackerStatus === 'loading'
                ? 'Hand…'
                : 'Hand On'
              : 'Hand'}
          </span>
        </button>

        <button
          type="button"
          data-testid="parchisi-mute-toggle"
          aria-label={sfxMutedLocal ? 'Unmute sound' : 'Mute sound'}
          aria-pressed={sfxMutedLocal}
          onClick={handleToggleSoundMute}
          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full bg-[#361D33]/90 text-[#E8C4A0] border border-[#C58B58]/40 hover:bg-[#472743] transition-colors shrink-0"
        >
          {sfxMutedLocal ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {!showLocalLiveVideo && (
          <button
            type="button"
            data-testid="parchisi-enable-cam-btn"
            onClick={onRequestCamera}
            title="Activer la caméra en direct"
            aria-label="Activer la caméra"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full bg-[#361D33]/90 text-[#FEF08A] border border-[#FACC15]/55 hover:bg-[#472743] transition-colors shrink-0"
          >
            <Camera className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Celebratory Confetti Burst on Center Home Entry & Victory */}
      {confettiSeed > 0 && (
        <div
          key={`confetti-${confettiSeed}`}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        >
          {Array.from({ length: 24 }, (_, idx) => {
            const left = (idx * 4.3 + (confettiSeed * 13) % 9) % 100;
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
