export type Language = 'fr' | 'en' | 'ar';
export type GameId =
  | 'laugh'
  | 'funambules'
  | 'ninja-fruits'
  | 'air-hockey'
  | 'stare-duel'
  | 'miam-mania'
  | 'whisper-secrets'
  | 'slingshot-duo'
  | 'xo-neon'
  | 'parchisi-duo'
  | 'music-quiz'
  | 'freeze-dance';
export type ScreenView = 'lobby' | 'hub' | GameId;
export type HubCategory =
  | 'all'
  | 'sensuel'
  | 'drole'
  | 'action'
  | 'aventure'
  | 'romantique'
  | 'amusant'
  | 'musique';
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
  /** Raw MediaPipe landmark anchor snapshot for Freeze Dance motion tracking */
  faceAnchor?: FreezeLandmarkAnchor | null;
  /** Timestamp (ms) of measurement */
  timestamp: number;
}

export interface FreezeLandmarkAnchor {
  noseX: number;
  noseY: number;
  leftEyeX: number;
  leftEyeY: number;
  rightEyeX: number;
  rightEyeY: number;
  chinX: number;
  chinY: number;
  headTiltRad: number;
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


export type WhisperLevel = 'doux' | 'seduction' | 'intense';
export type WhisperRole = 'whisperer' | 'guesser';
export type WhisperStage = 'writing' | 'whispering' | 'revealed';

export type PeerMessage =
  | { type: 'JOIN_HELLO'; code: string; name: string; hasStream?: boolean; peerId?: string }
  | { type: 'JOIN_WELCOME'; code: string; hostName: string; hasStream?: boolean; peerId?: string }
  | { type: 'JOIN_REQUEST'; code: string; name: string; hasStream?: boolean; peerId?: string }
  | {
      type: 'JOIN_ACCEPTED';
      code: string;
      hostName: string;
      currentGame?: ScreenView;
      scores?: Record<string, number>;
      hasStream?: boolean;
      peerId?: string;
    }
  | { type: 'JOIN_CONFIRMED'; code: string; hostName: string; hasStream?: boolean; peerId?: string }
  | { type: 'HELLO'; name: string; role: 'host' | 'guest'; hasStream?: boolean; peerId?: string }
  | { type: 'PING'; ts: number }
  | { type: 'PONG'; ts: number }
  | { type: 'SELECT_GAME'; game: GameId }
  | { type: 'RETURN_HUB' }
  | { type: 'HUB_REACTION'; emoji: '❤️' | '😂' | '🔥' }
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
      game: 'ninja-fruits' | 'air-hockey';
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
  | { type: 'PARCHISI_CONFIG'; mode: ParchisiMode; diceCount: ParchisiDiceCount }
  | { type: 'PARCHISI_START'; mode: ParchisiMode; diceCount?: ParchisiDiceCount }
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
      type: 'MUSIC_QUIZ_CONFIG';
      category: MusicQuizCategory;
      totalRounds: MusicQuizDuration;
    }
  | {
      type: 'MUSIC_QUIZ_ROUND';
      round: number;
      totalRounds: number;
      previewUrl: string;
      artworkUrl: string;
      options: MusicQuizOption[];
      correctIndex: number;
      startTime: number;
    }
  | {
      type: 'MUSIC_QUIZ_ANSWER';
      round: number;
      optionIndex: number;
      elapsedSec: number;
    }
  | {
      type: 'MUSIC_QUIZ_REVEAL';
      round: number;
      hostScore: number;
      guestScore: number;
      hostDelta: number;
      guestDelta: number;
      hostAnswerIndex: number | null;
      guestAnswerIndex: number | null;
      fastestPlayer: MusicQuizPlayer | null;
    }
  | {
      type: 'MUSIC_QUIZ_FINISH';
      hostScore: number;
      guestScore: number;
    }
  | { type: 'MUSIC_QUIZ_RESET' }
  | {
      type: 'FREEZE_STATE';
      state: FreezeDanceState;
    }
  | {
      type: 'FREEZE_PLAY';
      round: number;
      previewUrl: string;
      artworkUrl: string;
      title: string;
      artist: string;
      startTime: number;
    }
  | {
      type: 'FREEZE_STOP';
      round: number;
      freezeDurationMs: number;
    }
  | {
      type: 'FREEZE_VERDICT';
      round: number;
      verdict: FreezeDanceVerdict;
    }
  | {
      type: 'FREEZE_STABILITY';
      round: number;
      stability: number;
      status: 'grace' | 'tracking' | 'caught' | 'no-cam';
    }
  | {
      type: 'FREEZE_AUTO_CAUGHT';
      round: number;
      player: 'host' | 'guest';
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
export type ParchisiDiceCount = 1 | 2;
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
  fromProgress: number;
  path: number[];
  captured: { color: ParchisiColor; tokenId: number; fromProgress: number }[];
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
  /** Number of dice in play: 1 (single-die Parcheesi) or 2 (classic 2-dice Parcheesi) */
  diceCount: ParchisiDiceCount;
  activeColors: ParchisiColor[];
  turn: ParchisiColor;
  /** Rolled 6-sided dice values: [val] in 1-die mode or [val1, val2] in 2-dice mode */
  dice: number[] | null;
  /** Tracks which dice have been spent this turn */
  usedDice: boolean[];
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

export type MusicQuizCategory = 'all-hits' | 'pop-intl' | 'rai-chaabi' | 'rap' | 'movies-disney';
export type MusicQuizDuration = 5 | 10 | 15;
export type MusicQuizPlayer = 'host' | 'guest';
export type MusicQuizPhase = 'LOBBY' | 'LOADING' | 'PLAYING' | 'REVEAL' | 'PODIUM';

export interface MusicQuizOption {
  title: string;
  artist: string;
}

export interface MusicQuizRoundPayload {
  round: number;
  totalRounds: number;
  previewUrl: string;
  artworkUrl: string;
  options: MusicQuizOption[];
  correctIndex: number;
  startTime: number;
}

export type FreezeDanceVibe = 'party-pop' | 'chaabi-rai' | 'reggaeton-latino' | 'disco-funk';
export type FreezeDanceFormat = 'lives-3' | 'rounds-5';
export type FreezeDancePhase = 'LOBBY' | 'LOADING' | 'DANCING' | 'FREEZE' | 'VERDICT' | 'GAME_OVER';
export type FreezeDanceVerdict = 'moved' | 'statue';

export interface FreezeDanceState {
  phase: FreezeDancePhase;
  vibe: FreezeDanceVibe;
  format: FreezeDanceFormat;
  round: number;
  maxRounds: number;
  hostLives: number;
  guestLives: number;
  hostPoints: number;
  guestPoints: number;
  currentTrackTitle: string;
  currentTrackArtist: string;
  currentPreviewUrl: string;
  currentArtworkUrl: string;
  danceDurationMs: number;
  phaseStartedAt: number;
  hostVoteOnGuest: FreezeDanceVerdict | null;
  guestVoteOnHost: FreezeDanceVerdict | null;
  activeDareText: string;
  lastVerdictSummary: string;
  winner: 'host' | 'guest' | 'draw' | null;
  stateSeq: number;
}
