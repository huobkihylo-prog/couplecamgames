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
  CheckCircle2,
  Crown,
  Dice5,
  Eye,
  Flame,
  Lightbulb,
  Loader2,
  MicOff,
  Music,
  Radio,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type {
  ConnectionMode,
  FaceMetrics,
  JamBlindTrack,
  JamEmoteKind,
  JamFormat,
  JamInstrumentId,
  JamMode,
  JamPlayer,
  JamState,
  PeerMessage,
  TrackerStatus,
} from '../types/duoplay';
import {
  advanceJamRound,
  buildInitialsHint,
  createAirPlayMemory,
  createInitialJamState,
  detectAirPlayTriggers,
  JAM_SONG_BANK,
  launchBlindTestRound,
  launchInstrumentRound,
  matchMusicalAnswer,
  pickRandomSong,
  resolveJamRound,
  SOLO_BLINDTEST_ARTISTS,
  startJamMatch,
  triggerJamBuzzer,
} from '../game/coupleJamLogic';
import { jamAudioEngine } from '../services/jamAudioEngine';
import { JamHandTracker } from '../services/jamHandTracker';
import { searchItunesSongsJsonp, type ItunesTrackResult } from '../services/itunesJsonp';
import { AvatarCanvas } from './AvatarCanvas';
import {
  JamInstrumentStage,
  type JamHandCursor,
  type JamVisualPulse,
} from './JamInstrumentStage';
import { JamBlindTestStage } from './JamBlindTestStage';

interface CoupleJamGameViewProps {
  localName: string;
  partnerName: string;
  connectionMode: ConnectionMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micMuted: boolean;
  sfxMuted: boolean;
  localFaceMetricsRef: MutableRefObject<FaceMetrics>;
  partnerFaceMetricsRef: MutableRefObject<FaceMetrics>;
  onRecordJamSession: (points: number) => void;
  onVideoRef: (el: HTMLVideoElement | null) => void;
  onRequestCamera: () => void;
  onSendPeerMessage: (msg: PeerMessage) => void;
  onSendPeerRealtime: (msg: PeerMessage) => void;
  registerPeerHandler: (handler: ((msg: PeerMessage) => void) | null) => void;
  onReturnToHub: () => void;
}

const INSTRUMENT_TABS: { id: JamInstrumentId; icon: string; label: string }[] = [
  { id: 'darbouka', icon: '🥁', label: 'Darbouka' },
  { id: 'guitar', icon: '🎸', label: 'Guitare' },
  { id: 'piano', icon: '🎹', label: 'Piano' },
  { id: 'oud', icon: '🪕', label: 'Oud' },
];

const METRONOME_OPTIONS: (0 | 90 | 110 | 130)[] = [0, 90, 110, 130];

const CONCERT_EMOTES: { kind: JamEmoteKind; emoji: string; label: string }[] = [
  { kind: 'bravo', emoji: '👏', label: 'Bravo' },
  { kind: 'fuego', emoji: '🔥', label: 'Fuego' },
  { kind: 'encore', emoji: '💖', label: 'Encore !' },
];

interface FloatingReaction {
  id: number;
  emoji: string;
  label: string;
  xPct: number;
}

const CONFETTI_COLORS = ['#7C3AED', '#FACC15', '#FF4D8D', '#22D3EE', '#34D399', '#FB923C'];

export function CoupleJamGameView({
  localName,
  partnerName,
  connectionMode,
  localStream,
  remoteStream,
  cameraEnabled,
  micMuted,
  sfxMuted,
  localFaceMetricsRef,
  partnerFaceMetricsRef,
  onRecordJamSession,
  onVideoRef,
  onRequestCamera,
  onSendPeerMessage,
  onSendPeerRealtime,
  registerPeerHandler,
  onReturnToHub,
}: CoupleJamGameViewProps) {
  const isSolo = connectionMode === 'solo';
  const isHost = connectionMode === 'p2p-host' || isSolo;
  const localRole: JamPlayer = connectionMode === 'p2p-guest' ? 'guest' : 'host';
  const hostName = localRole === 'host' ? localName : partnerName;
  const guestName = localRole === 'guest' ? localName : partnerName;

  // Authoritative state
  const [state, setState] = useState<JamState>(() => createInitialJamState('guess-instrument', 5));
  const stateRef = useRef<JamState>(state);
  stateRef.current = state;

  // Lobby selections
  const [selectedMode, setSelectedMode] = useState<JamMode>('guess-instrument');
  const [selectedFormat, setSelectedFormat] = useState<JamFormat>(5);
  const [soloBlindLoading, setSoloBlindLoading] = useState(false);
  const [soloNotice, setSoloNotice] = useState<string | null>(null);

  // Mode 1 prep controls
  const [prepSongId, setPrepSongId] = useState<string | null>(JAM_SONG_BANK[0].id);
  const [prepTitle, setPrepTitle] = useState<string>(JAM_SONG_BANK[0].title);
  const [prepArtist, setPrepArtist] = useState<string>(JAM_SONG_BANK[0].artist);
  const [prepCategory, setPrepCategory] = useState<string>(JAM_SONG_BANK[0].category);
  const [prepInstrument, setPrepInstrument] = useState<JamInstrumentId>(JAM_SONG_BANK[0].recommendedInstrument);
  const [prepLightGuide, setPrepLightGuide] = useState<boolean>(true);
  const [prepAntiCheat, setPrepAntiCheat] = useState<boolean>(true);
  const [guideStepIdx, setGuideStepIdx] = useState<number>(0);

  // Mode 1 guesser input
  const [instGuessInput, setInstGuessInput] = useState('');

  // Mode 3 Concert Duo controls
  const [concertInstrument, setConcertInstrument] = useState<JamInstrumentId>(
    localRole === 'host' ? 'darbouka' : 'oud',
  );
  const [metronomeBpm, setMetronomeBpm] = useState<0 | 90 | 110 | 130>(0);
  const [metronomeBeat, setMetronomeBeat] = useState<number>(0);

  // Visual pulses & floating emotes
  const [lastPulse, setLastPulse] = useState<JamVisualPulse | null>(null);
  const pulseSeqRef = useRef(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // Camera air-play (lazy-loaded 2-hand MediaPipe HandLandmarker)
  const [cameraAirPlayEnabled, setCameraAirPlayEnabled] = useState(false);
  const [jamHandStatus, setJamHandStatus] = useState<TrackerStatus>('idle');
  const [handCursors, setHandCursors] = useState<JamHandCursor[]>([]);
  const jamHandTrackerRef = useRef<JamHandTracker | null>(null);
  const airPlayMemoryRef = useRef(createAirPlayMemory());
  const lastBuzzerGestureMsRef = useRef(0);

  // Floating camera videos (z-50)
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const showLocalLiveVideo = Boolean(localStream) && cameraEnabled;
  const showRemoteLiveVideo = Boolean(remoteStream) && !isSolo;

  // Standalone HTML5 <audio> elements (NEVER attached to AudioContext.createMediaElementSource!)
  const blindAudioRef = useRef<HTMLAudioElement | null>(null);
  const privateAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isBlindAudioPlaying, setIsBlindAudioPlaying] = useState(false);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);
  const [privatePreviewTrackId, setPrivatePreviewTrackId] = useState<number | null>(null);
  const audioUnlockedRef = useRef(false);

  // Mic anti-cheat restoration snapshot
  const initialAudioTrackEnabledRef = useRef<Map<MediaStreamTrack, boolean>>(new Map());
  const antiCheatMutedActiveRef = useRef(false);

  // Keep Web Audio mute synced with global toolbar mute
  useEffect(() => {
    jamAudioEngine.muted = sfxMuted;
  }, [sfxMuted]);

  // Sync document.body.dataset.state for testability
  useEffect(() => {
    document.body.dataset.state =
      state.phase === 'LOBBY'
        ? 'ready'
        : state.phase === 'MATCH_OVER'
          ? 'gameover'
          : 'playing';
  }, [state.phase]);

  // Record best score when match finishes
  useEffect(() => {
    if (state.phase === 'MATCH_OVER') {
      const topScore = Math.max(state.scores.host, state.scores.guest);
      if (topScore > 0) {
        onRecordJamSession(topScore);
      }
    }
  }, [state.phase, state.scores.host, state.scores.guest, onRecordJamSession]);

  // Bind floating camera streams
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

  // Capture initial mic track states so we can always restore them cleanly
  useEffect(() => {
    if (!localStream) return;
    const map = initialAudioTrackEnabledRef.current;
    localStream.getAudioTracks().forEach((track) => {
      if (!map.has(track)) {
        map.set(track, track.enabled);
      }
    });
  }, [localStream]);

  const restoreMicAfterAntiCheat = useCallback(() => {
    if (!antiCheatMutedActiveRef.current) return;
    antiCheatMutedActiveRef.current = false;
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => {
      const saved = initialAudioTrackEnabledRef.current.get(track);
      track.enabled = saved !== undefined ? saved && !micMuted : !micMuted;
    });
  }, [localStream, micMuted]);

  // Apply Anti-cheat mic mute strictly during Mode 1 active PLAYING round for the Musician
  useEffect(() => {
    const shouldMuteForAntiCheat =
      state.mode === 'guess-instrument' &&
      state.phase === 'PLAYING' &&
      state.antiCheatMute &&
      state.performer === localRole &&
      !state.soloAiPerformer;

    if (shouldMuteForAntiCheat && localStream) {
      if (!antiCheatMutedActiveRef.current) {
        localStream.getAudioTracks().forEach((track) => {
          initialAudioTrackEnabledRef.current.set(track, track.enabled);
          track.enabled = false;
        });
        antiCheatMutedActiveRef.current = true;
      }
    } else {
      restoreMicAfterAntiCheat();
    }
  }, [
    state.mode,
    state.phase,
    state.antiCheatMute,
    state.performer,
    state.soloAiPerformer,
    localRole,
    localStream,
    restoreMicAfterAntiCheat,
  ]);

  // Unlock Web Audio + HTML5 <audio> on first user interaction (iOS Safari / Android Chrome)
  const unlockAllAudio = useCallback(() => {
    jamAudioEngine.unlock();
    if (!audioUnlockedRef.current) {
      audioUnlockedRef.current = true;
      const el = blindAudioRef.current;
      if (el && !el.src) {
        el.muted = true;
        el.play()
          .then(() => {
            el.pause();
            el.muted = false;
          })
          .catch(() => {
            el.muted = false;
          });
      }
    }
    // If blind audio was blocked by autoplay policy, immediately retry play now!
    if (audioAutoplayBlocked && blindAudioRef.current && blindAudioRef.current.src) {
      blindAudioRef.current.muted = false;
      blindAudioRef.current
        .play()
        .then(() => {
          setAudioAutoplayBlocked(false);
          setIsBlindAudioPlaying(true);
        })
        .catch(() => {});
    }
  }, [audioAutoplayBlocked]);

  const stopBlindAudio = useCallback(() => {
    const el = blindAudioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    setIsBlindAudioPlaying(false);
    setAudioAutoplayBlocked(false);
  }, []);

  const stopPrivatePreview = useCallback(() => {
    const el = privateAudioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    setPrivatePreviewTrackId(null);
  }, []);

  const playBlindTrackAudio = useCallback(
    (track: JamBlindTrack) => {
      stopPrivatePreview();
      const el = blindAudioRef.current;
      if (!el || track.source !== 'itunes' || !track.previewUrl) {
        setIsBlindAudioPlaying(false);
        return;
      }
      el.pause();
      el.src = track.previewUrl;
      el.volume = 0.85;
      el.playbackRate = track.playbackRate || 1;
      el.currentTime = 0;
      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            setAudioAutoplayBlocked(false);
            setIsBlindAudioPlaying(true);
          })
          .catch(() => {
            setAudioAutoplayBlocked(true);
            setIsBlindAudioPlaying(false);
          });
      }
    },
    [stopPrivatePreview],
  );

  // Sync HTML5 <audio> pause / resume / reveal gentle fade
  useEffect(() => {
    const el = blindAudioRef.current;
    if (!el || !el.src) return;

    if (state.phase === 'PLAYING' && !state.isPaused) {
      el.volume = 0.85;
      if (state.blindTrack?.playbackRate) {
        el.playbackRate = state.blindTrack.playbackRate;
      }
      if (el.paused && !audioAutoplayBlocked) {
        el.play()
          .then(() => setIsBlindAudioPlaying(true))
          .catch(() => setAudioAutoplayBlocked(true));
      }
    } else if (state.phase === 'BUZZER' || state.isPaused) {
      el.pause();
      setIsBlindAudioPlaying(false);
    } else if (state.phase === 'REVEAL') {
      // Gently let the track play softly in background for 4.5s on reveal, then stop
      el.volume = 0.28;
      if (el.paused && !audioAutoplayBlocked) {
        el.play().catch(() => {});
      }
      const timer = window.setTimeout(() => {
        if (stateRef.current.phase === 'REVEAL') {
          el.pause();
          setIsBlindAudioPlaying(false);
        }
      }, 4500);
      return () => window.clearTimeout(timer);
    } else {
      stopBlindAudio();
    }
  }, [
    state.phase,
    state.isPaused,
    state.blindTrack?.playbackRate,
    audioAutoplayBlocked,
    stopBlindAudio,
  ]);

  // Strict cleanup on unmount / clicking "← Changer de jeu"
  useEffect(() => {
    return () => {
      stopBlindAudio();
      stopPrivatePreview();
      restoreMicAfterAntiCheat();
      if (jamHandTrackerRef.current) {
        jamHandTrackerRef.current.dispose();
        jamHandTrackerRef.current = null;
      }
    };
  }, [stopBlindAudio, stopPrivatePreview, restoreMicAfterAntiCheat]);

  // Host commits authoritative state & broadcasts JAM_STATE
  const commitHostState = useCallback(
    (next: JamState) => {
      stateRef.current = next;
      setState(next);
      if (!isSolo) {
        onSendPeerMessage({ type: 'JAM_STATE', state: next });
      }
    },
    [isSolo, onSendPeerMessage],
  );

  const spawnEmoteReaction = useCallback((kind: JamEmoteKind) => {
    const def = CONCERT_EMOTES.find((e) => e.kind === kind) ?? CONCERT_EMOTES[0];
    const id = Date.now() + Math.floor(Math.random() * 10000);
    setFloatingReactions((prev) => [
      ...prev.slice(-4),
      { id, emoji: def.emoji, label: def.label, xPct: 18 + Math.random() * 64 },
    ]);
    window.setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1800);
  }, []);

  const triggerNoteLocally = useCallback(
    (instrument: JamInstrumentId, noteId: string, player: JamPlayer, broadcast: boolean) => {
      jamAudioEngine.playNote(instrument, noteId, player === localRole ? 1 : 0.85);
      pulseSeqRef.current += 1;
      setLastPulse({ seq: pulseSeqRef.current, instrument, noteId, player });

      if (broadcast && !isSolo) {
        onSendPeerRealtime({
          type: 'JAM_NOTE',
          instrument,
          noteId,
          player,
        });
      }
    },
    [isSolo, localRole, onSendPeerRealtime],
  );

  // Current curated song for ✨ Partition Lumineuse
  const activeCuratedSong = useMemo(() => {
    const songId = state.phase === 'PLAYING' ? state.secretSongId : prepSongId;
    if (!songId) return null;
    return JAM_SONG_BANK.find((s) => s.id === songId) ?? null;
  }, [state.phase, state.secretSongId, prepSongId]);

  const currentGuideNoteId = useMemo(() => {
    if (
      state.mode !== 'guess-instrument' ||
      state.phase !== 'PLAYING' ||
      state.performer !== localRole ||
      state.soloAiPerformer ||
      !prepLightGuide ||
      !activeCuratedSong
    ) {
      return null;
    }
    const activeInst = state.instruments[localRole];
    if (activeInst !== activeCuratedSong.recommendedInstrument) return null;
    const notes = activeCuratedSong.guideNotes;
    if (notes.length === 0) return null;
    return notes[guideStepIdx % notes.length].noteId;
  }, [
    state.mode,
    state.phase,
    state.performer,
    state.soloAiPerformer,
    state.instruments,
    localRole,
    prepLightGuide,
    activeCuratedSong,
    guideStepIdx,
  ]);

  // Handle local player playing an instrument note
  const handleLocalInstrumentNote = useCallback(
    (noteId: string) => {
      unlockAllAudio();
      const cur = stateRef.current;
      const activeInst =
        cur.mode === 'concert-duo' ? concertInstrument : cur.instruments[localRole];

      triggerNoteLocally(activeInst, noteId, localRole, true);

      // Advance ✨ Partition Lumineuse when musician hits the highlighted note
      if (currentGuideNoteId && noteId === currentGuideNoteId) {
        setGuideStepIdx((idx) => idx + 1);
      }
    },
    [unlockAllAudio, concertInstrument, localRole, triggerNoteLocally, currentGuideNoteId],
  );

  // Process authoritative host actions (from local host OR guest PeerJS message)
  const applyHostAction = useCallback(
    (
      action: Extract<PeerMessage, { type: 'JAM_ACTION' }>,
      from: JamPlayer,
    ) => {
      const cur = stateRef.current;

      if (action.action === 'EMOTE' && action.emote) {
        spawnEmoteReaction(action.emote);
        return;
      }

      if (action.action === 'SET_INSTRUMENT' && action.instrument) {
        commitHostState({
          ...cur,
          instruments: { ...cur.instruments, [from]: action.instrument },
          stateSeq: cur.stateSeq + 1,
        });
        return;
      }

      if (action.action === 'PREP_LAUNCH_INSTRUMENT') {
        setGuideStepIdx(0);
        const next = launchInstrumentRound(cur, {
          songId: action.songId ?? null,
          title: action.songTitle || 'Mélodie Mystère',
          artist: action.songArtist || '',
          category: action.songCategory || 'Libre',
          instrument: action.instrument || cur.instruments[cur.performer],
          antiCheatMute: Boolean(action.antiCheat),
        });
        commitHostState(next);
        return;
      }

      if (action.action === 'PREP_LAUNCH_BLINDTEST' && action.blindTrack) {
        const track = action.blindTrack;
        const next = launchBlindTestRound(cur, track);
        commitHostState(next);
        if (!isSolo) {
          onSendPeerMessage({
            type: 'BLINDTEST_START',
            source: track.source,
            previewUrl: track.previewUrl,
            artworkUrl: track.artworkUrl,
            trackName: track.trackName,
            artistName: track.artistName,
            playbackRate: track.playbackRate,
            duration: track.duration,
          });
        }
        playBlindTrackAudio(track);
        return;
      }

      if (action.action === 'BUZZER') {
        if (cur.phase !== 'PLAYING' || cur.mode !== 'blind-test') return;
        jamAudioEngine.playBuzzer();
        commitHostState(triggerJamBuzzer(cur, from));
        return;
      }

      if (action.action === 'TOGGLE_PAUSE') {
        if (cur.phase !== 'PLAYING' && cur.phase !== 'BUZZER') return;
        commitHostState({
          ...cur,
          phase: 'PLAYING',
          isPaused: !cur.isPaused,
          buzzerLeftSec: 0,
          stateSeq: cur.stateSeq + 1,
        });
        return;
      }

      if (action.action === 'HINT_CATEGORY') {
        if (cur.hintCategoryUsed) return;
        commitHostState({
          ...cur,
          hintCategoryUsed: true,
          hintsCount: cur.hintsCount + 1,
          stateSeq: cur.stateSeq + 1,
        });
        return;
      }

      if (action.action === 'HINT_ARTIST') {
        if (cur.hintArtistUsed) return;
        commitHostState({
          ...cur,
          hintArtistUsed: true,
          hintsCount: cur.hintsCount + 1,
          stateSeq: cur.stateSeq + 1,
        });
        return;
      }

      if (action.action === 'HINT_UNBLUR') {
        if (cur.hintUnblurUsed) return;
        commitHostState({
          ...cur,
          hintUnblurUsed: true,
          hintsCount: cur.hintsCount + 1,
          stateSeq: cur.stateSeq + 1,
        });
        return;
      }

      if (action.action === 'GUESS' && action.text) {
        if (cur.phase !== 'PLAYING' && cur.phase !== 'BUZZER') return;
        const song = cur.secretSongId
          ? JAM_SONG_BANK.find((s) => s.id === cur.secretSongId)
          : null;
        const matched = matchMusicalAnswer(
          action.text,
          cur.blindTrack?.trackName || cur.secretTitle,
          cur.blindTrack?.artistName || cur.secretArtist,
          song?.aliases ?? [],
          true,
        );
        if (matched) {
          jamAudioEngine.playCorrectFanfare();
          commitHostState(resolveJamRound(cur, true, action.text));
        } else {
          commitHostState({
            ...cur,
            lastWrongGuess: action.text,
            stateSeq: cur.stateSeq + 1,
          });
        }
        return;
      }

      if (action.action === 'FOUND_ORAL') {
        if (cur.phase !== 'PLAYING' && cur.phase !== 'BUZZER') return;
        jamAudioEngine.playCorrectFanfare();
        commitHostState(resolveJamRound(cur, true, 'Trouvé au micro'));
        return;
      }

      if (action.action === 'REVEAL_NOW') {
        if (cur.phase !== 'PLAYING' && cur.phase !== 'BUZZER') return;
        commitHostState(resolveJamRound(cur, false));
        return;
      }

      if (action.action === 'NEXT_ROUND') {
        stopBlindAudio();
        const next = advanceJamRound(cur);
        commitHostState(next);
      }
    },
    [commitHostState, isSolo, onSendPeerMessage, playBlindTrackAudio, spawnEmoteReaction, stopBlindAudio],
  );

  const dispatchAction = useCallback(
    (action: Extract<PeerMessage, { type: 'JAM_ACTION' }>) => {
      unlockAllAudio();
      if (isHost) {
        applyHostAction(action, localRole);
      } else {
        if (action.action === 'EMOTE' && action.emote) {
          spawnEmoteReaction(action.emote);
        }
        if (action.action === 'BUZZER') {
          jamAudioEngine.playBuzzer();
        }
        onSendPeerMessage(action);
      }
    },
    [unlockAllAudio, isHost, applyHostAction, localRole, spawnEmoteReaction, onSendPeerMessage],
  );

  // Register PeerJS message handler
  useEffect(() => {
    registerPeerHandler((msg: PeerMessage) => {
      if (msg.type === 'JAM_NOTE') {
        triggerNoteLocally(msg.instrument, msg.noteId, msg.player, false);
      } else if (msg.type === 'BLINDTEST_START') {
        playBlindTrackAudio({
          source: msg.source,
          previewUrl: msg.previewUrl,
          artworkUrl: msg.artworkUrl,
          trackName: msg.trackName,
          artistName: msg.artistName,
          playbackRate: msg.playbackRate,
          duration: msg.duration,
        });
      } else if (msg.type === 'JAM_STATE') {
        if (!isHost) {
          const prevPhase = stateRef.current.phase;
          stateRef.current = msg.state;
          setState(msg.state);
          if (msg.state.phase === 'BUZZER' && prevPhase !== 'BUZZER') {
            jamAudioEngine.playBuzzer();
          } else if (msg.state.phase === 'REVEAL' && prevPhase !== 'REVEAL' && msg.state.outcome?.guessed) {
            jamAudioEngine.playCorrectFanfare();
          }
        }
      } else if (msg.type === 'JAM_ACTION') {
        if (msg.action === 'EMOTE' && msg.emote) {
          spawnEmoteReaction(msg.emote);
        } else if (isHost) {
          applyHostAction(msg, 'guest');
        }
      }
    });
    return () => registerPeerHandler(null);
  }, [registerPeerHandler, triggerNoteLocally, playBlindTrackAudio, isHost, applyHostAction, spawnEmoteReaction]);

  // Host authoritative 250ms countdown tick for Mode 1 (45s), Mode 2 (30s) & Buzzer (6s)
  useEffect(() => {
    if (!isHost) return;
    if (state.mode === 'concert-duo') return;
    if (state.phase !== 'PLAYING' && state.phase !== 'BUZZER') return;

    const timer = window.setInterval(() => {
      const cur = stateRef.current;
      if (cur.phase === 'BUZZER') {
        const nextBuzzer = Math.max(0, Number((cur.buzzerLeftSec - 0.25).toFixed(2)));
        if (nextBuzzer <= 0) {
          commitHostState({
            ...cur,
            phase: 'PLAYING',
            isPaused: false,
            buzzerLeftSec: 0,
            stateSeq: cur.stateSeq + 1,
          });
        } else {
          commitHostState({
            ...cur,
            buzzerLeftSec: nextBuzzer,
            stateSeq: cur.stateSeq + 1,
          });
        }
        return;
      }

      if (cur.phase === 'PLAYING' && !cur.isPaused) {
        const nextTime = Math.max(0, Number((cur.timeLeftSec - 0.25).toFixed(2)));
        if (nextTime <= 0) {
          commitHostState(resolveJamRound({ ...cur, timeLeftSec: 0 }, false));
        } else {
          commitHostState({
            ...cur,
            timeLeftSec: nextTime,
            stateSeq: cur.stateSeq + 1,
          });
        }
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [isHost, state.mode, state.phase, commitHostState]);

  // Solo AI Musician melody playback (🤖 Devine l'IA Instrument)
  useEffect(() => {
    if (
      !isSolo ||
      !state.soloAiPerformer ||
      state.mode !== 'guess-instrument' ||
      state.phase !== 'PLAYING' ||
      !state.secretSongId
    ) {
      return;
    }

    const song = JAM_SONG_BANK.find((s) => s.id === state.secretSongId);
    if (!song || song.guideNotes.length === 0) return;

    const timers: number[] = [];
    const loopLenMs = (song.guideNotes[song.guideNotes.length - 1]?.beatMs ?? 3000) + 1200;

    const schedulePass = (offsetMs: number) => {
      for (const step of song.guideNotes) {
        const tid = window.setTimeout(() => {
          if (stateRef.current.phase !== 'PLAYING') return;
          triggerNoteLocally(song.recommendedInstrument, step.noteId, 'guest', false);
        }, offsetMs + step.beatMs);
        timers.push(tid);
      }
    };

    // Schedule up to 5 passes across the 45s round
    for (let pass = 0; pass < 5; pass += 1) {
      schedulePass(450 + pass * loopLenMs);
    }

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [isSolo, state.soloAiPerformer, state.mode, state.phase, state.secretSongId, triggerNoteLocally]);

  // Auto-advance Solo AI Instrument / Solo Blind Test when entering PREP on round 2+
  const launchSoloBlindTestRound = useCallback(async (baseState: JamState) => {
    setSoloBlindLoading(true);
    setSoloNotice(null);
    const shuffled = [...SOLO_BLINDTEST_ARTISTS].sort(() => Math.random() - 0.5);
    let chosenTrack: ItunesTrackResult | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const artist = shuffled[attempt % shuffled.length];
      try {
        const list = await searchItunesSongsJsonp(artist, 8, 6500);
        if (list.length > 0) {
          chosenTrack = list[Math.floor(Math.random() * Math.min(5, list.length))];
          break;
        }
      } catch {
        // Retry another artist
      }
    }

    setSoloBlindLoading(false);

    if (chosenTrack) {
      const track: JamBlindTrack = {
        source: 'itunes',
        previewUrl: chosenTrack.previewUrl,
        artworkUrl: chosenTrack.artworkUrlHiRes || chosenTrack.artworkUrl,
        trackName: chosenTrack.trackName,
        artistName: chosenTrack.artistName,
        playbackRate: 1,
        duration: 30,
      };
      const launched = launchBlindTestRound(baseState, track);
      commitHostState(launched);
      playBlindTrackAudio(track);
    } else {
      // Graceful fallback if iTunes JSONP is blocked offline so Solo mode never dead-ends
      const fallbackSong = pickRandomSong();
      setSoloNotice('Catalogue iTunes inaccessible hors-ligne — manche lancée en Mode Libre !');
      const fallbackTrack: JamBlindTrack = {
        source: 'free',
        trackName: fallbackSong.title,
        artistName: fallbackSong.artist,
        playbackRate: 1,
        duration: 30,
      };
      commitHostState(launchBlindTestRound(baseState, fallbackTrack));
    }
  }, [commitHostState, playBlindTrackAudio]);

  useEffect(() => {
    if (!isSolo || !state.soloAiPerformer || state.phase !== 'PREP') return;

    if (state.mode === 'guess-instrument') {
      const song = pickRandomSong(state.secretSongId);
      const launched = launchInstrumentRound(state, {
        songId: song.id,
        title: song.title,
        artist: song.artist,
        category: song.category,
        instrument: song.recommendedInstrument,
        antiCheatMute: false,
      });
      commitHostState(launched);
    } else if (state.mode === 'blind-test' && !soloBlindLoading) {
      void launchSoloBlindTestRound(state);
    }
  }, [isSolo, state, soloBlindLoading, commitHostState, launchSoloBlindTestRound]);

  // Mode 3 Metronome loop (90 / 110 / 130 BPM)
  useEffect(() => {
    if (state.mode !== 'concert-duo' || state.phase !== 'PLAYING' || metronomeBpm === 0) {
      setMetronomeBeat(0);
      return;
    }
    const intervalMs = Math.round(60000 / metronomeBpm);
    let beat = 0;
    const tick = () => {
      beat = (beat % 4) + 1;
      setMetronomeBeat(beat);
      jamAudioEngine.playMetronomeTick(beat === 1);
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [state.mode, state.phase, metronomeBpm]);

  // Lazy-loaded 2-hand MediaPipe HandLandmarker strictly when "✋ Jouer en l'air (Caméra)" is toggled ON
  useEffect(() => {
    if (!cameraAirPlayEnabled) {
      if (jamHandTrackerRef.current) {
        jamHandTrackerRef.current.dispose();
        jamHandTrackerRef.current = null;
      }
      setJamHandStatus('idle');
      setHandCursors([]);
      return;
    }

    if (!localStream) {
      setJamHandStatus('fallback');
      return;
    }

    let cancelled = false;
    const tracker = new JamHandTracker();
    jamHandTrackerRef.current = tracker;
    setJamHandStatus('loading');

    tracker.ensureInitialized().then((st) => {
      if (!cancelled) setJamHandStatus(st);
    });

    let rafId = 0;
    let lastMs = 0;

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      if (now - lastMs < 32) return;
      lastMs = now;

      const video = localVideoRef.current;
      const frame = tracker.detectFrame(video, now);
      if (!frame) return;

      const cur = stateRef.current;

      // 1. Blind Test raised open hand buzzer gesture (Guesser only)
      const isGuesserInBlindTest =
        cur.mode === 'blind-test' &&
        cur.phase === 'PLAYING' &&
        cur.performer !== localRole;
      if (isGuesserInBlindTest && frame.anyRaisedOpenPalm && now - lastBuzzerGestureMsRef.current > 1500) {
        lastBuzzerGestureMsRef.current = now;
        dispatchAction({ type: 'JAM_ACTION', action: 'BUZZER' });
      }

      // 2. Instrument air-play (2 index fingertips with 160ms per-zone cooldown)
      const canPlayInstrument =
        cur.mode === 'concert-duo' ||
        (cur.mode === 'guess-instrument' &&
          cur.phase === 'PLAYING' &&
          cur.performer === localRole &&
          !cur.soloAiPerformer);

      if (canPlayInstrument) {
        setHandCursors(frame.hands.map((h) => ({ id: h.id, x: h.x, y: h.y })));
        const activeInst =
          cur.mode === 'concert-duo' ? concertInstrument : cur.instruments[localRole];
        const hits = detectAirPlayTriggers(activeInst, frame.hands, airPlayMemoryRef.current, now);
        for (const noteId of hits) {
          handleLocalInstrumentNote(noteId);
        }
      } else {
        setHandCursors([]);
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      tracker.dispose();
      if (jamHandTrackerRef.current === tracker) {
        jamHandTrackerRef.current = null;
      }
      setHandCursors([]);
    };
  }, [
    cameraAirPlayEnabled,
    localStream,
    localRole,
    concertInstrument,
    dispatchAction,
    handleLocalInstrumentNote,
  ]);

  // Lobby Launch Handlers
  const handleStartSelectedMode = () => {
    unlockAllAudio();
    setSoloNotice(null);
    stopBlindAudio();
    stopPrivatePreview();
    commitHostState(startJamMatch(selectedMode, selectedFormat, false));
  };

  const handleStartSoloAiInstrument = () => {
    unlockAllAudio();
    setSoloNotice(null);
    stopBlindAudio();
    const base = startJamMatch('guess-instrument', selectedFormat, true);
    const song = pickRandomSong();
    commitHostState(
      launchInstrumentRound(base, {
        songId: song.id,
        title: song.title,
        artist: song.artist,
        category: song.category,
        instrument: song.recommendedInstrument,
        antiCheatMute: false,
      }),
    );
  };

  const handleStartSoloBlindTest = () => {
    unlockAllAudio();
    setSoloNotice(null);
    stopBlindAudio();
    const base = startJamMatch('blind-test', selectedFormat, true);
    commitHostState(base);
  };

  const handlePickRandomSong = () => {
    unlockAllAudio();
    const song = pickRandomSong(prepSongId);
    setPrepSongId(song.id);
    setPrepTitle(song.title);
    setPrepArtist(song.artist);
    setPrepCategory(song.category);
    setPrepInstrument(song.recommendedInstrument);
    setPrepLightGuide(true);
  };

  const handleLaunchInstrumentPrep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prepTitle.trim()) return;
    dispatchAction({
      type: 'JAM_ACTION',
      action: 'PREP_LAUNCH_INSTRUMENT',
      songId: prepSongId ?? undefined,
      songTitle: prepTitle.trim(),
      songArtist: prepArtist.trim(),
      songCategory: prepCategory || 'Libre',
      instrument: prepInstrument,
      antiCheat: prepAntiCheat,
    });
  };

  const handlePrivatePreviewToggle = (track: ItunesTrackResult) => {
    unlockAllAudio();
    const el = privateAudioRef.current;
    if (!el) return;
    if (privatePreviewTrackId === track.trackId) {
      stopPrivatePreview();
      return;
    }
    el.pause();
    el.src = track.previewUrl;
    el.volume = 0.75;
    el.playbackRate = 1;
    el.play()
      .then(() => setPrivatePreviewTrackId(track.trackId))
      .catch(() => setPrivatePreviewTrackId(null));
  };

  const handleToggleCameraAirPlay = () => {
    unlockAllAudio();
    if (!cameraAirPlayEnabled && !localStream) {
      onRequestCamera();
    }
    setCameraAirPlayEnabled((prev) => !prev);
  };

  const isLocalPerformer =
    state.performer === localRole && !state.soloAiPerformer;

  const activeInstrumentForStage: JamInstrumentId =
    state.mode === 'concert-duo'
      ? concertInstrument
      : state.instruments[state.performer];

  const handleInstrumentSwitch = (inst: JamInstrumentId) => {
    unlockAllAudio();
    if (state.mode === 'concert-duo') {
      setConcertInstrument(inst);
    } else {
      setPrepInstrument(inst);
      dispatchAction({ type: 'JAM_ACTION', action: 'SET_INSTRUMENT', instrument: inst });
    }
  };

  const handleSubmitInstGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const text = instGuessInput.trim();
    if (!text) return;
    dispatchAction({ type: 'JAM_ACTION', action: 'GUESS', text });
    setInstGuessInput('');
  };

  const handleReturnToLobby = () => {
    stopBlindAudio();
    stopPrivatePreview();
    restoreMicAfterAntiCheat();
    commitHostState(createInitialJamState(selectedMode, selectedFormat));
  };

  // Match Winner computation
  const winnerName =
    state.scores.host > state.scores.guest
      ? hostName
      : state.scores.guest > state.scores.host
        ? guestName
        : 'Égalité parfaite !';

  return (
    <div
      data-testid="couple-jam-root"
      onPointerDown={unlockAllAudio}
      className="relative flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col bg-gradient-to-br from-[#120A2A] via-[#1C1042] to-[#0E1330] text-white"
    >
      {/* Hidden standalone HTML5 <audio> tags (NEVER piped into Web Audio createMediaElementSource) */}
      <audio
        ref={blindAudioRef}
        playsInline
        preload="auto"
        onEnded={() => setIsBlindAudioPlaying(false)}
      />
      <audio
        ref={privateAudioRef}
        playsInline
        preload="none"
        onEnded={() => setPrivatePreviewTrackId(null)}
      />

      {/* Ambient concert spotlight background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 12% 10%, rgba(124,58,237,0.34), transparent 40%), radial-gradient(circle at 88% 12%, rgba(34,211,238,0.25), transparent 42%), radial-gradient(circle at 50% 95%, rgba(255,77,141,0.22), transparent 46%)',
        }}
      />

      {/* Floating Concert Emote Reactions */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.xPct}%` }}
            className="absolute top-24 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#140E2E]/92 border border-[#FACC15]/60 text-sm font-black text-white shadow-xl animate-bounce"
          >
            {r.emoji} {r.label}
          </div>
        ))}
      </div>

      {/* Top Compact Concert Stage HUD + Floating Z-50 Opposite-Corner Camera Mini-Vignettes */}
      <div className="relative z-30 shrink-0 w-full max-w-6xl mx-auto px-2.5 sm:px-5 pt-2 pb-1.5 flex items-center justify-between gap-2">
        {/* Top-Left Floating Partner Camera Mini-Vignette (z-50) */}
        <div
          data-testid="jam-cam-partner"
          className="relative z-50 w-[86px] h-[62px] sm:w-[126px] sm:h-[82px] rounded-2xl overflow-hidden border-2 border-[#22D3EE]/70 bg-[#0E0A22] shadow-lg shrink-0"
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
              accentColor="#22D3EE"
              bgTop="#1B1F4A"
              bgBottom="#0D0A24"
              isAi={isSolo}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1.5 py-0.5 flex items-center justify-between text-[10px] font-extrabold">
            <span className="truncate max-w-[54px] sm:max-w-[78px]">{partnerName}</span>
            <span className="text-[#22D3EE] tabular-nums">
              {localRole === 'host' ? state.scores.guest : state.scores.host}
            </span>
          </div>
        </div>

        {/* Center Live Stage Header (Mode, Round, Air-Play Camera Toggle) */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center gap-1">
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <span className="text-xs sm:text-base font-black tracking-tight text-white truncate">
              🎵 Couple Jam
            </span>
            {state.phase !== 'LOBBY' && (
              <span className="text-[11px] sm:text-xs font-extrabold text-[#FACC15] tabular-nums">
                {state.mode === 'concert-duo'
                  ? '· 🔥 Concert Duo'
                  : `· Manche ${state.round}${state.totalRounds > 0 ? `/${state.totalRounds}` : ''}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {state.phase !== 'LOBBY' && (
              <button
                type="button"
                data-testid="jam-camera-airplay-toggle"
                onClick={handleToggleCameraAirPlay}
                className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-extrabold border transition-all inline-flex items-center gap-1 ${
                  cameraAirPlayEnabled
                    ? 'bg-[#22D3EE]/25 border-[#22D3EE] text-[#A5F3FC]'
                    : 'bg-white/10 border-white/20 text-white/85 hover:bg-white/18'
                }`}
              >
                <span className="hidden sm:inline">✋ Jouer en l’air (Caméra)</span>
                <span className="sm:hidden">✋ Caméra</span>
                {cameraAirPlayEnabled && jamHandStatus === 'loading' && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
              </button>
            )}

            {state.phase !== 'LOBBY' && isHost && (
              <button
                type="button"
                onClick={handleReturnToLobby}
                className="min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white/10 border border-white/20 text-white/85 hover:bg-white/20"
              >
                Modes
              </button>
            )}
          </div>
        </div>

        {/* Top-Right Floating Local Camera Mini-Vignette (z-50) */}
        <div
          data-testid="jam-cam-local"
          className="relative z-50 w-[86px] h-[62px] sm:w-[126px] sm:h-[82px] rounded-2xl overflow-hidden border-2 border-[#FF4D8D]/75 bg-[#0E0A22] shadow-lg shrink-0"
        >
          {showLocalLiveVideo ? (
            <video
              ref={(el) => {
                localVideoRef.current = el;
                onVideoRef(el);
              }}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover -scale-x-100"
            />
          ) : (
            <AvatarCanvas
              name={localName}
              metricsRef={localFaceMetricsRef}
              accentColor="#FF4D8D"
              bgTop="#2B144A"
              bgBottom="#0F0A26"
            />
          )}
          {!localStream && (
            <button
              type="button"
              onClick={onRequestCamera}
              aria-label="Activer la caméra"
              className="absolute top-1 end-1 w-6 h-6 rounded-full bg-[#120D28]/85 border border-white/30 flex items-center justify-center text-white hover:bg-[#FF4D8D]"
            >
              <Camera className="w-3 h-3" />
            </button>
          )}
          {(micMuted || antiCheatMutedActiveRef.current) && (
            <span
              title="Micro coupé"
              className="absolute top-1 start-1 w-5 h-5 rounded-full bg-[#EF4444]/90 flex items-center justify-center text-white"
            >
              <MicOff className="w-3 h-3" />
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1.5 py-0.5 flex items-center justify-between text-[10px] font-extrabold">
            <span className="truncate max-w-[54px] sm:max-w-[78px]">{localName}</span>
            <span className="text-[#FACC15] tabular-nums">
              {localRole === 'host' ? state.scores.host : state.scores.guest}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area — Strictly flex-1 min-h-0 overflow-hidden so zero page scroll on mobile */}
      <main className="relative z-20 flex-1 min-h-0 w-full max-w-6xl mx-auto px-2.5 sm:px-5 pb-2.5 sm:pb-4 flex flex-col gap-2 overflow-hidden">
        {/* ======================== LOBBY SCREEN ======================== */}
        {state.phase === 'LOBBY' && (
          <div
            data-testid="jam-lobby"
            className="flex-1 min-h-0 rounded-3xl border border-white/15 bg-[#150E32]/90 p-3.5 sm:p-6 flex flex-col justify-between gap-3 overflow-y-auto"
          >
            <div className="text-center space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Couple Jam : Devine le Son
              </h1>
              <p className="text-xs sm:text-sm text-white/75">
                4 instruments virtuels en direct, Blind Test universel 30 s et Concert Duo néon.
              </p>
            </div>

            {/* 3 Game Modes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: 'guess-instrument',
                    icon: '🎵',
                    title: 'Devine l’Instrument',
                    desc: 'Joue une mélodie ou un rythme (Darbouka, Guitare, Piano, Oud) pendant 45 s.',
                    ring: 'from-[#7C3AED] to-[#FF4D8D]',
                  },
                  {
                    id: 'blind-test',
                    icon: '🎧',
                    title: 'Blind Test Libre',
                    desc: 'Recherche n’importe quelle musique du monde (30 s) ou utilise ton micro.',
                    ring: 'from-[#FF4D8D] to-[#FACC15]',
                  },
                  {
                    id: 'concert-duo',
                    icon: '🔥',
                    title: 'Concert Duo (Jam)',
                    desc: 'Choisissez chacun un instrument et jouez ensemble en live avec métronome.',
                    ring: 'from-[#22D3EE] to-[#7C3AED]',
                  },
                ] as const
              ).map((m) => {
                const active = selectedMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-jam-mode={m.id}
                    onClick={() => {
                      unlockAllAudio();
                      setSelectedMode(m.id);
                    }}
                    className={`text-start p-3 sm:p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-1.5 ${
                      active
                        ? 'bg-white/14 border-[#FACC15] shadow-[0_0_24px_rgba(250,204,21,0.28)]'
                        : 'bg-white/6 border-white/15 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{m.icon}</span>
                      {active && (
                        <span className="text-[11px] font-black text-[#FACC15]">Sélectionné</span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-black text-white">{m.title}</h2>
                      <p className="text-[11px] sm:text-xs text-white/75 leading-snug mt-0.5">
                        {m.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Match Format (for Modes 1 & 2) */}
            {selectedMode !== 'concert-duo' && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs font-bold text-white/70">Format :</span>
                {(
                  [
                    { val: 5, label: '5 manches' },
                    { val: 10, label: '10 manches' },
                    { val: 0, label: 'Libre' },
                  ] as const
                ).map((fmt) => (
                  <button
                    key={fmt.val}
                    type="button"
                    onClick={() => setSelectedFormat(fmt.val)}
                    className={`min-h-[38px] px-3.5 rounded-xl text-xs font-extrabold border transition-all ${
                      selectedFormat === fmt.val
                        ? 'bg-[#FACC15] text-[#140E2E] border-white'
                        : 'bg-white/8 text-white/85 border-white/15 hover:bg-white/16'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Primary Start + Solo Training Shortcuts */}
            <div className="space-y-2">
              {isHost ? (
                <button
                  type="button"
                  data-start="true"
                  data-testid="jam-start-btn"
                  onClick={handleStartSelectedMode}
                  className="min-h-[50px] w-full rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#FF4D8D] to-[#FACC15] text-white font-black text-base shadow-[0_10px_30px_rgba(255,77,141,0.38)] hover:brightness-110 transition-all"
                >
                  🚀 Lancer {selectedMode === 'guess-instrument'
                    ? 'Devine l’Instrument'
                    : selectedMode === 'blind-test'
                      ? 'Blind Test Libre'
                      : 'Concert Duo'}
                </button>
              ) : (
                <div className="min-h-[48px] w-full rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-sm font-bold text-white/85">
                  L’Hôte choisit le mode musical et lance la scène…
                </div>
              )}

              {/* Dedicated Solo Training Buttons */}
              {isSolo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="jam-solo-ai-instrument"
                    onClick={handleStartSoloAiInstrument}
                    className="min-h-[44px] px-3.5 rounded-2xl bg-[#22D3EE]/18 border border-[#22D3EE]/60 text-[#E0F2FE] text-xs sm:text-sm font-extrabold hover:bg-[#22D3EE]/28 transition-all"
                  >
                    🤖 Devine l’IA (Instrument)
                  </button>
                  <button
                    type="button"
                    data-testid="jam-solo-blindtest"
                    onClick={handleStartSoloBlindTest}
                    className="min-h-[44px] px-3.5 rounded-2xl bg-[#FF4D8D]/18 border border-[#FF4D8D]/60 text-[#FCE7F3] text-xs sm:text-sm font-extrabold hover:bg-[#FF4D8D]/28 transition-all"
                  >
                    🎧 Blind Test Solo (20 artistes)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================== MODE 1 : DEVINE L'INSTRUMENT ======================== */}
        {state.phase !== 'LOBBY' &&
          state.phase !== 'MATCH_OVER' &&
          state.mode === 'guess-instrument' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
              {/* PREP PHASE */}
              {state.phase === 'PREP' &&
                (isLocalPerformer ? (
                  <form
                    onSubmit={handleLaunchInstrumentPrep}
                    className="flex-1 min-h-0 rounded-3xl border border-white/15 bg-[#140E2E]/92 p-3.5 sm:p-5 flex flex-col justify-between gap-2.5 overflow-y-auto"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-base sm:text-lg font-black text-white">
                          🎵 Préparation secrète (Musicien)
                        </h2>
                        <button
                          type="button"
                          data-testid="jam-random-song-btn"
                          onClick={handlePickRandomSong}
                          className="min-h-[40px] px-3 rounded-xl bg-[#FACC15] text-[#140E2E] font-black text-xs inline-flex items-center gap-1.5 hover:brightness-105 shrink-0"
                        >
                          <Dice5 className="w-4 h-4" />
                          <span>Piocher une chanson</span>
                        </button>
                      </div>

                      {/* Song title input */}
                      <div className="space-y-1">
                        <label htmlFor="jam-secret-song" className="text-xs font-bold text-white/75">
                          Morceau à faire deviner ({prepCategory})
                        </label>
                        <input
                          id="jam-secret-song"
                          type="text"
                          value={prepTitle}
                          onChange={(e) => {
                            setPrepTitle(e.target.value);
                            setPrepSongId(null);
                            setPrepCategory('Libre');
                          }}
                          placeholder="Écris n'importe quelle chanson ou pioche dans la banque…"
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#0C081E] border border-white/25 text-sm font-bold text-white focus:outline-none focus:border-[#FACC15]"
                        />
                        {prepArtist && (
                          <p className="text-[11px] font-semibold text-[#22D3EE] px-1">
                            Artiste / Référence : {prepArtist}
                          </p>
                        )}
                      </div>

                      {/* Instrument Picker */}
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                        {INSTRUMENT_TABS.map((inst) => (
                          <button
                            key={inst.id}
                            type="button"
                            onClick={() => setPrepInstrument(inst.id)}
                            className={`min-h-[44px] px-2 rounded-2xl border-2 text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 ${
                              prepInstrument === inst.id
                                ? 'bg-[#7C3AED]/45 border-[#FACC15] text-white'
                                : 'bg-white/8 border-white/15 text-white/80 hover:bg-white/14'
                            }`}
                          >
                            <span>{inst.icon}</span>
                            <span className="truncate">{inst.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Optional Aids: ✨ Partition Lumineuse & 🔇 Anti-triche */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setPrepLightGuide((v) => !v)}
                          className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 ${
                            prepLightGuide
                              ? 'bg-[#FACC15]/20 border-[#FACC15] text-[#FACC15]'
                              : 'bg-white/8 border-white/15 text-white/70'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>✨ Partition Lumineuse : {prepLightGuide ? 'ON' : 'OFF'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrepAntiCheat((v) => !v)}
                          className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 ${
                            prepAntiCheat
                              ? 'bg-[#FF4D8D]/20 border-[#FF4D8D] text-[#FBCFE8]'
                              : 'bg-white/8 border-white/15 text-white/70'
                          }`}
                        >
                          <MicOff className="w-3.5 h-3.5" />
                          <span>🔇 Anti-triche micro : {prepAntiCheat ? 'ON' : 'OFF'}</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      data-testid="jam-launch-instrument-btn"
                      disabled={!prepTitle.trim()}
                      className="min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#FF4D8D] to-[#FACC15] text-white font-black text-sm sm:text-base shadow-lg disabled:opacity-45"
                    >
                      🎸 Monter sur scène (45 s)
                    </button>
                  </form>
                ) : (
                  <div className="flex-1 min-h-0 rounded-3xl border border-white/15 bg-[#140E2E]/90 p-5 flex flex-col items-center justify-center text-center gap-3">
                    <Music className="w-12 h-12 text-[#FACC15] animate-bounce" />
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      {partnerName} choisit son morceau et son instrument…
                    </h3>
                    <p className="text-xs sm:text-sm text-white/75 max-w-sm">
                      Tu entendras chaque note en direct ! Prépare-toi à deviner le titre en moins de 45 secondes.
                    </p>
                  </div>
                ))}

              {/* PLAYING PHASE (Mode 1) */}
              {state.phase === 'PLAYING' && (
                <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
                  {/* Compact Performance Banner */}
                  <div className="shrink-0 rounded-2xl bg-[#150E32]/90 border border-white/15 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isLocalPerformer ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-extrabold text-[#FACC15] shrink-0">
                            Joue :
                          </span>
                          <span className="text-sm sm:text-base font-black text-white truncate">
                            {state.secretTitle}
                          </span>
                          {state.antiCheatMute && (
                            <span className="hidden sm:inline text-[11px] font-bold text-[#FF4D8D] shrink-0">
                              · 🔇 Micro coupé
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs sm:text-sm font-black text-[#22D3EE] truncate">
                            {state.soloAiPerformer
                              ? '🤖 Camille IA joue… Devine la chanson !'
                              : `🎧 Écoute ${partnerName} jouer !`}
                          </span>
                          {state.hintCategoryUsed && (
                            <span className="text-[11px] font-extrabold text-[#FACC15] shrink-0">
                              · {state.secretCategory} ({buildInitialsHint(state.secretTitle)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <span className="text-lg sm:text-xl font-black tabular-nums text-[#FACC15] shrink-0">
                      {Math.ceil(state.timeLeftSec)}s
                    </span>

                    {isLocalPerformer && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          data-testid="jam-oral-found-btn"
                          onClick={() => dispatchAction({ type: 'JAM_ACTION', action: 'FOUND_ORAL' })}
                          className="min-h-[38px] px-3 rounded-xl bg-[#10B981] text-[#052116] font-black text-xs inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>🎉 Trouvé !</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatchAction({ type: 'JAM_ACTION', action: 'REVEAL_NOW' })}
                          className="min-h-[38px] px-2.5 rounded-xl bg-white/12 text-white font-bold text-xs inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Instrument switcher on Musician screen */}
                  {isLocalPerformer && (
                    <div className="shrink-0 grid grid-cols-4 gap-1.5">
                      {INSTRUMENT_TABS.map((inst) => (
                        <button
                          key={inst.id}
                          type="button"
                          onClick={() => handleInstrumentSwitch(inst.id)}
                          className={`min-h-[36px] px-2 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1 ${
                            activeInstrumentForStage === inst.id
                              ? 'bg-[#7C3AED]/55 border-[#FACC15] text-white'
                              : 'bg-white/8 border-white/15 text-white/80 hover:bg-white/15'
                          }`}
                        >
                          <span>{inst.icon}</span>
                          <span className="truncate">{inst.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Interactive Virtual Instrument Stage */}
                  <div className="flex-1 min-h-0">
                    <JamInstrumentStage
                      instrument={activeInstrumentForStage}
                      interactive={isLocalPerformer}
                      guideNoteId={currentGuideNoteId}
                      lastPulse={lastPulse}
                      handCursors={handCursors}
                      onTriggerNote={handleLocalInstrumentNote}
                    />
                  </div>

                  {/* Guesser Answer Bar (strictly shown to Guesser) */}
                  {!isLocalPerformer && (
                    <form
                      onSubmit={handleSubmitInstGuess}
                      className="shrink-0 flex items-center gap-1.5 sm:gap-2"
                    >
                      <button
                        type="button"
                        disabled={state.hintCategoryUsed}
                        onClick={() => dispatchAction({ type: 'JAM_ACTION', action: 'HINT_CATEGORY' })}
                        className="min-h-[44px] px-2.5 sm:px-3 rounded-2xl bg-white/10 border border-white/20 text-xs font-extrabold text-[#FACC15] disabled:opacity-40 inline-flex items-center gap-1 shrink-0"
                      >
                        <Lightbulb className="w-4 h-4" />
                        <span className="hidden sm:inline">Indice</span>
                        <span>-0,5</span>
                      </button>
                      <input
                        type="text"
                        value={instGuessInput}
                        onChange={(e) => setInstGuessInput(e.target.value)}
                        placeholder="Tape le nom du morceau…"
                        aria-label="Devine le morceau joué"
                        className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-2xl bg-[#0D0920] border border-white/25 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-[#22D3EE]"
                      />
                      <button
                        type="submit"
                        disabled={!instGuessInput.trim()}
                        className="min-h-[44px] px-4 rounded-2xl bg-[#22D3EE] text-[#100B24] font-black text-sm disabled:opacity-45 shrink-0"
                      >
                        Valider
                      </button>
                      {state.soloAiPerformer && (
                        <button
                          type="button"
                          onClick={() => dispatchAction({ type: 'JAM_ACTION', action: 'REVEAL_NOW' })}
                          className="min-h-[44px] px-3 rounded-2xl bg-white/10 border border-white/20 text-xs font-bold text-white/85 shrink-0"
                        >
                          Passer
                        </button>
                      )}
                    </form>
                  )}
                </div>
              )}

              {/* REVEAL PHASE (Mode 1) */}
              {state.phase === 'REVEAL' && state.outcome && (
                <div
                  data-testid="jam-instrument-reveal"
                  className="flex-1 min-h-0 rounded-3xl border border-[#FACC15]/45 bg-[#150E32]/95 p-5 flex flex-col items-center justify-center text-center gap-3"
                >
                  <div className="text-4xl">{state.outcome.guessed ? '🎉' : '🎭'}</div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-[#FACC15]">
                      {state.outcome.guessed
                        ? `Trouvé ! +${state.outcome.pointsAwarded} pt${state.outcome.pointsAwarded > 1 ? 's' : ''}${state.outcome.fastBonus ? ' · ⚡ Éclair' : ''}`
                        : 'Temps écoulé ! 0 pt'}
                    </p>
                    <h3 className="text-2xl font-black text-white">{state.outcome.revealTitle}</h3>
                    {state.outcome.revealArtist && (
                      <p className="text-sm font-bold text-[#22D3EE]">{state.outcome.revealArtist}</p>
                    )}
                  </div>
                  {state.outcome.dareText && (
                    <div className="w-full max-w-md rounded-2xl bg-[#FF4D8D]/20 border border-[#FF4D8D]/50 px-4 py-3 text-xs sm:text-sm font-bold text-white">
                      🎭 Gage Musical : {state.outcome.dareText}
                    </div>
                  )}
                  <button
                    type="button"
                    data-testid="jam-next-round-btn"
                    onClick={() => dispatchAction({ type: 'JAM_ACTION', action: 'NEXT_ROUND' })}
                    className="min-h-[46px] px-6 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#FF4D8D] to-[#FACC15] text-white font-black text-sm shadow-lg"
                  >
                    {state.totalRounds > 0 && state.round >= state.totalRounds
                      ? '🏆 Classement final'
                      : '➡️ Manche suivante'}
                  </button>
                </div>
              )}
            </div>
          )}

        {/* ======================== MODE 2 : BLIND TEST LIBRE ======================== */}
        {state.phase !== 'LOBBY' &&
          state.phase !== 'MATCH_OVER' &&
          state.mode === 'blind-test' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
              {soloBlindLoading ? (
                <div className="flex-1 min-h-0 rounded-3xl border border-white/15 bg-[#140E2E]/90 p-6 flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="w-10 h-10 text-[#FACC15] animate-spin" />
                  <h3 className="text-lg font-black text-white">
                    🎧 Sélection d’un hit mystère sur iTunes…
                  </h3>
                  <p className="text-xs text-white/70">
                    Pop, Rap, Raï, Oriental ou Classiques — prépare ton buzzer !
                  </p>
                </div>
              ) : (
                <>
                  {soloNotice && (
                    <div className="shrink-0 px-3 py-1.5 rounded-xl bg-[#FACC15]/15 border border-[#FACC15]/40 text-xs font-bold text-[#FACC15] text-center">
                      {soloNotice}
                    </div>
                  )}
                  <JamBlindTestStage
                    state={state}
                    isDj={isLocalPerformer}
                    isSolo={isSolo}
                    isPlayingAudio={isBlindAudioPlaying}
                    audioAutoplayBlocked={audioAutoplayBlocked}
                    cameraAirPlayEnabled={cameraAirPlayEnabled}
                    onUnlockAudio={unlockAllAudio}
                    onPrivatePreviewToggle={handlePrivatePreviewToggle}
                    privatePreviewTrackId={privatePreviewTrackId}
                    onLaunchBlindTrack={(track) =>
                      dispatchAction({
                        type: 'JAM_ACTION',
                        action: 'PREP_LAUNCH_BLINDTEST',
                        blindTrack: track,
                      })
                    }
                    onSubmitGuess={(text) =>
                      dispatchAction({ type: 'JAM_ACTION', action: 'GUESS', text })
                    }
                    onTriggerBuzzer={() =>
                      dispatchAction({ type: 'JAM_ACTION', action: 'BUZZER' })
                    }
                    onUseHintArtist={() =>
                      dispatchAction({ type: 'JAM_ACTION', action: 'HINT_ARTIST' })
                    }
                    onUseHintUnblur={() =>
                      dispatchAction({ type: 'JAM_ACTION', action: 'HINT_UNBLUR' })
                    }
                    onDjTogglePause={() =>
                      dispatchAction({ type: 'JAM_ACTION', action: 'TOGGLE_PAUSE' })
                    }
                    onDjMarkCorrect={() =>
                      dispatchAction({ type: 'JAM_ACTION', action: 'FOUND_ORAL' })
                    }
                    onDjRevealNow={() =>
                      dispatchAction({ type: 'JAM_ACTION', action: 'REVEAL_NOW' })
                    }
                    onNextRound={() =>
                      dispatchAction({ type: 'JAM_ACTION', action: 'NEXT_ROUND' })
                    }
                  />
                </>
              )}
            </div>
          )}

        {/* ======================== MODE 3 : CONCERT DUO (JAM LIBRE) ======================== */}
        {state.phase === 'PLAYING' && state.mode === 'concert-duo' && (
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
            {/* Instrument Switcher + Metronome Strip */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                {INSTRUMENT_TABS.map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    data-concert-inst={inst.id}
                    onClick={() => handleInstrumentSwitch(inst.id)}
                    className={`flex-1 min-h-[40px] px-2 rounded-xl border text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 ${
                      concertInstrument === inst.id
                        ? 'bg-gradient-to-r from-[#7C3AED] to-[#FF4D8D] border-[#FACC15] text-white shadow-md'
                        : 'bg-white/8 border-white/15 text-white/85 hover:bg-white/16'
                    }`}
                  >
                    <span>{inst.icon}</span>
                    <span className="hidden xs:inline sm:inline truncate">{inst.label}</span>
                  </button>
                ))}
              </div>

              {/* Adjustable Metronome (Off / 90 / 110 / 130 BPM) */}
              <div className="flex items-center gap-1 bg-[#140E2E]/90 border border-white/15 rounded-xl p-1 shrink-0">
                <Radio
                  className={`w-3.5 h-3.5 ms-1 ${
                    metronomeBpm > 0 && metronomeBeat === 1
                      ? 'text-[#FACC15] scale-125'
                      : 'text-white/60'
                  } transition-transform`}
                />
                {METRONOME_OPTIONS.map((bpm) => (
                  <button
                    key={bpm}
                    type="button"
                    onClick={() => {
                      unlockAllAudio();
                      setMetronomeBpm(bpm);
                    }}
                    className={`min-h-[30px] px-2 rounded-lg text-[11px] font-black tabular-nums transition-all ${
                      metronomeBpm === bpm
                        ? 'bg-[#FACC15] text-[#140E2E]'
                        : 'text-white/80 hover:bg-white/12'
                    }`}
                  >
                    {bpm === 0 ? 'Off' : `${bpm}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Full Interactive Shared Stage */}
            <div className="flex-1 min-h-0">
              <JamInstrumentStage
                instrument={concertInstrument}
                interactive
                lastPulse={lastPulse}
                handCursors={handCursors}
                onTriggerNote={handleLocalInstrumentNote}
              />
            </div>

            {/* Concert Ambiance Emotes Bar */}
            <div className="shrink-0 flex items-center justify-center gap-2">
              {CONCERT_EMOTES.map((em) => (
                <button
                  key={em.kind}
                  type="button"
                  onClick={() =>
                    dispatchAction({ type: 'JAM_ACTION', action: 'EMOTE', emote: em.kind })
                  }
                  className="min-h-[42px] flex-1 max-w-[160px] px-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20 active:scale-95 text-xs sm:text-sm font-black text-white transition-all"
                >
                  {em.emoji} {em.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ======================== MATCH OVER LEADERBOARD ======================== */}
        {state.phase === 'MATCH_OVER' && (
          <div
            data-testid="jam-match-over"
            className="relative flex-1 min-h-0 rounded-3xl border border-[#FACC15]/55 bg-[#150E32]/95 p-5 flex flex-col items-center justify-center text-center gap-4 overflow-hidden"
          >
            {/* Confetti dots */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              {CONFETTI_COLORS.map((c, idx) => (
                <span
                  key={c}
                  style={{
                    backgroundColor: c,
                    left: `${12 + idx * 15}%`,
                    top: `${10 + (idx % 3) * 14}%`,
                  }}
                  className="absolute w-3 h-3 rounded-full opacity-75 animate-bounce"
                />
              ))}
            </div>

            <Crown className="w-12 h-12 text-[#FACC15]" />
            <div className="space-y-1">
              <p className="text-xs font-black text-[#22D3EE]">Meilleur Mélomane du Couple</p>
              <h2 className="text-2xl sm:text-3xl font-black text-white">{winnerName}</h2>
            </div>

            <div className="w-full max-w-sm grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/8 border border-[#FF4D8D]/45 p-3">
                <p className="text-xs font-bold text-white/75 truncate">{hostName}</p>
                <p className="text-2xl font-black text-[#FF4D8D] tabular-nums">
                  {state.scores.host} pts
                </p>
              </div>
              <div className="rounded-2xl bg-white/8 border border-[#22D3EE]/45 p-3">
                <p className="text-xs font-bold text-white/75 truncate">{guestName}</p>
                <p className="text-2xl font-black text-[#22D3EE] tabular-nums">
                  {state.scores.guest} pts
                </p>
              </div>
            </div>

            <div className="w-full max-w-md rounded-2xl bg-[#FF4D8D]/18 border border-[#FF4D8D]/50 px-4 py-3 text-xs sm:text-sm font-bold text-white">
              <Flame className="w-4 h-4 inline text-[#FACC15] me-1" />
              Gage final du perdant : {state.finalDareText}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                data-testid="jam-replay-btn"
                onClick={handleReturnToLobby}
                className="min-h-[46px] px-5 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#FF4D8D] to-[#FACC15] text-white font-black text-sm inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Rejouer</span>
              </button>
              <button
                type="button"
                onClick={onReturnToHub}
                className="min-h-[46px] px-5 rounded-2xl bg-white/12 border border-white/25 text-white font-extrabold text-sm hover:bg-white/20"
              >
                ← Changer de jeu
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
