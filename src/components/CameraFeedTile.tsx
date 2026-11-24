import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Camera, MicOff } from 'lucide-react';
import type { FaceMetrics, TrackerStatus } from '../types/duoplay';
import { useI18n } from '../i18n/LanguageContext';
import { AvatarCanvas } from './AvatarCanvas';

interface CameraFeedTileProps {
  name: string;
  subtitle?: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  isAi?: boolean;
  cameraEnabled?: boolean;
  micMuted?: boolean;
  trackerStatus?: TrackerStatus;
  showTrackingReadout?: boolean;
  metricsRef: MutableRefObject<FaceMetrics>;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  onRequestCamera?: () => void;
  compact?: boolean;
  highlightState?: 'neutral' | 'warning' | 'danger' | 'winner';
  footerOverlay?: React.ReactNode;
}

export function CameraFeedTile({
  name,
  subtitle,
  stream,
  isLocal = false,
  isAi = false,
  cameraEnabled = true,
  micMuted = false,
  trackerStatus,
  showTrackingReadout = false,
  metricsRef,
  onVideoRef,
  onRequestCamera,
  compact = false,
  highlightState = 'neutral',
  footerOverlay,
}: CameraFeedTileProps) {
  const { t } = useI18n();
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const [liveTrack, setLiveTrack] = useState({
    faceDetected: false,
    smileScore: 0,
    grimaceScore: 0,
    tiltDeg: 0,
  });

  const showLiveVideo = Boolean(stream) && cameraEnabled && !isAi;

  useEffect(() => {
    const video = internalVideoRef.current;
    if (!video) return;
    if (showLiveVideo && stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream, showLiveVideo]);

  // Lightweight 10Hz live face/expression/tilt feedback when physical webcam tracking is active
  useEffect(() => {
    if (!showTrackingReadout || !isLocal || !showLiveVideo) return;
    const id = window.setInterval(() => {
      const m = metricsRef.current;
      const tiltDeg = Math.round((m.headTiltRad * 180) / Math.PI);
      setLiveTrack((prev) => {
        if (
          prev.faceDetected === m.faceDetected &&
          prev.smileScore === m.smileScore &&
          prev.grimaceScore === m.grimaceScore &&
          prev.tiltDeg === tiltDeg
        ) {
          return prev;
        }
        return {
          faceDetected: m.faceDetected,
          smileScore: m.smileScore,
          grimaceScore: m.grimaceScore,
          tiltDeg,
        };
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [showTrackingReadout, isLocal, showLiveVideo, metricsRef]);

  const borderClass =
    highlightState === 'danger'
      ? 'border-[#E86A58] ring-2 ring-[#E86A58]/40'
      : highlightState === 'warning'
        ? 'border-[#E8B861] ring-1 ring-[#E8B861]/30'
        : highlightState === 'winner'
          ? 'border-[#5CC29F] ring-2 ring-[#5CC29F]/40'
          : 'border-white/12';

  const aspectClass = compact ? 'aspect-[16/10]' : 'aspect-[4/3]';

  let liveLabel: string | null = null;
  if (showTrackingReadout && isLocal && showLiveVideo) {
    if (trackerStatus === 'loading') {
      liveLabel = t.camLoading;
    } else if (trackerStatus === 'ready') {
      if (!liveTrack.faceDetected) {
        liveLabel = t.camReady;
      } else if (liveTrack.smileScore >= 35) {
        liveLabel = `😊 ${liveTrack.smileScore}%`;
      } else if (liveTrack.grimaceScore >= 42) {
        liveLabel = `😜 ${liveTrack.grimaceScore}%`;
      } else if (Math.abs(liveTrack.tiltDeg) >= 5) {
        liveLabel = `${liveTrack.tiltDeg > 0 ? '+' : ''}${liveTrack.tiltDeg}°`;
      } else {
        liveLabel = t.camReady;
      }
    }
  }

  return (
    <div
      className={`relative w-full ${aspectClass} rounded-xl overflow-hidden bg-[#141724] border transition-colors ${borderClass}`}
    >
      {showLiveVideo ? (
        <video
          ref={(el) => {
            internalVideoRef.current = el;
            onVideoRef?.(el);
          }}
          autoPlay
          playsInline
          // Local preview MUST always be muted to avoid audio echo!
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'mirror-video' : ''}`}
        />
      ) : (
        <AvatarCanvas
          name={name}
          metricsRef={metricsRef}
          accentColor={isLocal ? '#C95A49' : '#B5893D'}
          bgTop={isLocal ? '#1D2236' : '#241C31'}
          bgBottom={isLocal ? '#111420' : '#131422'}
          isAi={isAi}
        />
      )}

      {/* Measured contrast scrim for legible text over any video luminance */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0D0F17]/92 via-[#0D0F17]/45 to-transparent"
        aria-hidden="true"
      />

      <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#F6F2E9] truncate">
            {name}
            {isLocal && <span className="text-xs font-normal text-[#CBC4B6] ms-1.5">{t.youTag}</span>}
          </p>
          {(liveLabel || subtitle) && (
            <p
              className={`text-xs truncate tabular-nums ${
                liveLabel && liveTrack.faceDetected ? 'text-[#8AE0C0]' : 'text-[#CBC4B6]'
              }`}
            >
              {liveLabel || subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {micMuted && isLocal && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-[#F08272]"
              title={t.micMuted}
            >
              <MicOff className="w-3.5 h-3.5" />
            </span>
          )}
          {!showLiveVideo && isLocal && onRequestCamera && (
            <button
              type="button"
              onClick={onRequestCamera}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#141724]/90 text-[#F6F2E9] border border-white/15 hover:bg-[#22273B] transition-colors whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{t.enableCamera}</span>
            </button>
          )}
          {footerOverlay}
        </div>
      </div>
    </div>
  );
}
