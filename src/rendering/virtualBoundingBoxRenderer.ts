import type { VirtualBoundingBox } from "../interaction/boundingBox/boundingBoxTypes";
import type { CaptureState } from "../capture/snapshotTypes";
import type { InteractionConfidenceState } from "../tracking/handTypes";
import { getRipenessTheme } from "./ripenessTheme";
import type { ThemeMode } from "../theme/themeTypes";
import { getThemeTokens } from "../theme/themeTokens";

export function renderVirtualBoundingBox(
  context: CanvasRenderingContext2D,
  box: VirtualBoundingBox | null,
  capture: CaptureState | null = null,
  confidence: InteractionConfidenceState | null = null,
  themeMode: ThemeMode = "dark"
) {
  if (!box || !box.active) {
    return;
  }

  const rect = box.smoothedRect;
  const opacity = box.lostFrameCount > 0 ? 0.42 : 0.92;
  const isEditing = box.mode === "editing";
  const readyPulse = capture?.captureReady ? 0.5 + Math.sin(performance.now() / 170) * 0.22 : 0;
  const tomatoActive = isEditing || capture?.captureReady;
  const theme = getRipenessTheme(confidence, themeMode);
  const tokens = getThemeTokens(themeMode);
  const glowOpacity = Math.min(1, opacity + readyPulse);

  context.save();
  context.shadowColor = tomatoActive
    ? theme.accentGlow
    : tokens.tomatoGlow;
  context.shadowBlur = tomatoActive ? (24 + readyPulse * 10) * theme.pulse : 18;
  context.lineWidth = isEditing ? 4 : 3;
  context.setLineDash(box.lostFrameCount > 0 ? [10, 8] : []);
  context.strokeStyle = tomatoActive
    ? withAlpha(theme.accent, glowOpacity)
    : withAlpha(tokens.cream, opacity);
  context.fillStyle = tomatoActive
    ? theme.accentFill
    : withAlpha(tokens.cream, opacity * 0.06);
  roundRect(context, rect.x, rect.y, rect.width, rect.height, 16);
  context.fill();
  roundRect(context, rect.x, rect.y, rect.width, rect.height, 16);
  context.stroke();

  context.shadowBlur = 0;
  context.setLineDash([]);
  context.fillStyle = withAlpha(tokens.cream, opacity);
  context.beginPath();
  context.arc(box.center.x, box.center.y, 6, 0, Math.PI * 2);
  context.fill();

  if (box.cornerA && box.cornerB) {
    context.shadowColor = theme.accentGlow;
    context.shadowBlur = 10 * theme.pulse;
    context.fillStyle = withAlpha(tokens.cream, opacity);
    context.beginPath();
    context.arc(box.cornerA.x, box.cornerA.y, 7, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(box.cornerB.x, box.cornerB.y, 7, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("#")) {
    const [r, g, b] = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }

  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha.toFixed(3)})`);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
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
