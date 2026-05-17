import { HAND_CONNECTIONS, LANDMARK_LABELS } from "../config/skeleton";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { Handedness, TrackedHand } from "../tracking/handTypes";

const COLORS: Record<Handedness, { line: string; point: string; accent: string }> = {
  Left: {
    line: "rgba(45, 212, 191, 0.86)",
    point: "rgba(153, 246, 228, 0.9)",
    accent: "rgba(20, 184, 166, 0.96)"
  },
  Right: {
    line: "rgba(96, 165, 250, 0.86)",
    point: "rgba(191, 219, 254, 0.9)",
    accent: "rgba(59, 130, 246, 0.96)"
  },
  Unknown: {
    line: "rgba(203, 213, 225, 0.78)",
    point: "rgba(226, 232, 240, 0.86)",
    accent: "rgba(148, 163, 184, 0.94)"
  }
};

export function renderSkeleton(
  context: CanvasRenderingContext2D,
  hand: TrackedHand,
  pinch?: PinchGestureState
) {
  const colors = COLORS[hand.handedness];
  const opacity = hand.trackingState === "frozen" ? 0.35 : hand.trackingState === "warming" ? 0.58 : 1;

  context.save();
  context.globalAlpha = opacity;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3;
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
    context.arc(point.x, point.y, isAccent ? 5 : 3.5, 0, Math.PI * 2);
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
  context.lineWidth = 2;
  context.strokeStyle = pinch.isPinching ? "rgba(34, 197, 94, 0.92)" : "rgba(226, 232, 240, 0.5)";
  context.beginPath();
  context.moveTo(thumbTip.x, thumbTip.y);
  context.lineTo(indexTip.x, indexTip.y);
  context.stroke();

  context.fillStyle = pinch.isPinching ? "rgba(34, 197, 94, 0.9)" : "rgba(15, 23, 42, 0.68)";
  context.beginPath();
  context.arc(midpoint.x, midpoint.y, pinch.isPinching ? 8 : 6, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function renderHandLabel(context: CanvasRenderingContext2D, hand: TrackedHand) {
  const label = hand.handedness === "Left" ? "Left hand" : hand.handedness === "Right" ? "Right hand" : "Hand";
  const x = hand.boundingRect.x;
  const y = Math.max(24, hand.boundingRect.y - 12);

  context.font = "600 14px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  const metrics = context.measureText(label);

  context.fillStyle = "rgba(15, 23, 42, 0.68)";
  context.fillRect(x - 8, y - 14, metrics.width + 16, 28);
  context.fillStyle = "rgba(226, 232, 240, 0.94)";
  context.fillText(label, x, y);
}
