import { ripenessConfig } from "../config/ripenessConfig";
import type { PinchGestureState } from "./gestures/pinchTypes";
import type { PuzzleBoard } from "../puzzle/puzzleTypes";
import type { InteractionConfidenceState, TrackedHand } from "../tracking/handTypes";

type CalculateInteractionConfidenceOptions = {
  hands: TrackedHand[];
  pinchGestures: Map<string, PinchGestureState>;
  puzzle: PuzzleBoard | null;
  previous: InteractionConfidenceState | null;
};

export function calculateInteractionConfidence(
  options: CalculateInteractionConfidenceOptions
): InteractionConfidenceState {
  let stableHandCount = 0;
  let trackingQualitySum = 0;
  let jumpDistanceSum = 0;

  for (const hand of options.hands) {
    if (hand.trackingState !== "stable") {
      continue;
    }

    stableHandCount += 1;
    trackingQualitySum += hand.trackingQuality;
    jumpDistanceSum += hand.jumpDistancePx;
  }

  const stableRatio = options.hands.length === 0 ? 0 : stableHandCount / options.hands.length;
  const handQuality = stableHandCount > 0 ? trackingQualitySum / stableHandCount : 0;
  const jitterPx = stableHandCount > 0 ? jumpDistanceSum / stableHandCount : ripenessConfig.jitterPenaltyPx;
  const jitterScore = 1 - clamp01(jitterPx / ripenessConfig.jitterPenaltyPx);
  const pinchScore = calculatePinchScore(options.pinchGestures);
  const lagPx = options.puzzle?.interaction.pointerLagPx ?? 0;
  const lagScore = 1 - clamp01(lagPx / ripenessConfig.lagPenaltyPx);
  const rawScore = clamp01(
    handQuality * stableRatio * ripenessConfig.stableHandWeight +
      pinchScore * ripenessConfig.gestureWeight +
      jitterScore * ripenessConfig.jitterWeight +
      lagScore * ripenessConfig.lagWeight
  );
  const score = options.previous
    ? options.previous.score * ripenessConfig.smoothingAlpha + rawScore * (1 - ripenessConfig.smoothingAlpha)
    : rawScore;

  return {
    score,
    ripeness: score,
    stableHands: stableHandCount,
    gestureConfidence: pinchScore,
    jitterPx,
    lagPx
  };
}

function calculatePinchScore(gestures: Map<string, PinchGestureState>) {
  let activeGestureCount = 0;
  let scoreSum = 0;

  for (const gesture of gestures.values()) {
    if (!gesture.isPinching) {
      continue;
    }

    const closeScore = 1 - clamp01(gesture.normalizedDistance / Math.max(gesture.releaseThreshold, 0.001));
    const stabilityScore = clamp01((gesture.stableCloseFrames + gesture.stableOpenFrames) / 8);
    scoreSum += closeScore * 0.72 + stabilityScore * 0.28;
    activeGestureCount += 1;
  }

  return activeGestureCount === 0 ? 0.35 : scoreSum / activeGestureCount;
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}
