import { puzzleConfig } from "../config/puzzleConfig";
import type { PuzzleBoard } from "../puzzle/puzzleTypes";
import { getThemeTokens } from "../theme/themeTokens";
import type { ThemeMode } from "../theme/themeTypes";

export function renderInteractionHeatmap(
  context: CanvasRenderingContext2D,
  board: PuzzleBoard | null,
  themeMode: ThemeMode = "dark"
) {
  if (
    !board ||
    board.mode !== "completed" ||
    !board.interaction.completedAt ||
    (board.interaction.heatmapReplayMode !== "playing" && board.interaction.heatmapReplayMode !== "finished")
  ) {
    return;
  }

  const samples = board.interaction.pointerHistory.samples;
  if (samples.length === 0) {
    return;
  }

  const elapsed = board.interaction.heatmapReplayMode === "finished"
    ? puzzleConfig.heatmapReplayMs
    : performance.now() - board.interaction.heatmapReplayStartedAt;
  const reveal = clamp01(elapsed / puzzleConfig.heatmapReplayMs);
  const fade = 1;
  const visibleCount = Math.max(1, Math.floor(samples.length * reveal));
  const visibleSamples = samples.slice(0, visibleCount);
  const tokens = getThemeTokens(themeMode);
  const isLight = themeMode === "light";

  context.save();
  context.fillStyle = isLight ? "rgba(42, 26, 20, 0.16)" : tokens.heatmapDim;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.globalCompositeOperation = isLight ? "source-over" : "lighter";

  for (let index = 0; index < visibleSamples.length; index += 1) {
    const sample = visibleSamples[index];
    const ageWeight = 0.45 + (index / visibleSamples.length) * 0.55;
    const themeBoost = isLight ? 1.45 : 1;
    const alpha = (sample.dragging ? puzzleConfig.heatmapDragAlpha * 1.65 : puzzleConfig.heatmapHoverAlpha * 1.4) * ageWeight * fade * themeBoost;
    const radius = sample.dragging ? puzzleConfig.heatmapPointRadiusPx : puzzleConfig.heatmapPointRadiusPx * 0.7;
    const gradient = context.createRadialGradient(sample.x, sample.y, 0, sample.x, sample.y, radius);

    gradient.addColorStop(0, withAlpha(tokens.tomatoPrimary, alpha));
    gradient.addColorStop(0.45, withAlpha(isLight ? tokens.tomatoUnripe : "#fb923c", alpha * 0.58));
    gradient.addColorStop(1, "rgba(239, 68, 68, 0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(sample.x, sample.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  renderReplayTrace(context, visibleSamples, fade, isLight ? tokens.textPrimary : tokens.cream, isLight);
  context.restore();
}

function renderReplayTrace(
  context: CanvasRenderingContext2D,
  samples: Array<{ x: number; y: number; dragging: boolean }>,
  fade: number,
  traceColor: string,
  isLight: boolean
) {
  if (samples.length < 2) {
    return;
  }

  context.globalCompositeOperation = "source-over";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = isLight ? 3 : 2.4;
  context.strokeStyle = withAlpha(traceColor, (isLight ? 0.46 : 0.42) * fade);
  context.shadowColor = isLight ? "rgba(229, 72, 72, 0.22)" : "rgba(255, 237, 213, 0.2)";
  context.shadowBlur = isLight ? 5 : 3;
  context.beginPath();

  let started = false;
  for (const sample of samples) {
    if (!sample.dragging) {
      started = false;
      continue;
    }

    if (!started) {
      context.moveTo(sample.x, sample.y);
      started = true;
    } else {
      context.lineTo(sample.x, sample.y);
    }
  }

  context.stroke();
  context.shadowBlur = 0;
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("#")) {
    const normalized = color.replace("#", "");
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }

  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha.toFixed(3)})`);
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}
