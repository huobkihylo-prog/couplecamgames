import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Camera, MicOff } from 'lucide-react';
import type { FaceMetrics, TrackerStatus } from '../types/duoplay';
import { useI18n } from '../i18n/LanguageContext';
import { useMirror } from '../context/MirrorContext';
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
  frameClassName?: string;
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
  frameClassName,
  highlightState = 'neutral',
  footerOverlay,
}: CameraFeedTileProps) {
  const { t } = useI18n();
  const { isMirrored } = useMirror();
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
      ? 'border-[#EF4444] ring-2 ring-[#EF4444]/35'
      : highlightState === 'warning'
        ? 'border-[#F59E0B] ring-2 ring-[#F59E0B]/30'
        : highlightState === 'winner'
          ? 'border-[#16A34A] ring-2 ring-[#16A34A]/35'
          : isLocal
            ? 'border-[#FF6B57]/35'
            : 'border-[#7C5CFC]/30';

  const sizeClass = frameClassName ?? (compact ? 'aspect-[16/10]' : 'aspect-[4/3]');

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
      className={`relative w-full ${sizeClass} rounded-2xl overflow-hidden bg-white border shadow-[0_4px_20px_rgba(31,36,45,0.06)] transition-all duration-300 ${borderClass}`}
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
          className={`w-full h-full object-cover ${isLocal && isMirrored ? 'mirror-video' : ''}`}
        />
      ) : (
        <AvatarCanvas
          name={name}
          metricsRef={metricsRef}
          accentColor={isLocal ? '#FF6B57' : '#7C5CFC'}
          bgTop={isLocal ? '#FFE8E2' : '#EFE9FB'}
          bgBottom={isLocal ? '#FDF1EC' : '#E6F3FC'}
          isAi={isAi}
        />
      )}

      {/* Subtle frosted white label tag (bg-white/85) */}
      <div className="absolute inset-x-2 sm:inset-x-2.5 bottom-2 flex items-end justify-between gap-1.5">
        <div className="min-w-0 max-w-[78%] inline-flex flex-col px-2.5 py-1 rounded-xl bg-white/88 backdrop-blur-md border border-[#EAE4DC]/80 shadow-sm">
          <p className="text-[11px] sm:text-xs font-bold text-[#1F242D] truncate leading-tight">
            {isAi ? `🤖 ${name}` : name}
            {isLocal && <span className="text-[10px] font-semibold text-[#6B7280] ms-1">{t.youTag}</span>}
          </p>
          {(liveLabel || subtitle) && (
            <p
              className={`text-[10px] truncate tabular-nums leading-tight ${
                liveLabel && liveTrack.faceDetected ? 'text-[#16A34A] font-semibold' : 'text-[#6B7280]'
              }`}
            >
              {liveLabel || subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {micMuted && isLocal && (
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#EF4444] text-white shadow-sm"
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
              className="min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/92 backdrop-blur-md text-[#1F242D] border border-[#EAE4DC] hover:bg-[#FAF7F2] shadow-sm transition-colors whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5 text-[#FF6B57] shrink-0" />
              <span className="hidden sm:inline">{t.enableCamera}</span>
            </button>
          )}
          {footerOverlay}
        </div>
      </div>
    </div>
  );
}
