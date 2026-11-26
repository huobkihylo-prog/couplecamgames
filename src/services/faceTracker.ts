import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceMetrics, TrackerStatus } from '../types/duoplay';
import { computeSmileIntensity } from '../game/laughRules';

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export const EMPTY_FACE_METRICS: FaceMetrics = {
  smileScore: 0,
  grimaceScore: 0,
  laughBurst: 0,
  headTiltRad: 0,
  noseOffsetX: 0,
  eyeBlinkLeft: 0,
  eyeBlinkRight: 0,
  hasBlinked: false,
  jawOpen: 0,
  mouthOpen: false,
  mouthX: 0.5,
  mouthY: 0.62,
  mouthPucker: 0,
  isKissing: false,
  faceDetected: false,
  timestamp: 0,
};

export type FaceDetectionResult =
  | { kind: 'frame'; metrics: FaceMetrics }
  | { kind: 'same-frame' }
  | { kind: 'not-ready' };

/**
 * Local MediaPipe FaceLandmarker wrapper measuring:
 * - Smile & laugh intensity + expressive grimace intensity (blendshapes) for "Tu ris, tu perds"
 * - Head roll tilt angle (eye-corner landmarks) for "Les Funambules"
 *
 * Includes strict monotonic integer timestamps and automatic GPU -> CPU runtime fallback
 * so webcam tracking never silently stalls on WebGL-restricted devices.
 */
export class DuoFaceTracker {
  private landmarker: FaceLandmarker | null = null;
  private vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
  private status: TrackerStatus = 'idle';
  private activeDelegate: 'GPU' | 'CPU' = 'GPU';
  private initPromise: Promise<TrackerStatus> | null = null;
  private switchingToCpu = false;
  private consecutiveErrors = 0;

  private lastVideoEl: HTMLVideoElement | null = null;
  private lastVideoTime = -1;
  private lastTimestampMs = 0;

  private smoothedSmile = 0;
  private smoothedGrimace = 0;
  private smoothedTilt = 0;
  private smoothedMouthX = 0.5;
  private smoothedMouthY = 0.62;
  private smoothedJawOpen = 0;
  private smoothedMouthPucker = 0;

  public getStatus(): TrackerStatus {
    return this.status;
  }

  private async createLandmarker(
    vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
    delegate: 'GPU' | 'CPU',
  ): Promise<FaceLandmarker> {
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        delegate,
      },
      runningMode: 'VIDEO',
      outputFaceBlendshapes: true,
      numFaces: 1,
      minFaceDetectionConfidence: 0.4,
      minFacePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
  }

  public async ensureInitialized(forceRetry = false): Promise<TrackerStatus> {
    if (this.status === 'ready') {
      return 'ready';
    }
    if (this.status === 'fallback' && !forceRetry) {
      return 'fallback';
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.status = 'loading';
    this.initPromise = (async () => {
      try {
        const vision = this.vision ?? (await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL));
        this.vision = vision;

        let landmarker: FaceLandmarker;
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
        console.warn('[CoupleCam] FaceLandmarker init failed, falling back to manual controls:', err);
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
      console.warn('[CoupleCam] FaceLandmarker CPU fallback failed:', err);
      this.status = 'fallback';
    } finally {
      this.switchingToCpu = false;
    }
  }

  public detectFrame(video: HTMLVideoElement | null, nowMs: number): FaceDetectionResult {
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

    // Reset cached videoTime whenever a different <video> element is supplied
    if (this.lastVideoEl !== video) {
      this.lastVideoEl = video;
      this.lastVideoTime = -1;
    }

    // If the camera hasn't decoded a new frame yet, tell the caller to HOLD previous metrics
    if (video.currentTime === this.lastVideoTime && this.lastVideoTime > 0) {
      return { kind: 'same-frame' };
    }
    this.lastVideoTime = video.currentTime;

    // MediaPipe Tasks Vision requires strictly increasing integer millisecond timestamps
    const tsMs = Math.max(this.lastTimestampMs + 1, Math.floor(nowMs));
    this.lastTimestampMs = tsMs;

    try {
      const result = this.landmarker.detectForVideo(video, tsMs);
      this.consecutiveErrors = 0;

      const landmarks = result.faceLandmarks?.[0];
      const blendshapes = result.faceBlendshapes?.[0]?.categories;

      if (!landmarks || landmarks.length < 264) {
        this.smoothedSmile *= 0.82;
        this.smoothedGrimace *= 0.82;
        this.smoothedTilt *= 0.82;
        this.smoothedJawOpen *= 0.78;
        this.smoothedMouthPucker *= 0.75;
        return {
          kind: 'frame',
          metrics: {
            smileScore: Math.round(this.smoothedSmile),
            grimaceScore: Math.round(this.smoothedGrimace),
            laughBurst: 0,
            headTiltRad: this.smoothedTilt,
            noseOffsetX: 0,
            eyeBlinkLeft: 0,
            eyeBlinkRight: 0,
            hasBlinked: false,
            jawOpen: this.smoothedJawOpen,
            mouthOpen: this.smoothedJawOpen >= 0.32,
            mouthX: this.smoothedMouthX,
            mouthY: this.smoothedMouthY,
            mouthPucker: this.smoothedMouthPucker,
            isKissing: this.smoothedMouthPucker >= 0.45,
            faceDetected: false,
            faceAnchor: null,
            timestamp: tsMs,
          },
        };
      }

      const { smileScore, grimaceScore, laughBurst } = computeSmileIntensity(blendshapes);

      // Extract exact eyeBlinkLeft, eyeBlinkRight, jawOpen, and mouthPucker blendshapes
      let eyeBlinkLeft = 0;
      let eyeBlinkRight = 0;
      let rawJawOpen = 0;
      let rawMouthPucker = 0;
      if (blendshapes) {
        for (let i = 0; i < blendshapes.length; i++) {
          const cat = blendshapes[i];
          if (cat.categoryName === 'eyeBlinkLeft') eyeBlinkLeft = cat.score;
          else if (cat.categoryName === 'eyeBlinkRight') eyeBlinkRight = cat.score;
          else if (cat.categoryName === 'jawOpen') rawJawOpen = cat.score;
          else if (cat.categoryName === 'mouthPucker') rawMouthPucker = cat.score;
        }
      }

      // Landmarks 33 (viewer-left eye outer), 263 (viewer-right eye outer), 1 (nose tip), 152 (chin)
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      const noseTip = landmarks[1];
      const chin = landmarks[152] ?? noseTip;
      // Landmarks 13 (upper inner lip) & 14 (lower inner lip) give exact mouth center
      const upperLip = landmarks[13];
      const lowerLip = landmarks[14];
      const rawMouthX = Math.max(0, Math.min(1, 1 - (upperLip.x + lowerLip.x) * 0.5));
      const rawMouthY = Math.max(0, Math.min(1, (upperLip.y + lowerLip.y) * 0.5));

      const dx = rightEye.x - leftEye.x;
      const dy = rightEye.y - leftEye.y;
      const rawTiltRad = Math.abs(dx) > 0.01 ? -Math.atan2(dy, dx) : 0;
      const noseOffsetX = (0.5 - noseTip.x) * 2;

      // Crisp low-latency smoothing so grimaces, tilts, kisses & mouth catching feel immediate
      this.smoothedSmile = this.smoothedSmile * 0.32 + smileScore * 0.68;
      this.smoothedGrimace = this.smoothedGrimace * 0.35 + grimaceScore * 0.65;
      this.smoothedTilt = this.smoothedTilt * 0.38 + rawTiltRad * 0.62;
      this.smoothedMouthX = this.smoothedMouthX * 0.25 + rawMouthX * 0.75;
      this.smoothedMouthY = this.smoothedMouthY * 0.25 + rawMouthY * 0.75;
      this.smoothedJawOpen = this.smoothedJawOpen * 0.25 + rawJawOpen * 0.75;
      this.smoothedMouthPucker = this.smoothedMouthPucker * 0.28 + rawMouthPucker * 0.72;

      const hasBlinked =
        eyeBlinkLeft >= 0.56 ||
        eyeBlinkRight >= 0.56 ||
        (eyeBlinkLeft + eyeBlinkRight) * 0.5 >= 0.48;
      const mouthOpen = this.smoothedJawOpen >= 0.3;
      const isKissing = this.smoothedMouthPucker >= 0.45;

      return {
        kind: 'frame',
        metrics: {
          smileScore: Math.round(this.smoothedSmile),
          grimaceScore: Math.round(this.smoothedGrimace),
          laughBurst,
          headTiltRad: this.smoothedTilt,
          noseOffsetX,
          eyeBlinkLeft,
          eyeBlinkRight,
          hasBlinked,
          jawOpen: this.smoothedJawOpen,
          mouthOpen,
          mouthX: this.smoothedMouthX,
          mouthY: this.smoothedMouthY,
          mouthPucker: this.smoothedMouthPucker,
          isKissing,
          faceDetected: true,
          faceAnchor: {
            noseX: noseTip.x,
            noseY: noseTip.y,
            leftEyeX: leftEye.x,
            leftEyeY: leftEye.y,
            rightEyeX: rightEye.x,
            rightEyeY: rightEye.y,
            chinX: chin.x,
            chinY: chin.y,
            headTiltRad: rawTiltRad,
          },
          timestamp: tsMs,
        },
      };
    } catch (err) {
      this.consecutiveErrors += 1;
      if (this.consecutiveErrors === 3 && this.activeDelegate === 'GPU') {
        console.warn('[CoupleCam] GPU FaceLandmarker frame error, switching to CPU delegate:', err);
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
