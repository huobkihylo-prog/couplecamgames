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
      ? 'border-[#EF4444] ring-2 ring-[#EF4444]/45'
      : highlightState === 'warning'
        ? 'border-[#FACC15] ring-2 ring-[#FACC15]/35'
        : highlightState === 'winner'
          ? 'border-[#34D399] ring-2 ring-[#34D399]/45'
          : isLocal
            ? 'border-[#FF4D8D]/40 ring-1 ring-white/10'
            : 'border-[#38BDF8]/40 ring-1 ring-white/10';

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
      className={`relative w-full ${aspectClass} rounded-3xl overflow-hidden bg-[#1A1533] border shadow-lg shadow-black/30 transition-all duration-300 ${borderClass}`}
    >
      {showLiveVideo ? (
        <video
          ref={(el) => {
            internalVideoRef.current = el;
            onVideoRef?.(el);
          }}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'mirror-video' : ''}`}
        />
      ) : (
        <AvatarCanvas
          name={name}
          metricsRef={metricsRef}
          accentColor={isLocal ? '#FF4D8D' : '#38BDF8'}
          bgTop={isLocal ? '#2C1E59' : '#1E2C59'}
          bgBottom={isLocal ? '#15102B' : '#111833'}
          isAi={isAi}
        />
      )}

      {/* Measured contrast scrim for crisp legibility over any video luminance */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0D0A1E]/92 via-[#0D0A1E]/50 to-transparent"
        aria-hidden="true"
      />

      <div className="absolute inset-x-2.5 sm:inset-x-3.5 bottom-2 sm:bottom-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold text-white truncate">
            {name}
            {isLocal && <span className="text-[11px] font-medium text-white/75 ms-1">{t.youTag}</span>}
          </p>
          {(liveLabel || subtitle) && (
            <p
              className={`text-[11px] sm:text-xs truncate tabular-nums ${
                liveLabel && liveTrack.faceDetected ? 'text-[#34D399]' : 'text-white/75'
              }`}
            >
              {liveLabel || subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {micMuted && isLocal && (
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#EF4444]/85 text-white"
              title={t.micMuted}
            >
              <MicOff className="w-3.5 h-3.5" />
            </span>
          )}
          {!showLiveVideo && isLocal && onRequestCamera && (
            <button
              type="button"
              onClick={onRequestCamera}
              title={t.enableCamera}
              aria-label={t.enableCamera}
              className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-white/15 backdrop-blur-md text-white border border-white/25 hover:bg-white/25 transition-colors whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{t.enableCamera}</span>
            </button>
          )}
          {footerOverlay}
        </div>
      </div>
    </div>
  );
}
