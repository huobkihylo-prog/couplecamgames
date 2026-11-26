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
      className="relative flex-1 w-full overflow-x-hidden pb-28 lg:pb-8 bg-[#FAF7F2]"
      style={{
        background:
          'radial-gradient(960px 540px at 15% 6%, rgba(252, 234, 240, 0.92), transparent 62%), radial-gradient(840px 520px at 88% 12%, rgba(255, 232, 226, 0.72), transparent 60%), #FAF7F2',
      }}
    >
      {/* Subtle warm pastel glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[540px] h-[260px] rounded-full blur-3xl opacity-50 animate-pulse"
          style={{
            background:
              'radial-gradient(circle, rgba(255, 107, 87, 0.16) 0%, rgba(124, 92, 252, 0.12) 55%, transparent 80%)',
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
                className="absolute top-0 text-[#FF6B57] drop-shadow-[0_4px_12px_rgba(255,107,87,0.35)]"
              >
                <Heart
                  style={{ width: h.sizePx, height: h.sizePx }}
                  className="fill-[#FF6B57] text-[#E11D48]"
                />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-6xl mx-auto px-2.5 sm:px-6 pt-2 sm:pt-5 space-y-2.5 sm:space-y-5">
        {/* Top Game Header: Compact single-row on mobile, full bar on desktop */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl bg-white/95 backdrop-blur-md border border-[#EAE4DC] px-3 sm:px-4 py-2 sm:py-3 shadow-[0_6px_24px_rgba(31,36,45,0.06)]">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h1 className="text-sm sm:text-2xl font-extrabold sm:font-bold text-[#1F242D] tracking-tight truncate">
                {t.whisperTitle}
              </h1>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#FF6B57] tabular-nums whitespace-nowrap">
                {t.roundLabel} {round} ·{' '}
                {role === 'whisperer' ? t.whisperRoleWhisperer : t.whisperRoleGuesser}
              </span>
            </div>
            <p className="hidden sm:block text-xs sm:text-sm text-[#6B7280] mt-0.5 truncate">
              {t.whisperSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Compact score + complicity heat indicator */}
            <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC]">
              <div className="text-end">
                <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  {t.whisperScoreLabel}
                </p>
                <p
                  data-testid="whisper-score"
                  className="text-xs sm:text-base font-extrabold text-[#1F242D] tabular-nums leading-tight"
                >
                  {coupleScore} pts
                </p>
              </div>
              <div className="h-6 sm:h-7 w-px bg-[#EAE4DC]" aria-hidden="true" />
              <div className="min-w-[66px] sm:min-w-[104px]">
                <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#FF6B57]">
                  <span className="inline-flex items-center gap-0.5 sm:gap-1">
                    <Flame className="w-3 h-3 text-[#FF6B57]" />
                    <span className="hidden sm:inline">{t.whisperHeatLabel.split('/')[0].trim()}</span>
                  </span>
                  <span data-testid="whisper-heat" className="font-mono font-bold tabular-nums">
                    {complicityHeat}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-[#EAE4DC] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${complicityHeat}%`,
                      background: 'linear-gradient(90deg, #FF6B57 0%, #E11D48 100%)',
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
              className={`hidden lg:inline-flex min-h-[44px] items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap cursor-pointer ${
                panicMode
                  ? 'bg-[#FF6B57] text-white border-[#FF6B57] shadow-md shadow-[#FF6B57]/25'
                  : 'bg-[#FCEAF0] text-[#BE123C] border-[#F4C2D4] hover:bg-[#FADBE6]'
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
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#FEF6DC] border border-[#F5D782] px-4 py-2.5 text-xs sm:text-sm text-[#92400E] shadow-sm"
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 text-[#D97706] shrink-0" />
              <span>{t.whisperPanicBanner}</span>
            </span>
            <span className="hidden sm:inline text-[#B45309] font-mono text-xs font-semibold">{t.whisperPanicHint}</span>
          </div>
        )}

        {/* Main Adaptive Two-Column Theater (Mobile stacked, PC 12-col theater) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-5 items-start">
          {/* LEFT / CENTER STAGE: Main Video Feed with Luminous Countdown Ring & Lip Zoom */}
          <section className="lg:col-span-7 space-y-2.5 sm:space-y-3">
            <div className="relative rounded-3xl p-[3px] bg-gradient-to-br from-[#FF6B57]/55 via-[#FCEAF0] to-[#7C5CFC]/45 shadow-[0_14px_40px_rgba(31,36,45,0.10)]">
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
                      <stop offset="0%" stopColor={isFinalFive ? '#E11D48' : '#FF6B57'} />
                      <stop offset="55%" stopColor="#FF6B57" />
                      <stop offset="100%" stopColor="#7C5CFC" />
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
                    stroke="rgba(31,36,45,0.12)"
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
                className={`relative w-full rounded-[21px] overflow-hidden bg-[#241B29] ${
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
                      accentColor="#FF6B57"
                      bgTop="#3A283A"
                      bgBottom="#231A26"
                      isAi={mainIsAi}
                    />
                  )}
                </div>

                {/* Soft vignette for nameplate legibility */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1F242D]/80 via-transparent to-[#1F242D]/25"
                />

                {/* Stage 1 Guesser Veil: "Ton partenaire écrit un murmure secret..." */}
                {stage === 'writing' && role === 'guesser' && !panicMode && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6 bg-[#FAF7F2]/88 backdrop-blur-sm">
                    <motion.div
                      animate={{ scale: [1, 1.07, 1], opacity: [0.85, 1, 0.85] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-12 h-12 rounded-2xl bg-[#FCEAF0] border border-[#F4C2D4] flex items-center justify-center mb-3 shadow-sm"
                    >
                      <Sparkles className="w-6 h-6 text-[#FF6B57]" />
                    </motion.div>
                    <p
                      data-testid="whisper-partner-writing-msg"
                      className="text-lg sm:text-xl font-extrabold text-[#1F242D]"
                    >
                      {isSolo ? t.whisperSoloAiPreparing : t.whisperPartnerWriting}
                    </p>
                    <p className="text-xs sm:text-sm text-[#6B7280] mt-1.5 max-w-sm">
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#F5C5B8] text-xs sm:text-sm font-bold text-[#FF6B57] shadow-md"
                      >
                        <span>
                          {localStream ? t.whisperMicMutedBadge : t.whisperMicVirtualBadge}
                        </span>
                      </div>
                    )}

                    {stage === 'whispering' && role === 'guesser' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#B5E5CF] text-xs font-semibold text-[#059669] shadow-md">
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
                          className="hidden lg:inline-flex min-h-[40px] items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/95 backdrop-blur-md text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FAF7F2] shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {zoomEnabled ? (
                            <>
                              <Minimize2 className="w-3.5 h-3.5 text-[#FF6B57]" />
                              <span>{t.whisperZoomFullFace}</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 className="w-3.5 h-3.5 text-[#FF6B57]" />
                              <span>{t.whisperZoomLips}</span>
                            </>
                          )}
                        </button>
                      )}

                    {stage === 'whispering' && (
                      <div
                        data-testid="whisper-countdown"
                        className={`px-3 py-1.5 rounded-xl font-mono text-base sm:text-lg font-extrabold tabular-nums border shadow-md ${
                          isFinalFive
                            ? 'bg-[#E11D48] text-white border-[#FDA4AF] animate-pulse'
                            : 'bg-white/95 backdrop-blur-md text-[#FF6B57] border-[#EAE4DC]'
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
                    <p className="text-sm font-bold text-white drop-shadow-sm truncate">
                      {mainName}
                      {mainShowsLocal && (
                        <span className="text-xs font-normal text-white/80 ms-1.5">
                          {t.youTag}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/80 truncate">
                      {stage === 'whispering' && isSolo && role === 'whisperer'
                        ? t.whisperSoloPreviewHint
                        : trackerStatus === 'ready'
                          ? t.camReady
                          : t.camFallback}
                    </p>
                  </div>

                  {/* Compact PiP Secondary Camera Tile */}
                  <div className="relative w-24 sm:w-32 aspect-[4/3] rounded-2xl overflow-hidden border-2 border-white/85 bg-[#2A2233] shadow-lg shrink-0">
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
                          accentColor="#7C5CFC"
                          bgTop="#322845"
                          bgBottom="#1F1A2C"
                          isAi={pipIsAi}
                        />
                      )}
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                      <p className="text-[10px] font-semibold text-white truncate">{pipName}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Enable Camera prompt — hidden on mobile to keep controls immediately visible without scroll */}
            {!localStream && (
              <div className="hidden sm:flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white border border-[#EAE4DC] px-4 py-2.5 text-xs text-[#6B7280] shadow-sm">
                <span className="font-medium">{t.camFallback}</span>
                <button
                  type="button"
                  onClick={onRequestCamera}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#FFE8E2] hover:bg-[#FFDAD0] text-[#FF6B57] font-bold border border-[#F5C5B8] transition-colors whitespace-nowrap cursor-pointer"
                >
                  {t.enableCamera}
                </button>
              </div>
            )}
          </section>

          {/* RIGHT PANEL: 4-Stage Interactive Parlor Controls */}
          <section className="lg:col-span-5">
            <div className="rounded-3xl bg-white/95 border border-[#EAE4DC] p-3.5 sm:p-6 shadow-[0_10px_32px_rgba(31,36,45,0.07)] backdrop-blur-md">
              {panicMode ? (
                /* Privacy Mode Veil over control panel so no secret phrase/dare is visible */
                <div className="py-10 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FCEAF0] border border-[#F4C2D4] flex items-center justify-center">
                    <EyeOff className="w-7 h-7 text-[#BE123C]" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-[#1F242D]">
                      {t.whisperPanicBtn}
                    </h2>
                    <p className="text-sm text-[#6B7280]">{t.whisperPanicBanner}</p>
                  </div>
                  <button
                    type="button"
                    onClick={togglePanicMode}
                    className="hidden lg:inline-flex min-h-[48px] items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-[#FF6B57] text-white hover:bg-[#F25743] shadow-md shadow-[#FF6B57]/20 transition-colors cursor-pointer"
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
                        <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B57]">
                          {role === 'whisperer'
                            ? `1 · ${t.whisperRoleWhisperer}`
                            : `1 · ${t.whisperRoleGuesser}`}
                        </span>
                        {isSolo && (
                          <button
                            type="button"
                            data-testid="whisper-solo-switch-role"
                            onClick={handleSoloSwitchRole}
                            className="min-h-[36px] sm:min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#FAF7F2] hover:bg-[#F1ECE3] text-[#1F242D] border border-[#EAE4DC] transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF6B57]" />
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
                                  className={`min-h-[44px] sm:min-h-[50px] px-2 sm:px-2.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold border transition-all whitespace-nowrap cursor-pointer ${
                                    selected
                                      ? 'bg-[#FF6B57] text-white border-[#FF6B57] shadow-md shadow-[#FF6B57]/25'
                                      : 'bg-[#FAF7F2] text-[#6B7280] border-[#EAE4DC] hover:bg-[#FCEAF0] hover:text-[#1F242D]'
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
                                className="text-xs sm:text-sm font-bold text-[#1F242D] truncate"
                              >
                                {t.whisperInputLabel}
                              </label>
                              <span className="text-xs font-mono font-semibold text-[#6B7280] tabular-nums shrink-0">
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
                                className="flex-1 min-w-0 min-h-[48px] sm:min-h-[54px] px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] text-[#1F242D] placeholder-[#9CA3AF] text-base focus:bg-white focus:border-[#FF6B57] focus:outline-none transition-colors"
                              />
                              <button
                                type="button"
                                data-testid="whisper-idea-btn"
                                onClick={() => {
                                  const idea = pickWhisperIdea(language, level, secretInput);
                                  setSecretInput(idea);
                                  soundFx.click();
                                }}
                                className="min-h-[48px] sm:min-h-[54px] inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-sm sm:text-base font-bold bg-[#FCEAF0] hover:bg-[#FADCE7] text-[#BE123C] border border-[#F4C2D4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <span>{t.whisperIdeaBtn}</span>
                              </button>
                            </div>
                          </div>

                          {/* Toggleable Word Length Hint Option */}
                          <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] px-3 py-2 sm:p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-3 min-h-[32px]">
                              <span className="text-xs sm:text-sm font-semibold text-[#1F242D]">
                                {t.whisperHintToggle}
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={showHintOption}
                                data-testid="whisper-hint-toggle"
                                onClick={() => setShowHintOption((v) => !v)}
                                className={`relative inline-flex h-7 w-12 sm:h-8 sm:w-14 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                                  showHintOption
                                    ? 'bg-[#FF6B57] border-[#FF6B57]'
                                    : 'bg-[#E5DFD5] border-[#D6CEC2]'
                                }`}
                              >
                                <span
                                  className={`inline-block h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-white shadow transition-transform ${
                                    showHintOption ? 'translate-x-6 sm:translate-x-7 rtl:-translate-x-6 sm:rtl:-translate-x-7' : 'translate-x-1 rtl:-translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            {showHintOption && (
                              <p
                                dir="ltr"
                                className="font-mono text-xs font-semibold text-[#7C5CFC] tracking-wider break-words"
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
                            className="min-h-[56px] w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-base font-extrabold text-white bg-[#FF6B57] hover:bg-[#F25743] disabled:opacity-45 disabled:cursor-not-allowed transition-all shadow-md shadow-[#FF6B57]/25 cursor-pointer"
                          >
                            <Flame className="w-5 h-5 shrink-0" />
                            <span>{t.whisperLaunchBtn}</span>
                          </button>
                        </form>
                      ) : (
                        /* Guesser waiting panel in Stage 1 */
                        <div className="py-6 text-center space-y-3">
                          <p className="text-base font-extrabold text-[#1F242D]">
                            {isSolo ? t.whisperSoloAiPreparing : t.whisperPartnerWriting}
                          </p>
                          <p className="text-xs sm:text-sm text-[#6B7280]">
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
                                  className={`min-h-[40px] px-2 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                    level === item.id
                                      ? 'bg-[#FF6B57] text-white border-[#FF6B57]'
                                      : 'bg-[#FAF7F2] text-[#6B7280] border-[#EAE4DC]'
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
                        <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B57]">
                          2 · {activeLevelLabel}
                        </span>
                        <span className="font-mono text-sm font-extrabold text-[#1F242D] tabular-nums">
                          {Math.ceil(timeLeftSec)}s / {WHISPER_DURATION_SEC}s
                        </span>
                      </div>

                      {role === 'whisperer' ? (
                        /* Whisperer View during Stage 2 */
                        <div className="space-y-4">
                          {/* Private reminder of the phrase they are silently mouthing */}
                          <div className="rounded-2xl bg-[#FCEAF0] border border-[#F4C2D4] p-4 text-center space-y-1.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#BE123C]">
                              {t.whisperRoleWhisperer}
                            </p>
                            <p
                              data-testid="whisper-whisperer-phrase"
                              className="text-xl sm:text-2xl font-extrabold text-[#1F242D] leading-snug"
                            >
                              {`«\u00A0${activeSecret}\u00A0»`}
                            </p>
                          </div>

                          {/* Early validation button ("Trouvé ! 💖") */}
                          <button
                            type="button"
                            data-testid="whisper-found-btn"
                            onClick={() => handleWhispererEarlyValidate('button')}
                            className="min-h-[56px] w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-base font-extrabold text-white bg-[#FF6B57] hover:bg-[#F25743] shadow-md shadow-[#FF6B57]/25 transition-all cursor-pointer"
                          >
                            <span>{t.whisperFoundBtn}</span>
                          </button>

                          {/* Automatic Kiss Validation Indicator (mouthPucker > 0.65 for 350ms) */}
                          <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3.5 space-y-2">
                            <p className="text-xs font-medium text-[#6B7280] leading-relaxed">
                              💋 {t.whisperKissHint}
                            </p>
                            <div className="h-2 w-full rounded-full bg-[#EAE4DC] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-75"
                                style={{
                                  width: `${Math.round(kissHoldRatio * 100)}%`,
                                  background: 'linear-gradient(90deg, #FF6B57 0%, #E11D48 100%)',
                                }}
                              />
                            </div>
                            {kissHoldRatio > 0.08 && (
                              <p className="text-xs font-bold text-[#FF6B57]">
                                {t.whisperKissProgress} {Math.round(kissHoldRatio * 100)}%
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Guesser View during Stage 2 — NEVER shows activeSecret! */
                        <div className="space-y-4">
                          {activeShowHint && wordHintText && (
                            <div className="rounded-2xl bg-[#EFE9FB] border border-[#D9CCF8] p-4 text-center space-y-1.5">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#7C5CFC]">
                                {t.whisperWordHintLabel}
                              </p>
                              <p
                                data-testid="whisper-word-hint"
                                dir="ltr"
                                className="font-mono text-base sm:text-lg font-extrabold text-[#1F242D] tracking-wider leading-relaxed break-words"
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
                                className="flex-1 min-w-0 min-h-[54px] px-4 py-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] text-[#1F242D] placeholder-[#9CA3AF] text-base focus:bg-white focus:border-[#FF6B57] focus:outline-none"
                              />
                              <button
                                type="submit"
                                data-testid="whisper-quick-guess-submit"
                                className="min-h-[54px] inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl text-sm sm:text-base font-bold bg-[#FF6B57] text-white hover:bg-[#F25743] shadow-md shadow-[#FF6B57]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Send className="w-4 h-4" />
                                <span>{t.whisperQuickGuessBtn}</span>
                              </button>
                            </div>
                            <p className="hidden sm:block text-xs text-[#6B7280]">
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
                      <div className="rounded-2xl bg-gradient-to-br from-[#FCEAF0] via-[#FFF6F3] to-[#EFE9FB] border border-[#F4C2D4] p-5 text-center space-y-2.5 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#BE123C]">
                          {t.whisperRevealHeading}
                        </p>
                        <motion.p
                          data-testid="whisper-revealed-text"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35 }}
                          className="text-2xl sm:text-3xl font-extrabold text-[#1F242D] leading-tight"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {`«\u00A0${activeSecret}\u00A0»`}
                        </motion.p>

                        {validationReason !== 'none' && (
                          <p
                            data-testid="whisper-bonus-badge"
                            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#FF6B57] pt-1"
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
                              className="min-h-[54px] inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm sm:text-base font-bold bg-[#E6F6EF] hover:bg-[#D5F0E4] text-[#059669] border border-[#B5E5CF] transition-colors cursor-pointer"
                            >
                              <Check className="w-5 h-5 shrink-0" />
                              <span>{t.whisperVerdictGuessedBtn}</span>
                            </button>
                            <button
                              type="button"
                              data-testid="whisper-verdict-missed"
                              onClick={() => handleVerdict(false)}
                              className="min-h-[54px] inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm sm:text-base font-bold bg-[#FFE8E2] hover:bg-[#FFD9CF] text-[#C2410C] border border-[#F5C5B8] transition-colors cursor-pointer"
                            >
                              <Flame className="w-5 h-5 text-[#FF6B57] shrink-0" />
                              <span>{t.whisperVerdictMissedBtn}</span>
                            </button>
                          </div>
                        ) : (
                          <p className="text-center text-sm font-medium text-[#6B7280] py-2">
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
                              className="rounded-2xl bg-[#FFE8E2] border border-[#F5C5B8] p-4 space-y-1.5 shadow-sm"
                            >
                              <p className="text-xs font-bold uppercase tracking-wider text-[#FF6B57] inline-flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5" />
                                <span>
                                  {t.whisperDareTitle} · {activeLevelLabel}
                                </span>
                              </p>
                              <p className="text-sm sm:text-base font-semibold text-[#1F242D] leading-relaxed">
                                {activeDare}
                              </p>
                            </motion.div>
                          )}

                          {/* Complicity / Heat Progress Gauge */}
                          <div className="rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-xs sm:text-sm">
                              <span className="font-semibold text-[#1F242D] inline-flex items-center gap-1.5">
                                <Flame className="w-4 h-4 text-[#FF6B57]" />
                                {t.whisperHeatLabel}
                              </span>
                              <span className="font-mono font-extrabold text-[#FF6B57] tabular-nums">
                                {complicityHeat}%
                              </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-[#EAE4DC] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${complicityHeat}%`,
                                  background:
                                    'linear-gradient(90deg, #FF6B57 0%, #E11D48 60%, #7C5CFC 100%)',
                                }}
                              />
                            </div>
                          </div>

                          {/* Next Round (Swap Roles) CTA — 56px thumb-friendly CTA */}
                          <button
                            type="button"
                            data-testid="whisper-next-round-btn"
                            onClick={handleNextRound}
                            className="min-h-[56px] w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-base font-extrabold text-white bg-[#FF6B57] hover:bg-[#F25743] shadow-md shadow-[#FF6B57]/25 transition-all cursor-pointer"
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
            className="pointer-events-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-white/95 backdrop-blur-md text-[#1F242D] border border-[#EAE4DC] shadow-[0_6px_20px_rgba(31,36,45,0.14)] active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            {zoomEnabled ? (
              <>
                <Minimize2 className="w-4 h-4 text-[#FF6B57] shrink-0" />
                <span>{t.whisperZoomFullFace}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-[#FF6B57] shrink-0" />
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
          className={`pointer-events-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-extrabold border shadow-[0_6px_20px_rgba(31,36,45,0.16)] active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            panicMode
              ? 'bg-[#FF6B57] text-white border-[#FF6B57]'
              : 'bg-white/96 backdrop-blur-md text-[#BE123C] border-[#F4C2D4]'
          }`}
        >
          {panicMode ? (
            <>
              <Eye className="w-4 h-4 shrink-0" />
              <span>{t.whisperPanicRestoreBtn}</span>
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4 shrink-0 text-[#BE123C]" />
              <span>{t.whisperPanicBtn}</span>
            </>
          )}
        </button>
      </div>
    </main>
  );
}
