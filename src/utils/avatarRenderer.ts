/**
 * Renders an expressive, cozy illustrated avatar on a 2D canvas.
 * Used for:
 *  - Solo mode AI Partner ("Camille IA") mirroring real-time smileScore & headTiltRad
 *  - Graceful local camera preview fallback when no physical webcam is attached
 */
export function drawExpressiveAvatar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: {
    name: string;
    smileScore: number;
    headTiltRad: number;
    timeSec: number;
    accentColor: string;
    bgTop: string;
    bgBottom: string;
    isAi?: boolean;
  },
) {
  const { smileScore, headTiltRad, timeSec, accentColor, bgTop, bgBottom, isAi } = options;

  // Warm salon twilight gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient warm lantern bokeh
  for (let i = 0; i < 4; i++) {
    const bx = width * (0.16 + i * 0.23) + Math.sin(timeSec * 0.5 + i) * 8;
    const by = height * (0.18 + (i % 2) * 0.12);
    const br = 20 + (i % 2) * 14;
    const rad = ctx.createRadialGradient(bx, by, 2, bx, by, br);
    rad.addColorStop(0, 'rgba(232, 184, 97, 0.22)');
    rad.addColorStop(1, 'rgba(232, 184, 97, 0)');
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  const cx = width * 0.5;
  const cy = height * 0.56;
  const scale = Math.min(width, height) / 220;

  ctx.save();
  ctx.translate(cx, cy + 52 * scale);

  // Shoulders
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.ellipse(0, 26 * scale, 64 * scale, 42 * scale, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Collar detail
  ctx.fillStyle = '#F6F2E9';
  ctx.beginPath();
  ctx.arc(0, -10 * scale, 18 * scale, 0, Math.PI);
  ctx.fill();

  // Neck
  ctx.fillStyle = '#E8C3A4';
  ctx.fillRect(-11 * scale, -34 * scale, 22 * scale, 28 * scale);

  // Head pivot for smooth tilt
  ctx.translate(0, -56 * scale);
  ctx.rotate(Math.max(-0.48, Math.min(0.48, headTiltRad)));

  // Back hair
  ctx.fillStyle = isAi ? '#2C2137' : '#241E2B';
  ctx.beginPath();
  ctx.arc(0, -4 * scale, 48 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Face oval
  ctx.fillStyle = '#F2CEB0';
  ctx.beginPath();
  ctx.ellipse(0, 2 * scale, 39 * scale, 44 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Front hair bangs / beret silhouette
  ctx.fillStyle = isAi ? '#382947' : '#2D2638';
  ctx.beginPath();
  ctx.ellipse(0, -30 * scale, 40 * scale, 20 * scale, -0.08, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();

  if (isAi) {
    // Subtle French beret for Camille IA
    ctx.fillStyle = '#8F3843';
    ctx.beginPath();
    ctx.ellipse(-6 * scale, -40 * scale, 34 * scale, 11 * scale, -0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cheeks blush (brighter when smiling!)
  const blushAlpha = 0.16 + (smileScore / 100) * 0.32;
  ctx.fillStyle = `rgba(232, 106, 88, ${blushAlpha.toFixed(2)})`;
  ctx.beginPath();
  ctx.ellipse(-22 * scale, 12 * scale, 9 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(22 * scale, 12 * scale, 9 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (periodic natural blink)
  const blinkCycle = timeSec % 4.2;
  const isBlinking = blinkCycle > 4.05;
  const happySquint = smileScore > 55;

  ctx.strokeStyle = '#1E1926';
  ctx.fillStyle = '#1E1926';
  ctx.lineWidth = 2.6 * scale;
  ctx.lineCap = 'round';

  [-14, 14].forEach((ex) => {
    const x = ex * scale;
    const y = -2 * scale;
    if (isBlinking) {
      ctx.beginPath();
      ctx.moveTo(x - 6 * scale, y);
      ctx.lineTo(x + 6 * scale, y);
      ctx.stroke();
    } else if (happySquint) {
      // Happy crescent eyes when laughing
      ctx.beginPath();
      ctx.arc(x, y + 2 * scale, 6 * scale, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 4.2 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x - 1.3 * scale, y - 1.4 * scale, 1.4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1E1926';
    }
  });

  // Eyebrows
  const browLift = (smileScore / 100) * 3 * scale;
  ctx.strokeStyle = '#2B2233';
  ctx.lineWidth = 2.2 * scale;
  ctx.beginPath();
  ctx.moveTo(-21 * scale, -13 * scale - browLift);
  ctx.quadraticCurveTo(-14 * scale, -16 * scale - browLift, -7 * scale, -13 * scale - browLift);
  ctx.moveTo(7 * scale, -13 * scale - browLift);
  ctx.quadraticCurveTo(14 * scale, -16 * scale - browLift, 21 * scale, -13 * scale - browLift);
  ctx.stroke();

  // Mouth driven directly by smileScore (0 = poker face, 50+ = big laugh!)
  const smileNorm = Math.max(0, Math.min(1, smileScore / 100));
  const mouthY = 18 * scale;
  const mouthWidth = (10 + smileNorm * 10) * scale;
  const smileCurve = (smileNorm - 0.12) * 18 * scale;

  ctx.strokeStyle = '#6A2E35';
  ctx.lineWidth = 2.6 * scale;
  if (smileScore >= 52) {
    // Open laughing mouth
    ctx.fillStyle = '#7D2832';
    ctx.beginPath();
    ctx.moveTo(-mouthWidth, mouthY - 2 * scale);
    ctx.quadraticCurveTo(0, mouthY + smileCurve * 1.5, mouthWidth, mouthY - 2 * scale);
    ctx.quadraticCurveTo(0, mouthY + 2 * scale, -mouthWidth, mouthY - 2 * scale);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-mouthWidth, mouthY);
    ctx.quadraticCurveTo(0, mouthY + smileCurve, mouthWidth, mouthY);
    ctx.stroke();
  }

  ctx.restore();
}
