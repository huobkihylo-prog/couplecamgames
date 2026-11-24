export type Language = 'fr' | 'en' | 'ar';
export type GameId =
  | 'laugh'
  | 'funambules'
  | 'ninja-fruits'
  | 'air-hockey'
  | 'stare-duel'
  | 'miam-mania'
  | 'kiss-bounce'
  | 'constellations';
export type ScreenView = 'lobby' | 'hub' | GameId;
export type HubCategory = 'all' | 'drole' | 'action' | 'aventure' | 'romantique' | 'amusant';
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

export type PeerMessage =
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
    };
