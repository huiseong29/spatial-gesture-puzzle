import { HAND_CONNECTIONS, LANDMARK_LABELS } from "../config/skeleton";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { Handedness, TrackedHand } from "../tracking/handTypes";

const COLORS: Record<Handedness, { line: string; point: string; accent: string }> = {
  Left: {
    line: "rgba(45, 212, 191, 0.9)",
    point: "rgba(153, 246, 228, 0.95)",
    accent: "rgba(20, 184, 166, 1)"
  },
  Right: {
    line: "rgba(251, 146, 60, 0.9)",
    point: "rgba(254, 215, 170, 0.95)",
    accent: "rgba(249, 115, 22, 1)"
  },
  Unknown: {
    line: "rgba(203, 213, 225, 0.85)",
    point: "rgba(226, 232, 240, 0.95)",
    accent: "rgba(148, 163, 184, 1)"
  }
};

export function renderSkeleton(
  context: CanvasRenderingContext2D,
  hand: TrackedHand,
  pinch?: PinchGestureState
) {
  const colors = COLORS[hand.handedness];

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 4;
  context.strokeStyle = colors.line;

  for (const [from, to] of HAND_CONNECTIONS) {
    const start = hand.points[from];
    const end = hand.points[to];

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  for (let index = 0; index < hand.points.length; index += 1) {
    const point = hand.points[index];
    const isAccent =
      index === LANDMARK_LABELS.wrist ||
      index === LANDMARK_LABELS.thumbTip ||
      index === LANDMARK_LABELS.indexTip;

    context.beginPath();
    context.fillStyle = isAccent ? colors.accent : colors.point;
    context.arc(point.x, point.y, isAccent ? 6 : 4, 0, Math.PI * 2);
    context.fill();
  }

  if (pinch) {
    renderPinchDebug(context, hand, pinch);
  }

  renderHandLabel(context, hand);
  context.restore();
}

function renderPinchDebug(
  context: CanvasRenderingContext2D,
  hand: TrackedHand,
  pinch: PinchGestureState
) {
  const thumbTip = hand.points[LANDMARK_LABELS.thumbTip];
  const indexTip = hand.points[LANDMARK_LABELS.indexTip];
  const midpoint = {
    x: (thumbTip.x + indexTip.x) / 2,
    y: (thumbTip.y + indexTip.y) / 2
  };

  context.save();
  context.lineWidth = 3;
  context.strokeStyle = pinch.isPinching ? "rgba(34, 197, 94, 0.95)" : "rgba(248, 250, 252, 0.72)";
  context.beginPath();
  context.moveTo(thumbTip.x, thumbTip.y);
  context.lineTo(indexTip.x, indexTip.y);
  context.stroke();

  context.fillStyle = pinch.isPinching ? "rgba(22, 163, 74, 0.92)" : "rgba(15, 23, 42, 0.74)";
  context.beginPath();
  context.arc(midpoint.x, midpoint.y, pinch.isPinching ? 10 : 7, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function renderHandLabel(context: CanvasRenderingContext2D, hand: TrackedHand) {
  const label = `${hand.handedness} ${Math.round(hand.handednessScore * 100)}%`;
  const x = hand.boundingRect.x;
  const y = Math.max(24, hand.boundingRect.y - 12);

  context.font = "600 18px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  const metrics = context.measureText(label);

  context.fillStyle = "rgba(15, 23, 42, 0.74)";
  context.fillRect(x - 8, y - 16, metrics.width + 16, 32);
  context.fillStyle = "rgba(248, 250, 252, 0.96)";
  context.fillText(label, x, y);
}
