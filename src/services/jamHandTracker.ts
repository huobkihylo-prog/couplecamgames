import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { TrackerStatus } from '../types/duoplay';

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MEDIAPIPE_WASM_FALLBACK_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_land_marker/hand_land_marker/float16/1/hand_land_marker.task';

export const JAM_HAND_LERP = 0.4;

export interface JamHandPoint {
  /** 0 or 1 hand slot */
  id: number;
  /** Mirrored normalized X (0..1) with lerp = 0.4 */
  x: number;
  /** Normalized Y (0..1) with lerp = 0.4 */
  y: number;
  /** Previous Y to detect downward strike velocity */
  prevY: number;
  /** True when open palm is raised for Blind Test buzzer */
  isRaisedOpenPalm: boolean;
}

export interface JamDualHandFrame {
  hands: JamHandPoint[];
  anyRaisedOpenPalm: boolean;
  timestamp: number;
}

/**
 * Pure helper to determine if a 21-landmark MediaPipe hand is an open raised palm
 * (for Blind Test "raise open hand to BUZZ!" gesture).
 */
export function isOpenRaisedPalm(
  landmarks: readonly { x: number; y: number }[],
): boolean {
  if (landmarks.length < 21) return false;
  const wrist = landmarks[0];
  // Check fingertips (8, 12, 16, 20) are clearly above their MCP joints (5, 9, 13, 17)
  const indexOpen = landmarks[8].y < landmarks[6].y && landmarks[8].y < landmarks[5].y;
  const middleOpen = landmarks[12].y < landmarks[10].y && landmarks[12].y < landmarks[9].y;
  const ringOpen = landmarks[16].y < landmarks[14].y && landmarks[16].y < landmarks[13].y;
  const pinkyOpen = landmarks[20].y < landmarks[18].y && landmarks[20].y < landmarks[17].y;
  const openCount = [indexOpen, middleOpen, ringOpen, pinkyOpen].filter(Boolean).length;
  // Hand should be raised in upper/middle camera area
  const raisedEnough = wrist.y < 0.78 && landmarks[12].y < 0.56;
  return openCount >= 3 && raisedEnough;
}

/**
 * Dedicated lazy-loaded 2-hand MediaPipe HandLandmarker for Couple Jam:
 * - numHands: 2, runningMode: 'VIDEO', delegate: 'GPU' (with CPU fallback)
 * - Tracks both index fingertips (landmark 8) mirrored horizontally with lerp = 0.4
 * - Detects open raised palm for Blind Test buzzer
 * - Strictly disposed when leaving Couple Jam or toggling off camera air-play
 */
export class JamHandTracker {
  private landmarker: HandLandmarker | null = null;
  private vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
  private status: TrackerStatus = 'idle';
  private activeDelegate: 'GPU' | 'CPU' = 'GPU';
  private initPromise: Promise<TrackerStatus> | null = null;
  private switchingToCpu = false;
  private consecutiveErrors = 0;

  private lastVideoEl: HTMLVideoElement | null = null;
  private lastVideoTime = -1;
  private lastTimestampMs = 0;

  private smoothHands: { x: number; y: number; active: boolean }[] = [
    { x: 0.35, y: 0.5, active: false },
    { x: 0.65, y: 0.5, active: false },
  ];

  public getStatus(): TrackerStatus {
    return this.status;
  }

  private async createLandmarker(
    vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
    delegate: 'GPU' | 'CPU',
  ): Promise<HandLandmarker> {
    return HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_LANDMARKER_MODEL_URL,
        delegate,
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.45,
      minHandPresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
  }

  public async ensureInitialized(): Promise<TrackerStatus> {
    if (this.status === 'ready') return 'ready';
    if (this.initPromise) return this.initPromise;

    this.status = 'loading';
    this.initPromise = (async () => {
      try {
        let vision = this.vision;
        if (!vision) {
          try {
            vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
          } catch {
            vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_FALLBACK_URL);
          }
        }
        this.vision = vision;

        let landmarker: HandLandmarker;
        try {
          landmarker = await this.createLandmarker(vision, 'GPU');
          this.activeDelegate = 'GPU';
        } catch {
          landmarker = await this.createLandmarker(vision, 'CPU');
          this.activeDelegate = 'CPU';
        }

        this.landmarker = landmarker;
        this.consecutiveErrors = 0;
        this.status = 'ready';
        return 'ready' as TrackerStatus;
      } catch (err) {
        console.warn('[CoupleJam] HandLandmarker init failed, using touch/mouse controls:', err);
        this.status = 'fallback';
        return 'fallback' as TrackerStatus;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private async fallbackToCpuRuntime() {
    if (this.switchingToCpu || this.activeDelegate === 'CPU' || !this.vision) return;
    this.switchingToCpu = true;
    try {
      const prev = this.landmarker;
      this.landmarker = null;
      prev?.close();
      const cpuLandmarker = await this.createLandmarker(this.vision, 'CPU');
      this.landmarker = cpuLandmarker;
      this.activeDelegate = 'CPU';
      this.consecutiveErrors = 0;
      this.status = 'ready';
    } catch {
      this.status = 'fallback';
    } finally {
      this.switchingToCpu = false;
    }
  }

  public detectFrame(video: HTMLVideoElement | null, nowMs: number): JamDualHandFrame | null {
    if (
      !this.landmarker ||
      this.switchingToCpu ||
      !video ||
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      video.paused ||
      video.ended
    ) {
      return null;
    }

    if (this.lastVideoEl !== video) {
      this.lastVideoEl = video;
      this.lastVideoTime = -1;
    }

    if (video.currentTime === this.lastVideoTime && this.lastVideoTime > 0) {
      return null;
    }
    this.lastVideoTime = video.currentTime;

    const tsMs = Math.max(this.lastTimestampMs + 1, Math.floor(nowMs));
    this.lastTimestampMs = tsMs;

    try {
      const result = this.landmarker.detectForVideo(video, tsMs);
      this.consecutiveErrors = 0;
      const detectedList = result.landmarks ?? [];
      const points: JamHandPoint[] = [];
      let anyRaised = false;

      for (let i = 0; i < Math.min(2, detectedList.length); i += 1) {
        const hand = detectedList[i];
        if (!hand || hand.length < 9) continue;
        const indexTip = hand[8];
        const rawX = Math.max(0, Math.min(1, 1 - indexTip.x));
        const rawY = Math.max(0, Math.min(1, indexTip.y));

        const slot = this.smoothHands[i];
        const prevY = slot.active ? slot.y : rawY;
        if (!slot.active) {
          slot.x = rawX;
          slot.y = rawY;
          slot.active = true;
        } else {
          slot.x += (rawX - slot.x) * JAM_HAND_LERP;
          slot.y += (rawY - slot.y) * JAM_HAND_LERP;
        }

        const raised = isOpenRaisedPalm(hand);
        if (raised) anyRaised = true;

        points.push({
          id: i,
          x: slot.x,
          y: slot.y,
          prevY,
          isRaisedOpenPalm: raised,
        });
      }

      for (let i = detectedList.length; i < 2; i += 1) {
        this.smoothHands[i].active = false;
      }

      return {
        hands: points,
        anyRaisedOpenPalm: anyRaised,
        timestamp: tsMs,
      };
    } catch {
      this.consecutiveErrors += 1;
      if (this.consecutiveErrors === 3 && this.activeDelegate === 'GPU') {
        void this.fallbackToCpuRuntime();
      }
      return null;
    }
  }

  public dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.vision = null;
    this.status = 'idle';
    this.initPromise = null;
    this.lastVideoEl = null;
    this.lastVideoTime = -1;
    this.lastTimestampMs = 0;
    this.consecutiveErrors = 0;
    this.smoothHands = [
      { x: 0.35, y: 0.5, active: false },
      { x: 0.65, y: 0.5, active: false },
    ];
  }
}
