import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandMetrics, TrackerStatus } from '../types/duoplay';

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MEDIAPIPE_WASM_FALLBACK_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_land_marker/hand_land_marker/float16/1/hand_landmarker.task';

export const PINCH_ENGAGE_RATIO = 0.38;
export const PINCH_RELEASE_RATIO = 0.55;
export const PRECISION_LERP = 0.35;

export const EMPTY_HAND_METRICS: HandMetrics = {
  indexX: 0.5,
  indexY: 0.5,
  palmX: 0.5,
  palmY: 0.5,
  pinchX: 0.5,
  pinchY: 0.5,
  smoothIndexX: 0.5,
  smoothIndexY: 0.5,
  pinchRatio: 1,
  isPinching: false,
  handDetected: false,
  timestamp: 0,
};

export type HandDetectionResult =
  | { kind: 'frame'; metrics: HandMetrics }
  | { kind: 'same-frame' }
  | { kind: 'not-ready' };

/**
 * Pure pinch hysteresis helper:
 * Engages when ratio < 0.38, releases only when ratio > 0.55 (prevents jitter misfires).
 */
export function computePinchHysteresis(prevPinching: boolean, ratio: number): boolean {
  if (!Number.isFinite(ratio)) return false;
  if (prevPinching) {
    return ratio <= PINCH_RELEASE_RATIO;
  }
  return ratio < PINCH_ENGAGE_RATIO;
}

/**
 * Lazy-loaded MediaPipe HandLandmarker tracker providing:
 * - Landmark 8 (index fingertip) for "Ninja Fruits", "Constellations", and "X O Néon"
 * - Landmark 9 (middle finger MCP / palm center) for "Air Hockey" & "Kiss Bounce"
 * - Landmarks 4 & 8 pinch midpoint + normalized ratio(4,8)/distance(0,9) with hysteresis for "Slingshot Duo" & "X O Néon"
 *
 * Mirrored horizontally (1 - x) to match the natural front-camera self-view.
 */
export class DuoHandTracker {
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

  private smoothedIndexX = 0.5;
  private smoothedIndexY = 0.5;
  private smoothedPalmX = 0.5;
  private smoothedPalmY = 0.5;
  private precisionPinchX = 0.5;
  private precisionPinchY = 0.5;
  private precisionIndexX = 0.5;
  private precisionIndexY = 0.5;
  private lastPinchRatio = 1;
  private pinchingState = false;

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
      numHands: 1,
      minHandDetectionConfidence: 0.45,
      minHandPresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
  }

  public async ensureInitialized(forceRetry = false): Promise<TrackerStatus> {
    if (this.status === 'ready') return 'ready';
    if (this.status === 'fallback' && !forceRetry) return 'fallback';
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
        console.warn('[CoupleCam] HandLandmarker init failed, falling back to mouse/touch controls:', err);
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
    } catch (err) {
      console.warn('[CoupleCam] HandLandmarker CPU fallback failed:', err);
      this.status = 'fallback';
    } finally {
      this.switchingToCpu = false;
    }
  }

  public detectFrame(video: HTMLVideoElement | null, nowMs: number): HandDetectionResult {
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
      return { kind: 'not-ready' };
    }

    if (this.lastVideoEl !== video) {
      this.lastVideoEl = video;
      this.lastVideoTime = -1;
    }

    if (video.currentTime === this.lastVideoTime && this.lastVideoTime > 0) {
      return { kind: 'same-frame' };
    }
    this.lastVideoTime = video.currentTime;

    const tsMs = Math.max(this.lastTimestampMs + 1, Math.floor(nowMs));
    this.lastTimestampMs = tsMs;

    try {
      const result = this.landmarker.detectForVideo(video, tsMs);
      this.consecutiveErrors = 0;
      const hand = result.landmarks?.[0];

      if (!hand || hand.length < 10) {
        this.pinchingState = false;
        this.lastPinchRatio = 1;
        return {
          kind: 'frame',
          metrics: {
            indexX: this.smoothedIndexX,
            indexY: this.smoothedIndexY,
            palmX: this.smoothedPalmX,
            palmY: this.smoothedPalmY,
            pinchX: this.precisionPinchX,
            pinchY: this.precisionPinchY,
            smoothIndexX: this.precisionIndexX,
            smoothIndexY: this.precisionIndexY,
            pinchRatio: 1,
            isPinching: false,
            handDetected: false,
            timestamp: tsMs,
          },
        };
      }

      const wrist = hand[0];
      const thumbTip = hand[4];
      const indexTip = hand[8];
      const middleMcp = hand[9];

      // Mirror X (1 - x) so moving hand right moves cursor/blade/paddle right on screen
      const rawIndexX = Math.max(0, Math.min(1, 1 - indexTip.x));
      const rawIndexY = Math.max(0, Math.min(1, indexTip.y));
      const rawPalmX = Math.max(0, Math.min(1, 1 - middleMcp.x));
      const rawPalmY = Math.max(0, Math.min(1, middleMcp.y));

      // Midpoint between thumb tip (4) and index tip (8)
      const rawPinchX = Math.max(0, Math.min(1, 1 - (thumbTip.x + indexTip.x) * 0.5));
      const rawPinchY = Math.max(0, Math.min(1, (thumbTip.y + indexTip.y) * 0.5));

      // Normalized pinch ratio: distance(4, 8) / distance(wrist 0, middle MCP 9)
      const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      const handScale = Math.max(0.02, Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y));
      const pinchRatio = pinchDist / handScale;
      this.lastPinchRatio = pinchRatio;
      this.pinchingState = computePinchHysteresis(this.pinchingState, pinchRatio);

      // Ultra-snappy smoothing (72% new) for Ninja Fruits / Air Hockey
      this.smoothedIndexX = this.smoothedIndexX * 0.28 + rawIndexX * 0.72;
      this.smoothedIndexY = this.smoothedIndexY * 0.28 + rawIndexY * 0.72;
      this.smoothedPalmX = this.smoothedPalmX * 0.28 + rawPalmX * 0.72;
      this.smoothedPalmY = this.smoothedPalmY * 0.28 + rawPalmY * 0.72;

      // Anti-tremble exponential smoothing (lerp = 0.35) for Slingshot Duo & X O Néon
      this.precisionPinchX += (rawPinchX - this.precisionPinchX) * PRECISION_LERP;
      this.precisionPinchY += (rawPinchY - this.precisionPinchY) * PRECISION_LERP;
      this.precisionIndexX += (rawIndexX - this.precisionIndexX) * PRECISION_LERP;
      this.precisionIndexY += (rawIndexY - this.precisionIndexY) * PRECISION_LERP;

      return {
        kind: 'frame',
        metrics: {
          indexX: this.smoothedIndexX,
          indexY: this.smoothedIndexY,
          palmX: this.smoothedPalmX,
          palmY: this.smoothedPalmY,
          pinchX: this.precisionPinchX,
          pinchY: this.precisionPinchY,
          smoothIndexX: this.precisionIndexX,
          smoothIndexY: this.precisionIndexY,
          pinchRatio: this.lastPinchRatio,
          isPinching: this.pinchingState,
          handDetected: true,
          timestamp: tsMs,
        },
      };
    } catch (err) {
      this.consecutiveErrors += 1;
      if (this.consecutiveErrors === 3 && this.activeDelegate === 'GPU') {
        console.warn('[CoupleCam] GPU HandLandmarker frame error, switching to CPU delegate:', err);
        void this.fallbackToCpuRuntime();
      }
      return { kind: 'same-frame' };
    }
  }

  public dispose() {
    this.landmarker?.close();
    this.landmarker = null;
    this.vision = null;
    this.status = 'idle';
    this.initPromise = null;
    this.lastVideoEl = null;
    this.lastVideoTime = -1;
    this.lastTimestampMs = 0;
    this.consecutiveErrors = 0;
    this.pinchingState = false;
    this.lastPinchRatio = 1;
  }
}
