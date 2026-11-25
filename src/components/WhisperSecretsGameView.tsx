import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftRight,
  Check,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Maximize2,
  Minimize2,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  PeerMessage,
  TrackerStatus,
  WhisperLevel,
  WhisperRole,
  WhisperStage,
} from '../types/duoplay';
import {
  KISS_HOLD_REQUIRED_SEC,
  WHISPER_DURATION_SEC,
  WHISPER_MAX_LENGTH,
  computeComplicityHeat,
  formatWordHint,
  isGuessMatch,
  pickWhisperDare,
  pickWhisperIdea,
  smoothLipPosition,
  swapWhisperRole,
  updateKissHoldDuration,
  type LipPoint,
  type WhisperHeatOutcome,
} from '../game/whisperSecretsLogic';
import { soundFx } from '../utils/soundFx';
import { useI18n } from '../i18n/LanguageContext';
import { AvatarCanvas } from './AvatarCanvas';

interface WhisperSecretsGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micMuted: boolean;
  sfxMuted: boolean;
  trackerStatus: TrackerStatus;
  localMetricsRef: MutableRefObject<FaceMetrics>;
  partnerMetricsRef: MutableRefObject<FaceMetrics>;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  onSendPeerRealtime: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onUpdateBestHeat: (heat: number) => void;
}

interface FloatingHeart {
  id: number;
  leftPct: number;
  delaySec: number;
  durationSec: number;
  sizePx: number;
  driftX: number;
}

type ValidationReason = 'none' | 'kiss' | 'button' | 'guess_match';

function buildHeartRain(count = 22): FloatingHeart[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: Date.now() + idx,
    leftPct: 6 + ((idx * 17 + Math.random() * 11) % 88),
    delaySec: (idx % 7) * 0.08,
    durationSec: 1.6 + (idx % 5) * 0.25,
    sizePx: 18 + (idx % 4) * 6,
    driftX: ((idx % 2 === 0 ? 1 : -1) * (14 + (idx % 5) * 8)),
  }));
}

export function WhisperSecretsGameView({
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  micMuted,
  sfxMuted,
  trackerStatus,
  localMetricsRef,
  partnerMetricsRef,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  onSendPeerRealtime,
  registerPeerHandler,
  onUpdateBestHeat,
}: WhisperSecretsGameViewProps) {
  const { t, lang: language } = useI18n();
  const isSolo = connectionMode === 'solo';
  const isHost = connectionMode !== 'p2p-guest';

  // Core 4-stage round state
  const [round, setRound] = useState(1);
  const [role, setRole] = useState<WhisperRole>(() => (isHost ? 'whisperer' : 'guesser'));
  const [stage, setStage] = useState<WhisperStage>('writing');
  const [level, setLevel] = useState<WhisperLevel>('seduction');

  // Stage 1: Whisperer private writing
  const [secretInput, setSecretInput] = useState('');
  const [showHintOption, setShowHintOption] = useState(true);

  // Stage 2: Whispering (secret stays strictly hidden from Guesser UI until Stage 3!)
  const [activeSecret, setActiveSecret] = useState('');
  const [activeShowHint, setActiveShowHint] = useState(true);
  const [activeLevel, setActiveLevel] = useState<WhisperLevel>('seduction');
  const [timeLeftSec, setTimeLeftSec] = useState(WHISPER_DURATION_SEC);
  const [whisperMicLocked, setWhisperMicLocked] = useState(false);
  const [zoomEnabled, setZoomEnabled] = useState(true);
  const [lipPos, setLipPos] = useState<LipPoint>({ x: 0.5, y: 0.62 });
  const [kissHoldRatio, setKissHoldRatio] = useState(0);
  const [quickGuess, setQuickGuess] = useState('');
  const [guessFeedbackShake, setGuessFeedbackShake] = useState(false);

  // Stage 3 & 4: Reveal, Verdict, Dare, Score & Complicity Heat
  const [validationReason, setValidationReason] = useState<ValidationReason>('none');
  const [verdictResolved, setVerdictResolved] = useState(false);
  const [verdictGuessed, setVerdictGuessed] = useState<boolean | null>(null);
  const [activeDare, setActiveDare] = useState<string | null>(null);
  const [coupleScore, setCoupleScore] = useState(0);
  const [complicityHeat, setComplicityHeat] = useState(16);
  const [heartRain, setHeartRain] = useState<FloatingHeart[]>([]);

  // Essential UX: Panic / Privacy Blur mode (Spacebar shortcut)
  const [panicMode, setPanicMode] = useState(false);

  // Refs for audio safety, video elements, rAF tracking, and stale-closure prevention
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const savedAudioStatesRef = useRef<Map<MediaStreamTrack, boolean>>(new Map());
  const micMutedPropRef = useRef(micMuted);
  micMutedPropRef.current = micMuted;
  const sfxMutedPropRef = useRef(sfxMuted);
  sfxMutedPropRef.current = sfxMuted;
  const panicModeRef = useRef(panicMode);
  panicModeRef.current = panicMode;

  const lipPosRef = useRef<LipPoint>({ x: 0.5, y: 0.62 });
  const lastLipSendMsRef = useRef(0);
  const kissHoldSecRef = useRef(0);
  const stageRef = useRef<WhisperStage>(stage);
  stageRef.current = stage;
  const roleRef = useRef<WhisperRole>(role);
  roleRef.current = role;
  const activeSecretRef = useRef(activeSecret);
  activeSecretRef.current = activeSecret;
  const activeLevelRef = useRef(activeLevel);
  activeLevelRef.current = activeLevel;
  const lastHeartbeatSecondRef = useRef<number>(-1);
  const roundEndTriggeredRef = useRef(false);

  // =========================================================================
  // STRICT AUDIO TRACK SAFETY (NEVER leave local mic stuck muted!)
  // =========================================================================
  const muteLocalMicForWhisper = useCallback(() => {
    setWhisperMicLocked(true);
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    for (const track of audioTracks) {
      if (!savedAudioStatesRef.current.has(track)) {
        savedAudioStatesRef.current.set(track, track.enabled);
      }
      track.enabled = false;
    }
  }, [localStream]);

  const restoreLocalMicAfterWhisper = useCallback(() => {
    setWhisperMicLocked(false);
    if (savedAudioStatesRef.current.size > 0) {
      savedAudioStatesRef.current.forEach((initialEnabled, track) => {
        if (track.readyState === 'live') {
          // Restore initial state unless user explicitly muted from the toolbar
          track.enabled = micMutedPropRef.current ? false : initialEnabled;
        }
      });
      savedAudioStatesRef.current.clear();
    } else if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        if (track.readyState === 'live') {
          track.enabled = !micMutedPropRef.current;
        }
      });
    }
  }, [localStream]);

  // Guaranteed cleanup on unmount or when leaving game / changing stream
  useEffect(() => {
    return () => {
      if (savedAudioStatesRef.current.size > 0) {
        savedAudioStatesRef.current.forEach((initialEnabled, track) => {
          if (track.readyState === 'live') {
            track.enabled = micMutedPropRef.current ? false : initialEnabled;
          }
        });
        savedAudioStatesRef.current.clear();
      }
      // Always restore global SFX mute state if panic mode was active on exit
      if (panicModeRef.current) {
        soundFx.muted = sfxMutedPropRef.current;
      }
    };
  }, [localStream]);

  // Keep soundFx.muted synchronized with Panic mode + toolbar mute toggle
  useEffect(() => {
    soundFx.muted = panicMode || sfxMuted;
  }, [panicMode, sfxMuted]);

  // Report best heat to Hub stats
  useEffect(() => {
    onUpdateBestHeat(complicityHeat);
  }, [complicityHeat, onUpdateBestHeat]);

  // =========================================================================
  // PANIC / PRIVACY BLUR SHORTCUT (Spacebar when not typing in an input)
  // =========================================================================
  const togglePanicMode = useCallback(() => {
    setPanicMode((prev) => !prev);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || active?.isContentEditable) {
        return;
      }
      e.preventDefault();
      setPanicMode((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // =========================================================================
  // ROUND TRANSITIONS & VALIDATION HELPERS
  // =========================================================================
  const triggerHeartRain = useCallback(() => {
    const hearts = buildHeartRain(22);
    setHeartRain(hearts);
    window.setTimeout(() => {
      setHeartRain([]);
    }, 3200);
  }, []);

  const applyScoreAndHeat = useCallback((points: number, heatOutcome: WhisperHeatOutcome) => {
    if (points > 0) {
      setCoupleScore((prev) => prev + points);
    }
    setComplicityHeat((prev) => computeComplicityHeat(prev, heatOutcome));
  }, []);

  const revealRoundNow = useCallback(
    (reason: ValidationReason, bonusPts = 0, revealedTextOverride?: string) => {
      if (roundEndTriggeredRef.current) return;
      roundEndTriggeredRef.current = true;

      // Immediately restore Whisperer's microphone so the couple can laugh & talk!
      restoreLocalMicAfterWhisper();
      if (revealedTextOverride) {
        setActiveSecret(revealedTextOverride);
      }

      setStage('revealed');
      setValidationReason(reason);
      setKissHoldRatio(0);
      kissHoldSecRef.current = 0;

      if (reason !== 'none') {
        setVerdictResolved(true);
        setVerdictGuessed(true);
        setActiveDare(null);
        applyScoreAndHeat(bonusPts, 'early_bonus');
        triggerHeartRain();
        soundFx.kissBonusBloom();
      } else {
        setVerdictResolved(false);
        setVerdictGuessed(null);
        setActiveDare(null);
        soundFx.whisperReveal();
      }
    },
    [applyScoreAndHeat, restoreLocalMicAfterWhisper, triggerHeartRain],
  );

  // Stage 1 -> Stage 2: Whisperer starts the 15s silent whisper
  const handleLaunchWhisper = useCallback(
    (e?: FormEvent) => {
      if (e) e.preventDefault();
      const cleaned = secretInput.trim().slice(0, WHISPER_MAX_LENGTH);
      if (!cleaned) return;

      roundEndTriggeredRef.current = false;
      lastHeartbeatSecondRef.current = -1;
      kissHoldSecRef.current = 0;
      setKissHoldRatio(0);
      setActiveSecret(cleaned);
      setActiveShowHint(showHintOption);
      setActiveLevel(level);
      setTimeLeftSec(WHISPER_DURATION_SEC);
      setQuickGuess('');
      setValidationReason('none');
      setVerdictResolved(false);
      setVerdictGuessed(null);
      setActiveDare(null);
      setStage('whispering');
      setZoomEnabled(true);

      muteLocalMicForWhisper();
      soundFx.countdownGo();

      onSendPeerMessage({
        type: 'WHISPER_START',
        secretText: cleaned,
        showHint: showHintOption,
        duration: WHISPER_DURATION_SEC,
        level,
        round,
      });
    },
    [level, muteLocalMicForWhisper, onSendPeerMessage, round, secretInput, showHintOption],
  );

  // Early validation by Whisperer (button click OR 350ms camera kiss)
  const handleWhispererEarlyValidate = useCallback(
    (by: 'kiss' | 'button') => {
      if (stageRef.current !== 'whispering' || roleRef.current !== 'whisperer') return;
      if (roundEndTriggeredRef.current) return;
      const secret = activeSecretRef.current;
      onSendPeerMessage({
        type: 'WHISPER_VALIDATED',
        by,
        bonusPts: 2,
        secretText: secret,
      });
      revealRoundNow(by, 2, secret);
    },
    [onSendPeerMessage, revealRoundNow],
  );

  // Guesser quick text guess check (forgiving match -> instant +2 pts validation)
  const handleQuickGuessSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (stageRef.current !== 'whispering' || roleRef.current !== 'guesser') return;
      const attempt = quickGuess.trim();
      if (!attempt) return;

      if (isGuessMatch(activeSecretRef.current, attempt)) {
        const secret = activeSecretRef.current;
        onSendPeerMessage({
          type: 'WHISPER_VALIDATED',
          by: 'guess_match',
          bonusPts: 2,
          secretText: secret,
        });
        revealRoundNow('guess_match', 2, secret);
      } else {
        setGuessFeedbackShake(true);
        window.setTimeout(() => setGuessFeedbackShake(false), 360);
      }
    },
    [onSendPeerMessage, quickGuess, revealRoundNow],
  );

  // Stage 4: Manual verdict after 0s reveal
  const handleVerdict = useCallback(
    (guessed: boolean) => {
      if (verdictResolved) return;
      const dareText = guessed
        ? undefined
        : pickWhisperDare(language, activeLevelRef.current, activeDare ?? undefined);
      const pts = guessed ? 1 : 0;
      const heatOutcome: WhisperHeatOutcome = guessed ? 'guessed' : 'dare';

      setVerdictResolved(true);
      setVerdictGuessed(guessed);
      setActiveDare(dareText ?? null);
      applyScoreAndHeat(pts, heatOutcome);

      if (guessed) {
        soundFx.roundWin();
        triggerHeartRain();
      } else {
        soundFx.click();
      }

      onSendPeerMessage({
        type: 'WHISPER_VERDICT',
        guessed,
        dareText,
        pointsAwarded: pts,
        heatOutcome,
      });
    },
    [activeDare, applyScoreAndHeat, language, onSendPeerMessage, triggerHeartRain, verdictResolved],
  );

  // Next round: swap Whisperer <-> Guesser automatically
  const handleNextRound = useCallback(() => {
    restoreLocalMicAfterWhisper();
    roundEndTriggeredRef.current = false;
    const nextRoundNum = round + 1;
    const nextRole = swapWhisperRole(role);
    const nextWhispererIsHost = isHost ? nextRole === 'whisperer' : nextRole === 'guesser';

    setRound(nextRoundNum);
    setRole(nextRole);
    setStage('writing');
    setSecretInput('');
    setActiveSecret('');
    setQuickGuess('');
    setTimeLeftSec(WHISPER_DURATION_SEC);
    setValidationReason('none');
    setVerdictResolved(false);
    setVerdictGuessed(null);
    setActiveDare(null);
    setKissHoldRatio(0);
    kissHoldSecRef.current = 0;
    soundFx.click();

    onSendPeerMessage({
      type: 'WHISPER_NEXT_ROUND',
      nextRound: nextRoundNum,
      nextWhispererIsHost,
    });
  }, [isHost, onSendPeerMessage, restoreLocalMicAfterWhisper, role, round]);

  // Solo helper: switch roles immediately in Stage 1 to test both Whisperer & Guesser effortlessly
  const handleSoloSwitchRole = useCallback(() => {
    if (!isSolo || stage !== 'writing') return;
    setRole((prev) => swapWhisperRole(prev));
    setSecretInput('');
    soundFx.click();
  }, [isSolo, stage]);

  // =========================================================================
  // SOLO AI PARTNER BEHAVIOR (When user tests as Guesser)
  // =========================================================================
  useEffect(() => {
    if (!isSolo || role !== 'guesser' || stage !== 'writing') return;
    const timer = window.setTimeout(() => {
      const aiSecret = pickWhisperIdea(language, level);
      roundEndTriggeredRef.current = false;
      lastHeartbeatSecondRef.current = -1;
      setActiveSecret(aiSecret);
      setActiveShowHint(true);
      setActiveLevel(level);
      setTimeLeftSec(WHISPER_DURATION_SEC);
      setQuickGuess('');
      setValidationReason('none');
      setVerdictResolved(false);
      setVerdictGuessed(null);
      setActiveDare(null);
      setZoomEnabled(true);
      setStage('whispering');
      soundFx.countdownGo();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [isSolo, language, level, role, stage]);

  // =========================================================================
  // PEERJS MESSAGE HANDLER
  // =========================================================================
  useEffect(() => {
    registerPeerHandler((msg: PeerMessage) => {
      if (msg.type === 'WHISPER_START') {
        roundEndTriggeredRef.current = false;
        lastHeartbeatSecondRef.current = -1;
        setRound(msg.round);
        setRole('guesser');
        setActiveSecret(msg.secretText);
        setActiveShowHint(msg.showHint);
        setActiveLevel(msg.level);
        setTimeLeftSec(msg.duration || WHISPER_DURATION_SEC);
        setQuickGuess('');
        setValidationReason('none');
        setVerdictResolved(false);
        setVerdictGuessed(null);
        setActiveDare(null);
        setZoomEnabled(true);
        setStage('whispering');
        soundFx.countdownGo();
      } else if (msg.type === 'WHISPER_LIP_POS') {
        const next = smoothLipPosition(lipPosRef.current, { x: msg.x, y: msg.y }, 0.35);
        lipPosRef.current = next;
        setLipPos(next);
      } else if (msg.type === 'WHISPER_VALIDATED') {
        revealRoundNow(msg.by, msg.bonusPts, msg.secretText);
      } else if (msg.type === 'WHISPER_VERDICT') {
        setVerdictResolved(true);
        setVerdictGuessed(msg.guessed);
        setActiveDare(msg.dareText ?? null);
        applyScoreAndHeat(msg.pointsAwarded, msg.heatOutcome);
        if (msg.guessed) {
          soundFx.roundWin();
          triggerHeartRain();
        } else {
          soundFx.click();
        }
      } else if (msg.type === 'WHISPER_NEXT_ROUND') {
        restoreLocalMicAfterWhisper();
        roundEndTriggeredRef.current = false;
        setRound(msg.nextRound);
        setRole(isHost ? (msg.nextWhispererIsHost ? 'whisperer' : 'guesser') : (msg.nextWhispererIsHost ? 'guesser' : 'whisperer'));
        setStage('writing');
        setSecretInput('');
        setActiveSecret('');
        setQuickGuess('');
        setTimeLeftSec(WHISPER_DURATION_SEC);
        setValidationReason('none');
        setVerdictResolved(false);
        setVerdictGuessed(null);
        setActiveDare(null);
        setKissHoldRatio(0);
        kissHoldSecRef.current = 0;
        soundFx.click();
      }
    });

    return () => registerPeerHandler(null);
  }, [
    applyScoreAndHeat,
    isHost,
    registerPeerHandler,
    restoreLocalMicAfterWhisper,
    revealRoundNow,
    triggerHeartRain,
  ]);

  // =========================================================================
  // STAGE 2 LOOP: 15s COUNTDOWN + HEARTBEAT (last 5s) + LIP ZOOM + 350ms KISS
  // =========================================================================
  useEffect(() => {
    if (stage !== 'whispering') return;

    let rafId = 0;
    let lastMs = performance.now();
    const startMs = lastMs;
    const durationMs = WHISPER_DURATION_SEC * 1000;

    const tick = (now: number) => {
      if (stageRef.current !== 'whispering') return;
      rafId = requestAnimationFrame(tick);

      const dtSec = Math.min(0.1, Math.max(0.001, (now - lastMs) * 0.001));
      lastMs = now;

      const elapsedMs = now - startMs;
      const remainingSec = Math.max(0, (durationMs - elapsedMs) / 1000);
      setTimeLeftSec(remainingSec);

      // Synthesized Web Audio heartbeat during final 5 seconds
      const ceilSec = Math.ceil(remainingSec);
      if (ceilSec <= 5 && ceilSec >= 1 && ceilSec !== lastHeartbeatSecondRef.current) {
        lastHeartbeatSecondRef.current = ceilSec;
        soundFx.heartbeatPulse((6 - ceilSec) / 5);
      }

      // Automatic reveal at 0s
      if (remainingSec <= 0) {
        revealRoundNow('none', 0);
        return;
      }

      // Whisperer-side MediaPipe FaceLandmarker tracking:
      // 1) Smoothed lip center (landmarks 13 & 14) sent at 15-20 fps via PeerJS
      // 2) Continuous kiss validation (mouthPucker > 0.65 held >= 350ms)
      if (roleRef.current === 'whisperer') {
        const m = localMetricsRef.current;
        if (m.faceDetected) {
          // Local mirrored display coordinate (matches mirror-video visual alignment)
          const smoothedLocal = smoothLipPosition(
            lipPosRef.current,
            { x: m.mouthX, y: m.mouthY },
            0.26,
          );
          lipPosRef.current = smoothedLocal;

          // Update React state & send PeerJS WHISPER_LIP_POS at ~18 fps (every 55ms)
          if (now - lastLipSendMsRef.current >= 55) {
            lastLipSendMsRef.current = now;
            setLipPos(smoothedLocal);
            // Remote <video> is unmirrored, so flip X for partner's screen!
            onSendPeerRealtime({
              type: 'WHISPER_LIP_POS',
              x: 1 - smoothedLocal.x,
              y: smoothedLocal.y,
              ts: now,
            });
          }

          // Kiss validation check (mouthPucker > 0.65 sustained for 350ms)
          const kissRes = updateKissHoldDuration(kissHoldSecRef.current, m.mouthPucker, dtSec);
          kissHoldSecRef.current = kissRes.holdSec;
          setKissHoldRatio(Math.min(1, kissRes.holdSec / KISS_HOLD_REQUIRED_SEC));
          if (kissRes.triggered) {
            handleWhispererEarlyValidate('kiss');
            return;
          }
        } else if (kissHoldSecRef.current > 0) {
          kissHoldSecRef.current = 0;
          setKissHoldRatio(0);
        }
      } else if (isSolo) {
        // Gentle subtle lip-focus motion for Camille IA in Solo Guesser mode
        const swayX = 0.5 + Math.sin(now * 0.0013) * 0.025;
        const swayY = 0.63 + Math.cos(now * 0.0017) * 0.015;
        if (now - lastLipSendMsRef.current >= 65) {
          lastLipSendMsRef.current = now;
          const next = { x: swayX, y: swayY };
          lipPosRef.current = next;
          setLipPos(next);
        }
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    handleWhispererEarlyValidate,
    isSolo,
    localMetricsRef,
    onSendPeerRealtime,
    revealRoundNow,
    stage,
  ]);

  // =========================================================================
  // VIDEO STREAM BINDING FOR MAIN STAGE & SECONDARY PiP
  // =========================================================================
  // Who is featured on the main stage?
  // - During whispering as Guesser: Partner's lips (remoteStream / AI avatar)
  // - During whispering as Whisperer:
  //     * Solo mode: Self feed so user can preview live MediaPipe lip-zoom!
  //     * P2P mode: Partner's reaction feed as main, or self feed if zoomed
  // - Stage 1 & Stage 3/4: Partner's feed as main, local as PiP
  const mainShowsLocal = isSolo && role === 'whisperer' && stage === 'whispering';
  const mainStream = mainShowsLocal ? localStream : remoteStream;
  const mainIsLiveVideo = mainShowsLocal
    ? Boolean(localStream) && cameraEnabled
    : Boolean(remoteStream) && !isSolo;
  const mainIsAi = !mainShowsLocal && isSolo;
  const mainName = mainShowsLocal ? localName : partnerName;
  const mainMetrics = mainShowsLocal ? localMetricsRef : partnerMetricsRef;

  const pipShowsLocal = !mainShowsLocal;
  const pipStream = pipShowsLocal ? localStream : remoteStream;
  const pipIsLiveVideo = pipShowsLocal
    ? Boolean(localStream) && cameraEnabled
    : Boolean(remoteStream) && !isSolo;
  const pipIsAi = !pipShowsLocal && isSolo;
  const pipName = pipShowsLocal ? localName : partnerName;
  const pipMetrics = pipShowsLocal ? localMetricsRef : partnerMetricsRef;

  const shouldZoomMain =
    stage === 'whispering' &&
    zoomEnabled &&
    (role === 'guesser' || (isSolo && role === 'whisperer'));

  useEffect(() => {
    const v = mainVideoRef.current;
    if (!v) return;
    if (mainIsLiveVideo && mainStream) {
      if (v.srcObject !== mainStream) v.srcObject = mainStream;
      v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [mainIsLiveVideo, mainStream]);

  useEffect(() => {
    const v = pipVideoRef.current;
    if (!v) return;
    if (pipIsLiveVideo && pipStream) {
      if (v.srcObject !== pipStream) v.srcObject = pipStream;
      v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [pipIsLiveVideo, pipStream]);

  // Keep App.tsx's fallback localVideoElRef wired if available
  const handleMainVideoNode = useCallback(
    (el: HTMLVideoElement | null) => {
      mainVideoRef.current = el;
      if (mainShowsLocal) onVideoRef(el);
    },
    [mainShowsLocal, onVideoRef],
  );

  const handlePipVideoNode = useCallback(
    (el: HTMLVideoElement | null) => {
      pipVideoRef.current = el;
      if (pipShowsLocal) onVideoRef(el);
    },
    [onVideoRef, pipShowsLocal],
  );

  // Derived UI values
  const wordHintText = useMemo(
    () => (activeShowHint ? formatWordHint(activeSecret) : ''),
    [activeSecret, activeShowHint],
  );
  const previewWordHint = useMemo(
    () => (secretInput.trim() ? formatWordHint(secretInput) : '_ _ _   ·   _ _ _ _'),
    [secretInput],
  );

  const countdownProgress = Math.max(0, Math.min(1, timeLeftSec / WHISPER_DURATION_SEC));
  const isFinalFive = stage === 'whispering' && timeLeftSec <= 5;
  const ringPerimeter = 1000;
  const ringDashOffset = ringPerimeter * (1 - countdownProgress);

  const levelMeta: { id: WhisperLevel; label: string }[] = [
    { id: 'doux', label: t.whisperLevelDoux },
    { id: 'seduction', label: t.whisperLevelSeduction },
    { id: 'intense', label: t.whisperLevelIntense },
  ];

  const activeLevelLabel =
    activeLevel === 'doux'
      ? t.whisperLevelDoux
      : activeLevel === 'seduction'
        ? t.whisperLevelSeduction
        : t.whisperLevelIntense;

  return (
    <main
      data-game-root="whisper-secrets"
      data-stage={stage}
      data-role={role}
      data-panic={panicMode ? 'true' : 'false'}
      className="relative flex-1 w-full overflow-x-hidden pb-28 lg:pb-8"
      style={{
        background:
          'radial-gradient(1100px 620px at 18% 8%, rgba(190, 18, 60, 0.34), transparent 62%), radial-gradient(820px 560px at 85% 15%, rgba(245, 158, 11, 0.16), transparent 60%), linear-gradient(155deg, #2A0410 0%, #4C0519 42%, #1B0914 100%)',
      }}
    >
      {/* Subtle warm candlelight ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[540px] h-[260px] rounded-full blur-3xl opacity-35 animate-pulse"
          style={{
            background:
              'radial-gradient(circle, rgba(245, 158, 11, 0.55) 0%, rgba(190, 18, 60, 0.35) 55%, transparent 80%)',
            animationDuration: '4.8s',
          }}
        />
      </div>

      {/* Heart rain celebratory overlay (early kiss / guess validation) */}
      <AnimatePresence>
        {heartRain.length > 0 && !panicMode && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
          >
            {heartRain.map((h) => (
              <motion.div
                key={h.id}
                initial={{ y: -40, x: 0, opacity: 0, scale: 0.6 }}
                animate={{
                  y: '105vh',
                  x: h.driftX,
                  opacity: [0, 1, 1, 0],
                  scale: [0.7, 1.15, 0.95],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: h.durationSec,
                  delay: h.delaySec,
                  ease: 'easeIn',
                }}
                style={{ left: `${h.leftPct}%` }}
                className="absolute top-0 text-[#FB7185] drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]"
              >
                <Heart
                  style={{ width: h.sizePx, height: h.sizePx }}
                  className="fill-[#BE123C] text-[#F59E0B]"
                />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-6xl mx-auto px-2.5 sm:px-6 pt-2 sm:pt-5 space-y-2.5 sm:space-y-5">
        {/* Top Game Header: Compact single-row on mobile, full bar on desktop */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl bg-[#1C0711]/78 border border-[#F59E0B]/22 px-3 sm:px-4 py-2 sm:py-3 shadow-lg shadow-black/30">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h1 className="text-sm sm:text-2xl font-bold sm:font-semibold text-[#FFF7ED] tracking-tight truncate">
                {t.whisperTitle}
              </h1>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#F59E0B] tabular-nums whitespace-nowrap">
                {t.roundLabel} {round} ·{' '}
                {role === 'whisperer' ? t.whisperRoleWhisperer : t.whisperRoleGuesser}
              </span>
            </div>
            <p className="hidden sm:block text-xs sm:text-sm text-[#FDE6D8]/75 mt-0.5 truncate">
              {t.whisperSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Compact score + complicity heat indicator */}
            <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-black/30 border border-white/10">
              <div className="text-end">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#FDE6D8]/65">
                  {t.whisperScoreLabel}
                </p>
                <p
                  data-testid="whisper-score"
                  className="text-xs sm:text-base font-bold text-[#FFF7ED] tabular-nums leading-tight"
                >
                  {coupleScore} pts
                </p>
              </div>
              <div className="h-6 sm:h-7 w-px bg-white/10" aria-hidden="true" />
              <div className="min-w-[66px] sm:min-w-[104px]">
                <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-[#FCD34D]">
                  <span className="inline-flex items-center gap-0.5 sm:gap-1">
                    <Flame className="w-3 h-3 text-[#F59E0B]" />
                    <span className="hidden sm:inline">{t.whisperHeatLabel.split('/')[0].trim()}</span>
                  </span>
                  <span data-testid="whisper-heat" className="font-mono font-bold tabular-nums">
                    {complicityHeat}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-white/12 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${complicityHeat}%`,
                      background: 'linear-gradient(90deg, #BE123C 0%, #F59E0B 100%)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Desktop top-bar Panic / Blur button (mobile uses ergonomic bottom thumb dock) */}
            <button
              type="button"
              data-testid="whisper-panic-btn"
              onClick={togglePanicMode}
              aria-pressed={panicMode}
              title={t.whisperPanicHint}
              className={`hidden lg:inline-flex min-h-[44px] items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap ${
                panicMode
                  ? 'bg-[#F59E0B] text-[#1C0711] border-[#FCD34D] shadow-lg shadow-[#F59E0B]/30'
                  : 'bg-[#4C0519]/85 text-[#FFF7ED] border-[#FB7185]/35 hover:bg-[#BE123C]/50 hover:border-[#F59E0B]/50'
              }`}
            >
              {panicMode ? (
                <>
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>{t.whisperPanicRestoreBtn}</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 shrink-0" />
                  <span>{t.whisperPanicBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Panic mode active banner (desktop keyboard hint hidden on phones) */}
        {panicMode && (
          <div
            role="status"
            data-testid="whisper-panic-banner"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#1C0711]/95 border border-[#F59E0B]/45 px-4 py-2.5 text-xs sm:text-sm text-[#FDE6D8]"
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <span>{t.whisperPanicBanner}</span>
            </span>
            <span className="hidden sm:inline text-[#FCD34D] font-mono text-xs">{t.whisperPanicHint}</span>
          </div>
        )}

        {/* Main Adaptive Two-Column Theater (Mobile stacked, PC 12-col theater) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-5 items-start">
          {/* LEFT / CENTER STAGE: Main Video Feed with Luminous Countdown Ring & Lip Zoom */}
          <section className="lg:col-span-7 space-y-2.5 sm:space-y-3">
            <div className="relative rounded-2xl p-[3px] bg-gradient-to-br from-[#BE123C]/65 via-[#4C0519] to-[#F59E0B]/55 shadow-2xl shadow-black/50">
              {/* Progressive Luminous SVG Countdown Ring around video */}
              {stage === 'whispering' && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute -inset-[2px] z-20 w-[calc(100%+4px)] h-[calc(100%+4px)]"
                >
                  <defs>
                    <linearGradient id="whisper-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={isFinalFive ? '#F59E0B' : '#FB7185'} />
                      <stop offset="55%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#BE123C" />
                    </linearGradient>
                  </defs>
                  <rect
                    x="1"
                    y="1"
                    width="98"
                    height="98"
                    rx="4"
                    ry="4"
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="1.2"
                  />
                  <rect
                    x="1"
                    y="1"
                    width="98"
                    height="98"
                    rx="4"
                    ry="4"
                    fill="none"
                    stroke="url(#whisper-ring-grad)"
                    strokeWidth={isFinalFive ? '2.2' : '1.6'}
                    pathLength={ringPerimeter}
                    strokeDasharray={ringPerimeter}
                    strokeDashoffset={ringDashOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 80ms linear' }}
                  />
                </svg>
              )}

              <div
                className={`relative w-full rounded-[14px] overflow-hidden bg-[#14070E] ${
                  stage === 'writing'
                    ? 'h-[138px] sm:h-auto sm:aspect-[16/10]'
                    : 'h-[235px] sm:h-auto sm:aspect-[16/10]'
                }`}
              >
                {/* Smooth Zoom Container centered on Whisperer's lips */}
                <div
                  data-testid="whisper-zoom-stage"
                  data-zoom-active={shouldZoomMain ? 'true' : 'false'}
                  className={`w-full h-full transition-all duration-300 ease-out ${
                    panicMode ? 'blur-3xl scale-105' : ''
                  }`}
                  style={
                    panicMode
                      ? undefined
                      : {
                          transform: shouldZoomMain ? 'scale(2.1)' : 'scale(1)',
                          transformOrigin: `${(lipPos.x * 100).toFixed(1)}% ${(lipPos.y * 100).toFixed(1)}%`,
                        }
                  }
                >
                  {mainIsLiveVideo ? (
                    <video
                      ref={handleMainVideoNode}
                      autoPlay
                      playsInline
                      muted={mainShowsLocal}
                      className={`w-full h-full object-cover ${mainShowsLocal ? 'mirror-video' : ''}`}
                    />
                  ) : (
                    <AvatarCanvas
                      name={mainName}
                      metricsRef={mainMetrics}
                      accentColor="#F59E0B"
                      bgTop="#3C0A1E"
                      bgBottom="#16060F"
                      isAi={mainIsAi}
                    />
                  )}
                </div>

                {/* Soft romantic vignette */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#14050C]/90 via-transparent to-[#14050C]/40"
                />

                {/* Stage 1 Guesser Veil: "Ton partenaire écrit un murmure secret..." */}
                {stage === 'writing' && role === 'guesser' && !panicMode && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6 bg-[#2A0410]/65 backdrop-blur-[3px]">
                    <motion.div
                      animate={{ scale: [1, 1.07, 1], opacity: [0.82, 1, 0.82] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-12 h-12 rounded-full bg-[#BE123C]/40 border border-[#F59E0B]/45 flex items-center justify-center mb-3 shadow-lg shadow-[#F59E0B]/20"
                    >
                      <Sparkles className="w-6 h-6 text-[#FCD34D]" />
                    </motion.div>
                    <p
                      data-testid="whisper-partner-writing-msg"
                      className="text-lg sm:text-xl font-semibold text-[#FFF7ED]"
                    >
                      {isSolo ? t.whisperSoloAiPreparing : t.whisperPartnerWriting}
                    </p>
                    <p className="text-xs sm:text-sm text-[#FDE6D8]/80 mt-1.5 max-w-sm">
                      {t.whisperPartnerWritingSub}
                    </p>
                  </div>
                )}

                {/* Top Left Status: Mic status during Stage 2 OR player name */}
                <div className="absolute top-3 start-3 end-3 z-10 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {stage === 'whispering' && role === 'whisperer' && whisperMicLocked && (
                      <div
                        data-testid="whisper-muted-badge"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4C0519]/92 border border-[#F59E0B]/55 text-xs sm:text-sm font-semibold text-[#FFF7ED] shadow-md"
                      >
                        <span>
                          {localStream ? t.whisperMicMutedBadge : t.whisperMicVirtualBadge}
                        </span>
                      </div>
                    )}

                    {stage === 'whispering' && role === 'guesser' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C0711]/88 border border-[#5CC29F]/40 text-xs font-medium text-[#D1FAE5]">
                        <span className="truncate max-w-[230px] sm:max-w-none">
                          {t.whisperMicOpenPartner}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Top Right: Live 15s Countdown Numeral + Desktop Zoom Toggle (mobile puts Zoom in thumb dock) */}
                  <div className="flex items-center gap-2 ms-auto">
                    {stage === 'whispering' &&
                      (role === 'guesser' || (isSolo && role === 'whisperer')) && (
                        <button
                          type="button"
                          data-testid="whisper-zoom-toggle"
                          onClick={() => setZoomEnabled((z) => !z)}
                          className="hidden lg:inline-flex min-h-[40px] items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1C0711]/88 text-[#FFF7ED] border border-[#F59E0B]/40 hover:bg-[#4C0519] transition-colors whitespace-nowrap"
                        >
                          {zoomEnabled ? (
                            <>
                              <Minimize2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                              <span>{t.whisperZoomFullFace}</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                              <span>{t.whisperZoomLips}</span>
                            </>
                          )}
                        </button>
                      )}

                    {stage === 'whispering' && (
                      <div
                        data-testid="whisper-countdown"
                        className={`px-3 py-1.5 rounded-lg font-mono text-base sm:text-lg font-bold tabular-nums border shadow-md ${
                          isFinalFive
                            ? 'bg-[#BE123C] text-[#FFF7ED] border-[#FCD34D] animate-pulse'
                            : 'bg-[#1C0711]/90 text-[#FCD34D] border-[#F59E0B]/40'
                        }`}
                      >
                        {Math.ceil(timeLeftSec)}s
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Video Overlay: Nameplate + Secondary PiP Feed */}
                <div className="absolute inset-x-3 bottom-3 z-10 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#FFF7ED] truncate">
                      {mainName}
                      {mainShowsLocal && (
                        <span className="text-xs font-normal text-[#FDE6D8]/70 ms-1.5">
                          {t.youTag}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#FDE6D8]/75 truncate">
                      {stage === 'whispering' && isSolo && role === 'whisperer'
                        ? t.whisperSoloPreviewHint
                        : trackerStatus === 'ready'
                          ? t.camReady
                          : t.camFallback}
                    </p>
                  </div>

                  {/* Compact PiP Secondary Camera Tile */}
                  <div className="relative w-24 sm:w-32 aspect-[4/3] rounded-xl overflow-hidden border border-[#F59E0B]/35 bg-[#1A0812] shadow-lg shrink-0">
                    <div className={`w-full h-full ${panicMode ? 'blur-3xl scale-110' : ''}`}>
                      {pipIsLiveVideo ? (
                        <video
                          ref={handlePipVideoNode}
                          autoPlay
                          playsInline
                          muted={pipShowsLocal}
                          className={`w-full h-full object-cover ${pipShowsLocal ? 'mirror-video' : ''}`}
                        />
                      ) : (
                        <AvatarCanvas
                          name={pipName}
                          metricsRef={pipMetrics}
                          accentColor="#BE123C"
                          bgTop="#2E0818"
                          bgBottom="#13050C"
                          isAi={pipIsAi}
                        />
                      )}
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1">
                      <p className="text-[10px] font-medium text-[#FFF7ED] truncate">{pipName}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Enable Camera prompt — hidden on mobile to keep controls immediately visible without scroll */}
            {!localStream && (
              <div className="hidden sm:flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#1C0711]/70 border border-white/10 px-3.5 py-2.5 text-xs text-[#FDE6D8]/80">
                <span>{t.camFallback}</span>
                <button
                  type="button"
                  onClick={onRequestCamera}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-[#BE123C]/40 hover:bg-[#BE123C]/65 text-[#FFF7ED] font-semibold border border-[#F59E0B]/35 transition-colors whitespace-nowrap"
                >
                  {t.enableCamera}
                </button>
              </div>
            )}
          </section>

          {/* RIGHT PANEL: 4-Stage Interactive Parlor Controls */}
          <section className="lg:col-span-5">
            <div className="rounded-2xl bg-[#1C0711]/85 border border-[#F59E0B]/25 ring-1 ring-inset ring-white/5 p-3 sm:p-6 shadow-2xl shadow-black/45 backdrop-blur-md">
              {panicMode ? (
                /* Privacy Mode Veil over control panel so no secret phrase/dare is visible */
                <div className="py-10 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-[#4C0519] border border-[#F59E0B]/40 flex items-center justify-center">
                    <EyeOff className="w-7 h-7 text-[#F59E0B]" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-[#FFF7ED]">
                      {t.whisperPanicBtn}
                    </h2>
                    <p className="text-sm text-[#FDE6D8]/75">{t.whisperPanicBanner}</p>
                  </div>
                  <button
                    type="button"
                    onClick={togglePanicMode}
                    className="hidden lg:inline-flex min-h-[48px] items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[#F59E0B] text-[#1C0711] hover:bg-[#FBBF24] transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{t.whisperPanicRestoreBtn}</span>
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  {/* ======================================================= */}
                  {/* STAGE 1: PRIVATE SECRET WRITING                         */}
                  {/* ======================================================= */}
                  {stage === 'writing' && (
                    <motion.div
                      key="stage-writing"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2.5 sm:space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">
                          {role === 'whisperer'
                            ? `1 · ${t.whisperRoleWhisperer}`
                            : `1 · ${t.whisperRoleGuesser}`}
                        </span>
                        {isSolo && (
                          <button
                            type="button"
                            data-testid="whisper-solo-switch-role"
                            onClick={handleSoloSwitchRole}
                            className="min-h-[36px] sm:min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/16 text-[#FDE6D8] border border-white/15 transition-colors whitespace-nowrap"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F59E0B]" />
                            <span>{t.whisperSoloSwitchRole}</span>
                          </button>
                        )}
                      </div>

                      {role === 'whisperer' ? (
                        <form onSubmit={handleLaunchWhisper} className="space-y-2.5 sm:space-y-4">
                          {/* Temperature selector: Doux / Séduction / Intense */}
                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                            {levelMeta.map((item) => {
                              const selected = level === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  data-level={item.id}
                                  onClick={() => setLevel(item.id)}
                                  className={`min-h-[44px] sm:min-h-[50px] px-2 sm:px-2.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${
                                    selected
                                      ? 'bg-gradient-to-r from-[#BE123C] to-[#E11D48] text-[#FFF7ED] border-[#F59E0B]/75 shadow-md shadow-[#BE123C]/40'
                                      : 'bg-black/35 text-[#FDE6D8]/85 border-white/14 hover:bg-white/10 hover:text-[#FFF7ED]'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Private Secret Phrase Input + Idea button */}
                          <div className="space-y-1.5 sm:space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="whisper-secret-input"
                                className="text-xs sm:text-sm font-semibold text-[#FFF7ED] truncate"
                              >
                                {t.whisperInputLabel}
                              </label>
                              <span className="text-xs font-mono text-[#FCD34D] tabular-nums shrink-0">
                                {secretInput.length}/{WHISPER_MAX_LENGTH}
                              </span>
                            </div>

                            <div className="flex flex-row gap-2">
                              <input
                                id="whisper-secret-input"
                                data-testid="whisper-secret-input"
                                type="text"
                                maxLength={WHISPER_MAX_LENGTH}
                                value={secretInput}
                                onChange={(e) => setSecretInput(e.target.value)}
                                placeholder={t.whisperInputPlaceholder}
                                autoComplete="off"
                                className="flex-1 min-w-0 min-h-[48px] sm:min-h-[54px] px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-2xl bg-black/45 border border-[#F59E0B]/35 text-[#FFF7ED] placeholder-[#FDE6D8]/45 text-base focus:border-[#F59E0B] focus:outline-none transition-colors"
                              />
                              <button
                                type="button"
                                data-testid="whisper-idea-btn"
                                onClick={() => {
                                  const idea = pickWhisperIdea(language, level, secretInput);
                                  setSecretInput(idea);
                                  soundFx.click();
                                }}
                                className="min-h-[48px] sm:min-h-[54px] inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-sm sm:text-base font-bold bg-[#4C0519] hover:bg-[#7F1D1D]/70 text-[#FCD34D] border border-[#F59E0B]/45 transition-colors whitespace-nowrap shrink-0"
                              >
                                <span>{t.whisperIdeaBtn}</span>
                              </button>
                            </div>
                          </div>

                          {/* Toggleable Word Length Hint Option */}
                          <div className="rounded-xl sm:rounded-2xl bg-black/30 border border-white/10 px-3 py-2 sm:p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-3 min-h-[32px]">
                              <span className="text-xs sm:text-sm font-medium text-[#FDE6D8]">
                                {t.whisperHintToggle}
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={showHintOption}
                                data-testid="whisper-hint-toggle"
                                onClick={() => setShowHintOption((v) => !v)}
                                className={`relative inline-flex h-7 w-12 sm:h-8 sm:w-14 shrink-0 items-center rounded-full border transition-colors ${
                                  showHintOption
                                    ? 'bg-[#BE123C] border-[#F59E0B]/70'
                                    : 'bg-white/12 border-white/15'
                                }`}
                              >
                                <span
                                  className={`inline-block h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-[#FFF7ED] shadow transition-transform ${
                                    showHintOption ? 'translate-x-6 sm:translate-x-7 rtl:-translate-x-6 sm:rtl:-translate-x-7' : 'translate-x-1 rtl:-translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            {showHintOption && (
                              <p
                                dir="ltr"
                                className="font-mono text-xs text-[#FCD34D]/85 tracking-wider break-words"
                              >
                                {previewWordHint}
                              </p>
                            )}
                          </div>

                          {/* Primary Launch CTA — 56px thumb-friendly primary action */}
                          <button
                            type="submit"
                            data-testid="whisper-launch-btn"
                            disabled={!secretInput.trim()}
                            className="min-h-[56px] w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-base font-extrabold text-[#1C0711] disabled:opacity-45 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#F59E0B]/25"
                            style={{
                              background: 'linear-gradient(135deg, #F59E0B 0%, #FB7185 100%)',
                            }}
                          >
                            <Flame className="w-5 h-5 shrink-0" />
                            <span>{t.whisperLaunchBtn}</span>
                          </button>
                        </form>
                      ) : (
                        /* Guesser waiting panel in Stage 1 */
                        <div className="py-6 text-center space-y-3">
                          <p className="text-base font-semibold text-[#FFF7ED]">
                            {isSolo ? t.whisperSoloAiPreparing : t.whisperPartnerWriting}
                          </p>
                          <p className="text-xs sm:text-sm text-[#FDE6D8]/75">
                            {t.whisperPartnerWritingSub}
                          </p>
                          {/* Temperature selector still interactive in Solo mode before AI picks */}
                          {isSolo && (
                            <div className="pt-2 grid grid-cols-3 gap-2">
                              {levelMeta.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setLevel(item.id)}
                                  className={`min-h-[40px] px-2 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                                    level === item.id
                                      ? 'bg-[#BE123C] text-[#FFF7ED] border-[#F59E0B]/60'
                                      : 'bg-black/30 text-[#FDE6D8]/75 border-white/10'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ======================================================= */}
                  {/* STAGE 2: SILENT WHISPER (15 SECONDS)                    */}
                  {/* ======================================================= */}
                  {stage === 'whispering' && (
                    <motion.div
                      key="stage-whispering"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">
                          2 · {activeLevelLabel}
                        </span>
                        <span className="font-mono text-sm font-bold text-[#FCD34D] tabular-nums">
                          {Math.ceil(timeLeftSec)}s / {WHISPER_DURATION_SEC}s
                        </span>
                      </div>

                      {role === 'whisperer' ? (
                        /* Whisperer View during Stage 2 */
                        <div className="space-y-4">
                          {/* Private reminder of the phrase they are silently mouthing */}
                          <div className="rounded-xl bg-black/40 border border-[#F59E0B]/35 p-4 text-center space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wider text-[#FDE6D8]/65">
                              {t.whisperRoleWhisperer}
                            </p>
                            <p
                              data-testid="whisper-whisperer-phrase"
                              className="text-xl sm:text-2xl font-semibold text-[#FFF7ED] leading-snug"
                            >
                              {`«\u00A0${activeSecret}\u00A0»`}
                            </p>
                          </div>

                          {/* Early validation button ("Trouvé ! 💖") */}
                          <button
                            type="button"
                            data-testid="whisper-found-btn"
                            onClick={() => handleWhispererEarlyValidate('button')}
                            className="min-h-[56px] w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-base font-extrabold text-[#FFF7ED] bg-gradient-to-r from-[#BE123C] to-[#E11D48] hover:brightness-110 border border-[#F59E0B]/65 shadow-lg shadow-[#BE123C]/40 transition-all"
                          >
                            <span>{t.whisperFoundBtn}</span>
                          </button>

                          {/* Automatic Kiss Validation Indicator (mouthPucker > 0.65 for 350ms) */}
                          <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-2">
                            <p className="text-xs text-[#FDE6D8]/85 leading-relaxed">
                              💋 {t.whisperKissHint}
                            </p>
                            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-75"
                                style={{
                                  width: `${Math.round(kissHoldRatio * 100)}%`,
                                  background: 'linear-gradient(90deg, #FB7185 0%, #F59E0B 100%)',
                                }}
                              />
                            </div>
                            {kissHoldRatio > 0.08 && (
                              <p className="text-xs font-semibold text-[#FCD34D]">
                                {t.whisperKissProgress} {Math.round(kissHoldRatio * 100)}%
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Guesser View during Stage 2 — NEVER shows activeSecret! */
                        <div className="space-y-4">
                          {activeShowHint && wordHintText && (
                            <div className="rounded-2xl bg-black/40 border border-[#F59E0B]/30 p-4 text-center space-y-1.5">
                              <p className="text-[11px] uppercase tracking-wider text-[#FCD34D]/80">
                                {t.whisperWordHintLabel}
                              </p>
                              <p
                                data-testid="whisper-word-hint"
                                dir="ltr"
                                className="font-mono text-base sm:text-lg font-semibold text-[#FFF7ED] tracking-wider leading-relaxed break-words"
                              >
                                {wordHintText}
                              </p>
                            </div>
                          )}

                          {/* Optional Quick Guess Input — 54px touch target & 16px text */}
                          <form onSubmit={handleQuickGuessSubmit} className="space-y-2.5">
                            <div
                              className={`flex gap-2.5 transition-transform ${
                                guessFeedbackShake ? 'translate-x-1' : ''
                              }`}
                            >
                              <input
                                type="text"
                                data-testid="whisper-quick-guess-input"
                                value={quickGuess}
                                onChange={(e) => setQuickGuess(e.target.value)}
                                placeholder={t.whisperQuickGuessPlaceholder}
                                autoComplete="off"
                                className="flex-1 min-w-0 min-h-[54px] px-4 py-3.5 rounded-2xl bg-black/45 border border-[#F59E0B]/35 text-[#FFF7ED] placeholder-[#FDE6D8]/45 text-base focus:border-[#F59E0B] focus:outline-none"
                              />
                              <button
                                type="submit"
                                data-testid="whisper-quick-guess-submit"
                                className="min-h-[54px] inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl text-sm sm:text-base font-bold bg-[#F59E0B] text-[#1C0711] hover:bg-[#FBBF24] transition-colors whitespace-nowrap shrink-0"
                              >
                                <Send className="w-4 h-4" />
                                <span>{t.whisperQuickGuessBtn}</span>
                              </button>
                            </div>
                            <p className="hidden sm:block text-xs text-[#FDE6D8]/75">
                              {t.whisperMicOpenPartner}
                            </p>
                          </form>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ======================================================= */}
                  {/* STAGE 3 & 4: AUTO REVEAL, VERDICT, DARE & ROLE SWAP     */}
                  {/* ======================================================= */}
                  {stage === 'revealed' && (
                    <motion.div
                      key="stage-revealed"
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-4"
                    >
                      {/* Automatic Secret Reveal Card */}
                      <div className="rounded-2xl bg-gradient-to-br from-[#4C0519]/90 via-[#2E0715] to-[#1A0610] border border-[#F59E0B]/45 p-5 text-center space-y-2.5 shadow-inner">
                        <p className="text-xs font-semibold uppercase tracking-widest text-[#FCD34D]">
                          {t.whisperRevealHeading}
                        </p>
                        <motion.p
                          data-testid="whisper-revealed-text"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35 }}
                          className="text-2xl sm:text-3xl font-semibold text-[#FFF7ED] leading-tight"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {`«\u00A0${activeSecret}\u00A0»`}
                        </motion.p>

                        {validationReason !== 'none' && (
                          <p
                            data-testid="whisper-bonus-badge"
                            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#FCD34D] pt-1"
                          >
                            {validationReason === 'kiss'
                              ? t.whisperBonusKissBadge
                              : validationReason === 'guess_match'
                                ? t.whisperBonusMatchBadge
                                : t.whisperBonusEarlyBadge}
                          </p>
                        )}
                      </div>

                      {/* Stage 4 Verdict Buttons — 54px thumb-friendly buttons */}
                      {!verdictResolved ? (
                        role === 'whisperer' || isSolo ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              data-testid="whisper-verdict-guessed"
                              onClick={() => handleVerdict(true)}
                              className="min-h-[54px] inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm sm:text-base font-bold bg-[#10B981]/22 hover:bg-[#10B981]/32 text-[#D1FAE5] border border-[#5CC29F]/50 transition-colors"
                            >
                              <Check className="w-5 h-5 shrink-0" />
                              <span>{t.whisperVerdictGuessedBtn}</span>
                            </button>
                            <button
                              type="button"
                              data-testid="whisper-verdict-missed"
                              onClick={() => handleVerdict(false)}
                              className="min-h-[54px] inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm sm:text-base font-bold bg-[#BE123C]/40 hover:bg-[#BE123C]/60 text-[#FFF7ED] border border-[#FB7185]/50 transition-colors"
                            >
                              <Flame className="w-5 h-5 text-[#F59E0B] shrink-0" />
                              <span>{t.whisperVerdictMissedBtn}</span>
                            </button>
                          </div>
                        ) : (
                          <p className="text-center text-sm text-[#FDE6D8]/80 py-2">
                            {t.whisperWaitingVerdict}
                          </p>
                        )
                      ) : (
                        <div className="space-y-4">
                          {/* Dare ("Gage") Card if missed */}
                          {verdictGuessed === false && activeDare && (
                            <motion.div
                              data-testid="whisper-dare-card"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="rounded-2xl bg-[#4C0519]/85 border border-[#F59E0B]/55 p-4 space-y-1.5 shadow-lg shadow-[#BE123C]/25"
                            >
                              <p className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B] inline-flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5" />
                                <span>
                                  {t.whisperDareTitle} · {activeLevelLabel}
                                </span>
                              </p>
                              <p className="text-sm sm:text-base font-medium text-[#FFF7ED] leading-relaxed">
                                {activeDare}
                              </p>
                            </motion.div>
                          )}

                          {/* Complicity / Heat Progress Gauge */}
                          <div className="rounded-2xl bg-black/35 border border-white/10 p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-xs sm:text-sm">
                              <span className="font-medium text-[#FDE6D8] inline-flex items-center gap-1.5">
                                <Flame className="w-4 h-4 text-[#F59E0B]" />
                                {t.whisperHeatLabel}
                              </span>
                              <span className="font-mono font-bold text-[#FCD34D] tabular-nums">
                                {complicityHeat}%
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${complicityHeat}%`,
                                  background:
                                    'linear-gradient(90deg, #9F1239 0%, #BE123C 45%, #F59E0B 100%)',
                                }}
                              />
                            </div>
                          </div>

                          {/* Next Round (Swap Roles) CTA — 56px thumb-friendly CTA */}
                          <button
                            type="button"
                            data-testid="whisper-next-round-btn"
                            onClick={handleNextRound}
                            className="min-h-[56px] w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-base font-extrabold text-[#1C0711] shadow-lg shadow-[#F59E0B]/25 hover:brightness-105 transition-all"
                            style={{
                              background: 'linear-gradient(135deg, #F59E0B 0%, #FB7185 100%)',
                            }}
                          >
                            <ArrowLeftRight className="w-5 h-5 shrink-0" />
                            <span>{t.whisperNextRoundBtn}</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* MOBILE THUMB-ZONE CORNER PILLS: Effortless 1-thumb Panic/Blur & Lip Zoom without blocking vision */}
      <div
        data-testid="whisper-mobile-thumb-dock"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 pointer-events-none"
      >
        {stage === 'whispering' &&
        !panicMode &&
        (role === 'guesser' || (isSolo && role === 'whisperer')) ? (
          <button
            type="button"
            data-testid="whisper-mobile-zoom-btn"
            onClick={() => setZoomEnabled((z) => !z)}
            aria-pressed={zoomEnabled}
            className="pointer-events-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-[#16050D]/92 text-[#FFF7ED] border border-[#F59E0B]/45 shadow-xl shadow-black/65 active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            {zoomEnabled ? (
              <>
                <Minimize2 className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <span>{t.whisperZoomFullFace}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <span>{t.whisperZoomLips}</span>
              </>
            )}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}

        <button
          type="button"
          data-testid="whisper-mobile-panic-btn"
          onClick={togglePanicMode}
          aria-pressed={panicMode}
          className={`pointer-events-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-extrabold border shadow-2xl shadow-black/75 active:scale-95 transition-all whitespace-nowrap shrink-0 ${
            panicMode
              ? 'bg-[#F59E0B] text-[#1C0711] border-[#FCD34D] shadow-[#F59E0B]/35'
              : 'bg-[#4C0519]/95 text-[#FFF7ED] border-[#F59E0B]/55 active:bg-[#BE123C]'
          }`}
        >
          {panicMode ? (
            <>
              <Eye className="w-4 h-4 shrink-0" />
              <span>{t.whisperPanicRestoreBtn}</span>
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4 shrink-0 text-[#F59E0B]" />
              <span>{t.whisperPanicBtn}</span>
            </>
          )}
        </button>
      </div>
    </main>
  );
}
