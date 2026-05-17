import { puzzleConfig } from "../config/puzzleConfig";
import type { PuzzleBoard } from "../puzzle/puzzleTypes";

export function renderInteractionHeatmap(
  context: CanvasRenderingContext2D,
  board: PuzzleBoard | null
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

  context.save();
  context.fillStyle = "rgba(24, 10, 8, 0.46)";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.globalCompositeOperation = "lighter";

  for (let index = 0; index < visibleSamples.length; index += 1) {
    const sample = visibleSamples[index];
    const ageWeight = 0.45 + (index / visibleSamples.length) * 0.55;
    const alpha = (sample.dragging ? puzzleConfig.heatmapDragAlpha * 1.65 : puzzleConfig.heatmapHoverAlpha * 1.4) * ageWeight * fade;
    const radius = sample.dragging ? puzzleConfig.heatmapPointRadiusPx : puzzleConfig.heatmapPointRadiusPx * 0.7;
    const gradient = context.createRadialGradient(sample.x, sample.y, 0, sample.x, sample.y, radius);

    gradient.addColorStop(0, `rgba(239, 68, 68, ${alpha})`);
    gradient.addColorStop(0.45, `rgba(251, 146, 60, ${alpha * 0.55})`);
    gradient.addColorStop(1, "rgba(239, 68, 68, 0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(sample.x, sample.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  renderReplayTrace(context, visibleSamples, fade);
  context.restore();
}

function renderReplayTrace(
  context: CanvasRenderingContext2D,
  samples: Array<{ x: number; y: number; dragging: boolean }>,
  fade: number
) {
  if (samples.length < 2) {
    return;
  }

  context.globalCompositeOperation = "source-over";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 2.4;
  context.strokeStyle = `rgba(255, 237, 213, ${0.42 * fade})`;
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
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}
