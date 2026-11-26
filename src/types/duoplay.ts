export type Language = 'fr' | 'en' | 'ar';
export type GameId =
  | 'laugh'
  | 'funambules'
  | 'ninja-fruits'
  | 'air-hockey'
  | 'stare-duel'
  | 'miam-mania'
  | 'kiss-bounce'
  | 'constellations'
  | 'whisper-secrets'
  | 'slingshot-duo'
  | 'xo-neon'
  | 'parchisi-duo'
  | 'couple-jam';
export type ScreenView = 'lobby' | 'hub' | GameId;
export type HubCategory = 'all' | 'sensuel' | 'drole' | 'action' | 'aventure' | 'romantique' | 'amusant';
export type ConnectionMode = 'idle' | 'p2p-host' | 'p2p-guest' | 'solo';
export type ConnectionStatus = 'disconnected' | 'creating' | 'waiting' | 'connecting' | 'connected' | 'error';

export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'fallback';

export interface FaceMetrics {
  /** 0 to 100 calibrated smile / laugh intensity */
  smileScore: number;
  /** 0 to 100 expressive grimace intensity (cheeks, brows, mouth expressions) */
  grimaceScore: number;
  /** Raw jaw-open contribution 0..100 for big laughs */
  laughBurst: number;
  /** Head roll tilt in radians (negative = lean left, positive = lean right) */
  headTiltRad: number;
  /** Normalized horizontal nose offset (-1..1) */
  noseOffsetX: number;
  /** MediaPipe FaceLandmarker eyeBlinkLeft blendshape (0..1) */
  eyeBlinkLeft: number;
  /** MediaPipe FaceLandmarker eyeBlinkRight blendshape (0..1) */
  eyeBlinkRight: number;
  /** True when local eyes blinked past threshold */
  hasBlinked: boolean;
  /** MediaPipe FaceLandmarker jawOpen blendshape (0..1) */
  jawOpen: number;
  /** True when mouth is opened wide enough to catch food */
  mouthOpen: boolean;
  /** Mirrored normalized mouth X position (0..1) */
  mouthX: number;
  /** Normalized mouth Y position (0..1) */
  mouthY: number;
  /** MediaPipe FaceLandmarker mouthPucker blendshape (0..1) for kiss detection */
  mouthPucker: number;
  /** True when mouthPucker crosses kiss threshold */
  isKissing: boolean;
  /** Whether a face is currently detected in the camera feed */
  faceDetected: boolean;
  /** Timestamp (ms) of measurement */
  timestamp: number;
}

export interface HandMetrics {
  /** Landmark 8 (index fingertip) in mirrored normalized 0..1 coords */
  indexX: number;
  indexY: number;
  /** Landmark 9 (palm center / middle MCP) in mirrored normalized 0..1 coords */
  palmX: number;
  palmY: number;
  /** Anti-tremble (lerp 0.35) mirrored midpoint between thumb (4) and index (8) */
  pinchX: number;
  pinchY: number;
  /** Anti-tremble (lerp 0.35) mirrored landmark 8 (index fingertip) */
  smoothIndexX: number;
  smoothIndexY: number;
  /** Normalized pinch ratio: distance(4,8) / distance(0,9) */
  pinchRatio: number;
  /** Hysteresis pinch flag: engages < 0.38, releases > 0.55 */
  isPinching: boolean;
  /** Whether a hand is currently detected by HandLandmarker (or pointer fallback active) */
  handDetected: boolean;
  /** Timestamp (ms) */
  timestamp: number;
}

export type LaughSensitivity = 'facile' | 'normal' | 'implacable';

export interface LaughPrompt {
  id: string;
  category: 'Grimace' | 'Impro' | 'Complicité' | 'Absurde';
  text: string;
}

export interface LaughRoundRecord {
  round: number;
  winner: 'local' | 'partner' | 'draw';
  durationSec: number;
  crackedBy: string;
}

export interface LaughGameState {
  phase: 'ready' | 'countdown' | 'playing' | 'round_over' | 'match_over';
  round: number;
  targetWins: number;
  localScore: number;
  partnerScore: number;
  countdownSec: number;
  elapsedSec: number;
  localCrackHoldSec: number;
  partnerCrackHoldSec: number;
  sensitivity: LaughSensitivity;
  currentPrompt: LaughPrompt;
  lastWinner: 'local' | 'partner' | 'draw' | null;
  lastCrackedReason: string;
  history: LaughRoundRecord[];
}

export type HazardKind = 'none' | 'gust' | 'pigeon' | 'whirlwind';

export interface ActiveHazard {
  kind: HazardKind;
  /** -1 for left push, +1 for right push */
  direction: -1 | 1;
  /** 0..1 telegraph progress before active hit, then stays 1 while active */
  phase: 'telegraph' | 'active';
  timer: number;
  telegraphDuration: number;
  activeDuration: number;
  strength: number;
  label: string;
}

export interface FunambulesState {
  phase: 'ready' | 'playing' | 'paused' | 'falling' | 'gameover' | 'victory';
  /** Tilt angle in degrees (-55..+55). Beyond ±52 triggers a fall. */
  angleDeg: number;
  /** Angular velocity in deg/s */
  angularVelDeg: number;
  /** Current distance walked in meters (goal: 100m) */
  distanceM: number;
  targetDistanceM: number;
  /** Elapsed play time in seconds */
  elapsedSec: number;
  /** Current cooperative sync streak in seconds */
  syncStreakSec: number;
  /** Max sync streak achieved */
  bestSyncStreakSec: number;
  /** Total harmony points */
  harmonyScore: number;
  /** Best distance ever reached in session */
  bestDistanceM: number;
  /** Current effective wind torque (-1..+1 display scale) */
  windForce: number;
  /** Next hazard cooldown in seconds */
  nextHazardIn: number;
  /** Active wind/pigeon/whirlwind event */
  hazard: ActiveHazard | null;
  /** Recent synchronized tilts flag */
  isSynced: boolean;
  /** Hitstop freeze countdown */
  hitstopSec: number;
  /** Screen shake trauma (0..1) */
  trauma: number;
  /** Fall animation timer (0..0.6s) */
  fallTimerSec: number;
  /** Direction of fall (-1 left, +1 right) */
  fallDirection: -1 | 1;
  /** Latest normalized inputs for HUD display (-1..+1) */
  p1Input: number;
  p2Input: number;
}

export type NinjaFruitKind = 'watermelon' | 'mango' | 'pomegranate' | 'kiwi' | 'orange' | 'giant' | 'bomb';

export interface NinjaFruitItem {
  id: number;
  kind: NinjaFruitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  vRot: number;
  sliced: boolean;
  slicedTimer: number;
  sliceAngle: number;
  /** For Giant Fruits requiring simultaneous / dual cuts */
  hitByP1At: number | null;
  hitByP2At: number | null;
}

export interface NinjaFruitsState {
  phase: 'ready' | 'playing' | 'paused' | 'gameover';
  score: number;
  bestScore: number;
  lives: number;
  maxLives: number;
  combo: number;
  maxCombo: number;
  comboTimerSec: number;
  multiplier: number;
  slicedCount: number;
  giantSlicedCount: number;
  elapsedSec: number;
  spawnTimerSec: number;
  nextId: number;
  items: NinjaFruitItem[];
  hitstopSec: number;
  trauma: number;
  flashColor: 'none' | 'bomb' | 'giant';
  flashTimerSec: number;
  lastCallout: string;
  calloutTimerSec: number;
}

export interface AirHockeyState {
  phase: 'ready' | 'playing' | 'paused' | 'goal_pause' | 'gameover';
  /** Puck coordinates in 1000x600 arena */
  puckX: number;
  puckY: number;
  puckVx: number;
  puckVy: number;
  /** Left paddle (Host / Local in Solo) */
  p1X: number;
  p1Y: number;
  p1Vx: number;
  p1Vy: number;
  /** Right paddle (Guest / AI Partner in Solo) */
  p2X: number;
  p2Y: number;
  p2Vx: number;
  p2Vy: number;
  p1Score: number;
  p2Score: number;
  targetGoals: number;
  lastScorer: 'p1' | 'p2' | null;
  winner: 'p1' | 'p2' | null;
  goalPauseSec: number;
  elapsedSec: number;
  rallyHits: number;
  maxPuckSpeed: number;
  hitstopSec: number;
  trauma: number;
  lastImpactX: number;
  lastImpactY: number;
  lastImpactStrength: number;
}

export type StareTrapKind = 'fly' | 'flash';

export interface StareDuelState {
  phase: 'ready' | 'countdown' | 'playing' | 'round_over' | 'match_over';
  round: number;
  targetWins: number;
  localScore: number;
  partnerScore: number;
  countdownSec: number;
  elapsedSec: number;
  bestStareSec: number;
  nextAutoTrapSec: number;
  activeTrap: StareTrapKind | null;
  activeTrapTimerSec: number;
  distractionCooldownSec: number;
  lastWinner: 'local' | 'partner' | 'draw' | null;
  lastRoundDurationSec: number;
}

export type MiamMode = 'duel' | 'coop';
export type MiamItemKind = 'strawberry' | 'pizza' | 'heart' | 'chili' | 'sock';

export interface MiamFoodItem {
  id: number;
  kind: MiamItemKind;
  isTrap: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  vRot: number;
}

export interface MiamManiaState {
  phase: 'ready' | 'playing' | 'paused' | 'gameover';
  mode: MiamMode;
  score: number;
  bestScore: number;
  lives: number;
  maxLives: number;
  caughtCount: number;
  streak: number;
  elapsedSec: number;
  spawnTimerSec: number;
  nextId: number;
  items: MiamFoodItem[];
  trauma: number;
  flashKind: 'none' | 'bonus' | 'trap';
  flashTimerSec: number;
}

export interface KissHeart {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Target side receiving this heart: 'local' (left) or 'partner' (right) */
  target: 'local' | 'partner';
  /** Visual radius */
  radius: number;
  /** Smooth arc pulse phase */
  pulse: number;
  /** Color theme based on sender */
  from: 'local' | 'partner';
}

export interface KissBounceState {
  phase: 'ready' | 'playing' | 'paused';
  rally: number;
  bestRally: number;
  totalKisses: number;
  /** 0..1 aurora borealis sky illumination driven by successful exchanges */
  auroraLevel: number;
  /** Current note step on the romantic piano progression */
  pianoStep: number;
  elapsedSec: number;
  localKissCooldownSec: number;
  hearts: KissHeart[];
  nextHeartId: number;
  lastCatchKind: 'none' | 'hand' | 'kiss';
  lastCatchTimerSec: number;
}

export type ConstellationShapeId = 'heart' | 'moon' | 'infinity' | 'twins';

export interface ConstellationStar {
  id: number;
  /** Normalized 0..1 coordinates inside the night sky canvas */
  x: number;
  y: number;
}

export interface ConstellationPattern {
  id: ConstellationShapeId;
  stars: ConstellationStar[];
  /** Pairs of star IDs connected when both are lit */
  edges: [number, number][];
}

export interface ConstellationState {
  phase: 'ready' | 'playing' | 'revealed';
  constellationIndex: number;
  activatedStarIds: number[];
  completedCount: number;
  activePromptIndex: number;
  /** Progress 0..1 while both fingertips hold together on the next numbered star */
  starHoldProgress: number;
  elapsedSec: number;
}

export type WhisperLevel = 'doux' | 'seduction' | 'intense';
export type WhisperRole = 'whisperer' | 'guesser';
export type WhisperStage = 'writing' | 'whispering' | 'revealed';

export type PeerMessage =
  | { type: 'JOIN_HELLO'; code: string; name: string; hasStream?: boolean }
  | { type: 'JOIN_WELCOME'; code: string; hostName: string; hasStream?: boolean }
  | { type: 'JOIN_REQUEST'; code: string; name: string; hasStream?: boolean }
  | { type: 'JOIN_CONFIRMED'; code: string; hostName: string; hasStream?: boolean }
  | { type: 'HELLO'; name: string; role: 'host' | 'guest'; hasStream?: boolean }
  | { type: 'PING'; ts: number }
  | { type: 'PONG'; ts: number }
  | { type: 'SELECT_GAME'; game: GameId }
  | { type: 'RETURN_HUB' }
  | {
      type: 'FACE_FRAME';
      smileScore: number;
      grimaceScore?: number;
      headTiltRad: number;
      mouthPucker?: number;
      faceDetected: boolean;
      ts: number;
    }
  | {
      type: 'HAND_FRAME';
      game: 'ninja-fruits' | 'air-hockey' | 'kiss-bounce' | 'constellations';
      x: number;
      y: number;
      detected: boolean;
      ts: number;
    }
  | { type: 'LAUGH_START_ROUND'; promptId: string; sensitivity: LaughSensitivity; round: number }
  | { type: 'LAUGH_CHANGE_PROMPT'; promptId: string }
  | { type: 'LAUGH_SET_SENSITIVITY'; sensitivity: LaughSensitivity }
  | { type: 'LAUGH_CRACKED'; elapsedSec: number }
  | { type: 'LAUGH_RESET_MATCH' }
  | { type: 'FUNAMBULES_START' }
  | { type: 'FUNAMBULES_PAUSE'; paused: boolean }
  | {
      type: 'FUNAMBULES_SYNC';
      angleDeg: number;
      angularVelDeg: number;
      distanceM: number;
      elapsedSec: number;
      harmonyScore: number;
      windForce: number;
      phase: FunambulesState['phase'];
      hazard: ActiveHazard | null;
      isSynced: boolean;
    }
  | { type: 'NINJA_START' }
  | { type: 'NINJA_PAUSE'; paused: boolean }
  | {
      type: 'NINJA_SYNC';
      phase: NinjaFruitsState['phase'];
      score: number;
      bestScore: number;
      lives: number;
      combo: number;
      maxCombo: number;
      multiplier: number;
      slicedCount: number;
      giantSlicedCount: number;
      elapsedSec: number;
      items: NinjaFruitItem[];
      flashColor: NinjaFruitsState['flashColor'];
      lastCallout: string;
    }
  | { type: 'HOCKEY_START' }
  | { type: 'HOCKEY_PAUSE'; paused: boolean }
  | {
      type: 'HOCKEY_SYNC';
      phase: AirHockeyState['phase'];
      puckX: number;
      puckY: number;
      puckVx: number;
      puckVy: number;
      p1X: number;
      p1Y: number;
      p2X: number;
      p2Y: number;
      p1Score: number;
      p2Score: number;
      lastScorer: AirHockeyState['lastScorer'];
      winner: AirHockeyState['winner'];
      goalPauseSec: number;
      elapsedSec: number;
      rallyHits: number;
      maxPuckSpeed: number;
    }
  | { type: 'STARE_START' }
  | { type: 'STARE_RESET' }
  | { type: 'STARE_BLINK'; hasBlinked: boolean; elapsedSec?: number }
  | { type: 'STARE_DISTRACTION'; kind: StareTrapKind }
  | { type: 'MIAM_START'; mode: MiamMode }
  | { type: 'MIAM_SET_MODE'; mode: MiamMode }
  | {
      type: 'MIAM_SYNC';
      score: number;
      lives: number;
      mouthOpen: boolean;
      mouthX?: number;
      mouthY?: number;
      phase?: MiamManiaState['phase'];
    }
  | { type: 'KISS_START' }
  | { type: 'KISS_RESET' }
  | {
      type: 'SEND_KISS';
      heartId: number;
      startY: number;
      vx: number;
      vy: number;
      rally: number;
      catchKind: 'hand' | 'kiss';
    }
  | { type: 'CONSTELLATION_START' }
  | {
      type: 'CONSTELLATION_STAR';
      constellationIndex: number;
      starId: number;
      x: number;
      y: number;
    }
  | {
      type: 'CONSTELLATION_NEXT';
      constellationIndex: number;
      promptIndex: number;
    }
  | {
      type: 'WHISPER_START';
      secretText: string;
      showHint: boolean;
      duration: number;
      level: WhisperLevel;
      round: number;
    }
  | {
      type: 'WHISPER_LIP_POS';
      x: number;
      y: number;
      ts: number;
    }
  | {
      type: 'WHISPER_VALIDATED';
      by: 'kiss' | 'button' | 'guess_match';
      bonusPts: number;
      secretText: string;
    }
  | {
      type: 'WHISPER_VERDICT';
      guessed: boolean;
      dareText?: string;
      pointsAwarded: number;
      heatOutcome: 'early_bonus' | 'guessed' | 'dare';
    }
  | {
      type: 'WHISPER_NEXT_ROUND';
      nextRound: number;
      nextWhispererIsHost: boolean;
    }
  | { type: 'SLING_START'; mode: SlingshotMode }
  | { type: 'SLING_PAUSE'; paused: boolean }
  | { type: 'SLING_PULL'; isPulling: boolean; pullX: number; pullY: number }
  | { type: 'SLING_FIRE'; vx: number; vy: number }
  | {
      type: 'SLING_STATE';
      phase: SlingshotDuoState['phase'];
      mode: SlingshotMode;
      timeLeftSec: number;
      hostScore: number;
      guestScore: number;
      coopScore: number;
      hostReloadSec: number;
      guestReloadSec: number;
      hostStunSec: number;
      guestStunSec: number;
      hostPull: SlingshotPullState;
      guestPull: SlingshotPullState;
      projectiles: SlingshotProjectile[];
      targets: SlingshotTarget[];
      lastCallout: string;
      flashKind: SlingshotDuoState['flashKind'];
    }
  | { type: 'XO_START'; variant: XoVariant; symbolTheme: XoSymbolTheme; targetWins: number }
  | { type: 'XO_CURSOR'; x: number; y: number; active: boolean }
  | { type: 'XO_MOVE'; cellIndex: number }
  | {
      type: 'XO_STATE';
      phase: XoNeonState['phase'];
      variant: XoVariant;
      symbolTheme: XoSymbolTheme;
      board: XoMark[];
      hostQueue: number[];
      guestQueue: number[];
      turn: 'host' | 'guest';
      turnTimeLeftSec: number;
      round: number;
      targetWins: number;
      hostWins: number;
      guestWins: number;
      winLine: number[] | null;
      roundWinner: 'host' | 'guest' | 'draw' | null;
      matchWinner: 'host' | 'guest' | null;
      dareIndex: number;
      lastPlacedCell: number | null;
      moveSeq: number;
    }
  | { type: 'XO_REMATCH' }
  | { type: 'PARCHISI_START'; mode: ParchisiMode }
  | {
      type: 'PARCHISI_ACTION';
      action: 'ROLL' | 'MOVE_TOKEN' | 'EMOJI' | 'QUICK_CHAT';
      tokenId?: number;
      moveOptionId?: string;
      emoji?: string;
      chatText?: string;
    }
  | {
      type: 'PARCHISI_STATE';
      state: ParchisiState;
    }
  | {
      type: 'JAM_NOTE';
      instrument: JamInstrumentId;
      noteId: string;
      player: JamPlayer;
    }
  | {
      type: 'BLINDTEST_START';
      source: JamBlindSource;
      previewUrl?: string;
      artworkUrl?: string;
      trackName: string;
      artistName: string;
      playbackRate: JamPlaybackRate;
      duration: number;
    }
  | {
      type: 'JAM_STATE';
      state: JamState;
    }
  | {
      type: 'JAM_ACTION';
      action:
        | 'PREP_LAUNCH_INSTRUMENT'
        | 'PREP_LAUNCH_BLINDTEST'
        | 'GUESS'
        | 'BUZZER'
        | 'HINT_ARTIST'
        | 'HINT_UNBLUR'
        | 'HINT_CATEGORY'
        | 'FOUND_ORAL'
        | 'REVEAL_NOW'
        | 'TOGGLE_PAUSE'
        | 'NEXT_ROUND'
        | 'EMOTE'
        | 'SET_INSTRUMENT';
      text?: string;
      emote?: JamEmoteKind;
      instrument?: JamInstrumentId;
      songId?: string;
      songTitle?: string;
      songArtist?: string;
      songCategory?: string;
      antiCheat?: boolean;
      blindTrack?: JamBlindTrack;
    };

export type SlingshotMode = 'coop' | 'duel';
export type SlingshotTargetKind =
  | 'classic-pink'
  | 'classic-cyan'
  | 'classic-violet'
  | 'fusion'
  | 'explosive'
  | 'heart'
  | 'bomb';

export interface SlingshotPullState {
  isPulling: boolean;
  /** Pull displacement relative to anchor (px, clamped <= 140) */
  pullX: number;
  pullY: number;
}

export interface SlingshotProjectile {
  id: number;
  owner: 'host' | 'guest';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bounces: number;
  maxBounces: number;
  alive: boolean;
  trail: { x: number; y: number }[];
}

export interface SlingshotTarget {
  id: number;
  kind: SlingshotTargetKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseY: number;
  bobPhase: number;
  radius: number;
  points: number;
  /** For Golden Fusion target: tracks which side already struck it */
  hitByHost: boolean;
  hitByGuest: boolean;
  fusionGlowSec: number;
  alive: boolean;
}

export interface SlingshotDuoState {
  phase: 'ready' | 'playing' | 'paused' | 'gameover';
  mode: SlingshotMode;
  durationSec: number;
  timeLeftSec: number;
  elapsedSec: number;
  hostScore: number;
  guestScore: number;
  coopScore: number;
  bestScore: number;
  hostReloadSec: number;
  guestReloadSec: number;
  hostStunSec: number;
  guestStunSec: number;
  hostPull: SlingshotPullState;
  guestPull: SlingshotPullState;
  projectiles: SlingshotProjectile[];
  targets: SlingshotTarget[];
  nextId: number;
  spawnTimerSec: number;
  fusionRespawnSec: number;
  trickShots: number;
  fusionCount: number;
  hitstopSec: number;
  trauma: number;
  flashKind: 'none' | 'bomb' | 'fusion' | 'heart' | 'explosive';
  flashTimerSec: number;
  lastCallout: string;
  calloutTimerSec: number;
}

export type XoVariant = 'infinite' | 'classic';
export type XoSymbolTheme = 'xo' | 'hearts';
export type XoMark = 'host' | 'guest' | null;

export interface XoNeonState {
  phase: 'ready' | 'playing' | 'round_over' | 'match_over';
  variant: XoVariant;
  symbolTheme: XoSymbolTheme;
  board: XoMark[];
  /** FIFO placement order for Infinite Mode (max 3 pieces per player) */
  hostQueue: number[];
  guestQueue: number[];
  turn: 'host' | 'guest';
  turnDurationSec: number;
  turnTimeLeftSec: number;
  round: number;
  targetWins: number;
  hostWins: number;
  guestWins: number;
  winLine: number[] | null;
  roundWinner: 'host' | 'guest' | 'draw' | null;
  matchWinner: 'host' | 'guest' | null;
  dareIndex: number;
  lastPlacedCell: number | null;
  moveSeq: number;
}

export type ParchisiColor = 'red' | 'green' | 'yellow' | 'blue';
export type ParchisiPlayer = ParchisiColor;
export type ParchisiMode = '1v1' | '4p';
export type ParchisiPhase = 'READY' | 'WAIT_ROLL' | 'WAIT_MOVE' | 'GAME_OVER';
export type ParchisiBonusAmount = 20 | 10;

export interface ParchisiToken {
  /** 0..3 per color */
  id: number;
  color: ParchisiColor;
  /** -1 = in corner base, 0..63 = outer 68-tile track relative to Start, 64..70 = 7-tile colored home column, 71 = Center Triangle Goal */
  progress: number;
}

export interface ParchisiMoveOption {
  /** Stable identifier e.g. "t0:d0", "t0:d1", "t0:sum", "t0:exit-d0", "t0:exit-sum", "t0:bonus-20" */
  id: string;
  tokenId: number;
  color: ParchisiColor;
  fromProgress: number;
  toProgress: number;
  steps: number;
  /** Which dice indices (0, 1) are consumed by this move, empty for +20/+10 bonus */
  diceUsed: number[];
  /** Non-null when this move spends a pending +20 or +10 bonus */
  bonusUsed: ParchisiBonusAmount | null;
  /** Short pill label e.g. "+5", "+7", "Exit (5)", "+20", "+10" */
  label: string;
  /** Step-by-step progress values for smooth 105ms tile hop animation */
  path: number[];
  isExit: boolean;
  /** Opponent token(s) captured on landing (or intermediate tile during combined move) */
  captures: { color: ParchisiColor; tokenId: number; square: number }[];
  reachesHome: boolean;
  landsOnSafe: boolean;
  breaksBlockade: boolean;
}

export interface ParchisiMoveAnimation {
  seq: number;
  color: ParchisiColor;
  tokenId: number;
  path: number[];
  captured: { color: ParchisiColor; tokenId: number }[];
  reachedHome: boolean;
  landedSafe: boolean;
}

export interface ParchisiPlayerStats {
  captures: number;
  doublesRolled: number;
  homeEntries: number;
}

export interface ParchisiState {
  phase: ParchisiPhase;
  mode: ParchisiMode;
  activeColors: ParchisiColor[];
  turn: ParchisiColor;
  /** Two 6-sided dice values once rolled this turn */
  dice: [number, number] | null;
  /** Tracks which of the 2 dice have been spent */
  usedDice: [boolean, boolean];
  /** Pending +20 (capture) or +10 (center home) bonus moves to play immediately */
  pendingBonuses: ParchisiBonusAmount[];
  rollSeq: number;
  consecutiveDoubles: number;
  extraRollPending: boolean;
  /** True after rolling doubles while owning a blockade, until a blockade is broken */
  mustBreakBlockade: boolean;
  /** Last moved token per color (subject to 3-consecutive-doubles penalty if outside home column) */
  lastMovedTokenId: Record<ParchisiColor, number | null>;
  tokens: Record<ParchisiColor, ParchisiToken[]>;
  lastMoveAnim: ParchisiMoveAnimation | null;
  lastEventText: string;
  lastEventTone: 'neutral' | 'capture' | 'bonus' | 'safe' | 'warning' | 'win';
  winner: ParchisiColor | null;
  stats: Record<ParchisiColor, ParchisiPlayerStats>;
  turnStartedAt: number;
  stateSeq: number;
}

export type JamInstrumentId = 'darbouka' | 'guitar' | 'piano' | 'oud';
export type JamMode = 'guess-instrument' | 'blind-test' | 'concert-duo';
export type JamFormat = 5 | 10 | 0;
export type JamPlaybackRate = 0.8 | 1 | 1.35;
export type JamBlindSource = 'itunes' | 'free';
export type JamPlayer = 'host' | 'guest';
export type JamEmoteKind = 'bravo' | 'fuego' | 'encore';
export type JamPhase = 'LOBBY' | 'PREP' | 'PLAYING' | 'BUZZER' | 'REVEAL' | 'MATCH_OVER';

export interface JamBlindTrack {
  source: JamBlindSource;
  previewUrl?: string;
  artworkUrl?: string;
  trackName: string;
  artistName: string;
  playbackRate: JamPlaybackRate;
  duration: number;
}

export interface JamRoundOutcome {
  guessed: boolean;
  winner: JamPlayer | null;
  pointsAwarded: number;
  fastBonus: boolean;
  answerText?: string;
  dareText?: string;
  revealTitle: string;
  revealArtist?: string;
  revealArtworkUrl?: string;
}

export interface JamState {
  phase: JamPhase;
  mode: JamMode;
  /** 5, 10, or 0 for Free / unlimited */
  totalRounds: JamFormat;
  round: number;
  /** Who is the active Musician / DJ this round */
  performer: JamPlayer;
  /** Scores support .5 increments from -0.5 hint deductions */
  scores: Record<JamPlayer, number>;
  /** Current instrument per player (used in Mode 1 & Mode 3) */
  instruments: Record<JamPlayer, JamInstrumentId>;
  /** Mode 1 secret song metadata */
  secretSongId: string | null;
  secretTitle: string;
  secretArtist: string;
  secretCategory: string;
  antiCheatMute: boolean;
  /** Mode 2 blind test track */
  blindTrack: JamBlindTrack | null;
  /** Round countdown remaining (45s Mode 1, 30s Mode 2) */
  roundDurationSec: number;
  timeLeftSec: number;
  /** Paused by DJ or Buzzer */
  isPaused: boolean;
  buzzerLeftSec: number;
  buzzerBy: JamPlayer | null;
  /** Hints used in current round */
  hintCategoryUsed: boolean;
  hintArtistUsed: boolean;
  hintUnblurUsed: boolean;
  hintsCount: number;
  /** Last guess feedback */
  lastWrongGuess: string | null;
  /** Reveal outcome */
  outcome: JamRoundOutcome | null;
  /** Solo AI training flag */
  soloAiPerformer: boolean;
  /** Final match dare for loser */
  finalDareText: string;
  stateSeq: number;
}


