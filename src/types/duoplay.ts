export type Language = 'fr' | 'en' | 'ar';
export type ActiveGame = 'parcheesi' | null;
export type ScreenView = 'lobby' | 'room-menu' | 'parcheesi';
export type ConnectionMode = 'idle' | 'p2p-host' | 'p2p-guest' | 'solo';
export type ConnectionStatus = 'disconnected' | 'creating' | 'waiting' | 'connecting' | 'connected' | 'error';
export type RoomRole = 'host' | 'guest';
export type QuickReactionEmoji = '❤️' | '😂' | '🔥';
export type MicAccessStatus = 'idle' | 'granted' | 'denied' | 'unavailable';

export interface RoomChatMessage {
  id: string;
  sender: RoomRole;
  senderName: string;
  text: string;
  kind: 'text' | 'reaction';
  createdAtMs: number;
}

export interface FloatingQuickReaction {
  id: number;
  emoji: QuickReactionEmoji;
  senderName: string;
  offsetX: number;
}

export type PeerMessage =
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
      type: 'PARCHISI_SYNC_REQ';
    };

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
  /** Step-by-step progress values for smooth tile hop animation */
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
