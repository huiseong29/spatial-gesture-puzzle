import type { VirtualBoundingBox } from "../interaction/boundingBox/boundingBoxTypes";
import type { CaptureState } from "../capture/snapshotTypes";

export function renderVirtualBoundingBox(
  context: CanvasRenderingContext2D,
  box: VirtualBoundingBox | null,
  capture: CaptureState | null = null
) {
  if (!box || !box.active) {
    return;
  }

  const rect = box.smoothedRect;
  const opacity = box.lostFrameCount > 0 ? 0.42 : 0.92;
  const isEditing = box.mode === "editing";
  const readyPulse = capture?.captureReady ? 0.5 + Math.sin(performance.now() / 170) * 0.22 : 0;
  const tomatoActive = isEditing || capture?.captureReady;
  const glowOpacity = Math.min(1, opacity + readyPulse);

  context.save();
  context.shadowColor = tomatoActive
    ? `rgba(239, 68, 68, ${0.48 + readyPulse * 0.35})`
    : "rgba(251, 146, 60, 0.34)";
  context.shadowBlur = tomatoActive ? 30 + readyPulse * 10 : 18;
  context.lineWidth = isEditing ? 4 : 3;
  context.setLineDash(box.lostFrameCount > 0 ? [10, 8] : []);
  context.strokeStyle = tomatoActive
    ? `rgba(239, 68, 68, ${glowOpacity})`
    : `rgba(254, 215, 170, ${opacity})`;
  context.fillStyle = tomatoActive
    ? `rgba(239, 68, 68, ${0.06 + readyPulse * 0.03})`
    : `rgba(254, 215, 170, ${opacity * 0.06})`;
  roundRect(context, rect.x, rect.y, rect.width, rect.height, 16);
  context.fill();
  roundRect(context, rect.x, rect.y, rect.width, rect.height, 16);
  context.stroke();

  context.shadowBlur = 0;
  context.setLineDash([]);
  context.fillStyle = `rgba(255, 237, 213, ${opacity})`;
  context.beginPath();
  context.arc(box.center.x, box.center.y, 6, 0, Math.PI * 2);
  context.fill();

  if (box.cornerA && box.cornerB) {
    context.shadowColor = "rgba(239, 68, 68, 0.62)";
    context.shadowBlur = 14;
    context.fillStyle = `rgba(255, 237, 213, ${opacity})`;
    context.beginPath();
    context.arc(box.cornerA.x, box.cornerA.y, 7, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(box.cornerB.x, box.cornerB.y, 7, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
}
