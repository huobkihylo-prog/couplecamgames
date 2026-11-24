import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandMetrics, TrackerStatus } from '../types/duoplay';

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const EMPTY_HAND_METRICS: HandMetrics = {
  indexX: 0.5,
  indexY: 0.5,
  palmX: 0.5,
  palmY: 0.5,
  handDetected: false,
  timestamp: 0,
};

export type HandDetectionResult =
  | { kind: 'frame'; metrics: HandMetrics }
  | { kind: 'same-frame' }
  | { kind: 'not-ready' };

/**
 * Lazy-loaded MediaPipe HandLandmarker tracker providing:
 * - Landmark 8 (index fingertip) for "Ninja Fruits en Duo"
 * - Landmark 9 (middle finger MCP / palm center) for "Air Hockey des Mains"
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
        const vision = this.vision ?? (await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL));
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
        return {
          kind: 'frame',
          metrics: {
            indexX: this.smoothedIndexX,
            indexY: this.smoothedIndexY,
            palmX: this.smoothedPalmX,
            palmY: this.smoothedPalmY,
            handDetected: false,
            timestamp: tsMs,
          },
        };
      }

      // Landmark 8 = index fingertip; Landmark 9 = middle MCP (palm center)
      // Mirror X (1 - x) so moving hand right moves blade/paddle right on screen
      const rawIndexX = Math.max(0, Math.min(1, 1 - hand[8].x));
      const rawIndexY = Math.max(0, Math.min(1, hand[8].y));
      const rawPalmX = Math.max(0, Math.min(1, 1 - hand[9].x));
      const rawPalmY = Math.max(0, Math.min(1, hand[9].y));

      // Ultra-snappy smoothing (72% new) so slashes & hockey strikes feel immediate
      this.smoothedIndexX = this.smoothedIndexX * 0.28 + rawIndexX * 0.72;
      this.smoothedIndexY = this.smoothedIndexY * 0.28 + rawIndexY * 0.72;
      this.smoothedPalmX = this.smoothedPalmX * 0.28 + rawPalmX * 0.72;
      this.smoothedPalmY = this.smoothedPalmY * 0.28 + rawPalmY * 0.72;

      return {
        kind: 'frame',
        metrics: {
          indexX: this.smoothedIndexX,
          indexY: this.smoothedIndexY,
          palmX: this.smoothedPalmX,
          palmY: this.smoothedPalmY,
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
  }
}
