import { useEffect, useRef, type MutableRefObject } from 'react';
import type { FaceMetrics } from '../types/duoplay';
import { drawExpressiveAvatar } from '../utils/avatarRenderer';

interface AvatarCanvasProps {
  name: string;
  metricsRef: MutableRefObject<FaceMetrics>;
  accentColor: string;
  bgTop: string;
  bgBottom: string;
  isAi?: boolean;
  className?: string;
}

/**
 * Decoupled 2D canvas portrait animating blink, smile, and head-tilt at 30fps
 * directly from a mutable metricsRef (zero React re-renders).
 */
export function AvatarCanvas({
  name,
  metricsRef,
  accentColor,
  bgTop,
  bgBottom,
  isAi = false,
  className = '',
}: AvatarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastDraw = 0;

    const render = (now: number) => {
      rafId = requestAnimationFrame(render);
      if (now - lastDraw < 45) return;
      if (canvas.offsetParent === null) return;
      lastDraw = now;

      const m = metricsRef.current;
      drawExpressiveAvatar(ctx, canvas.width, canvas.height, {
        name,
        smileScore: m.smileScore,
        headTiltRad: m.headTiltRad,
        timeSec: now * 0.001,
        accentColor,
        bgTop,
        bgBottom,
        isAi,
      });
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [name, metricsRef, accentColor, bgTop, bgBottom, isAi]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={240}
      className={`w-full h-full object-cover ${className}`}
      aria-label={`Portrait animé de ${name}`}
    />
  );
}
