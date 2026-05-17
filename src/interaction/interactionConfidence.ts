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
  const stableHands = options.hands.filter((hand) => hand.trackingState === "stable");
  const stableRatio = options.hands.length === 0 ? 0 : stableHands.length / options.hands.length;
  const handQuality = stableHands.length > 0
    ? average(stableHands.map((hand) => hand.trackingQuality))
    : 0;
  const jitterPx = stableHands.length > 0
    ? average(stableHands.map((hand) => hand.jumpDistancePx))
    : ripenessConfig.jitterPenaltyPx;
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
    stableHands: stableHands.length,
    gestureConfidence: pinchScore,
    jitterPx,
    lagPx
  };
}

function calculatePinchScore(gestures: Map<string, PinchGestureState>) {
  const activeGestures = [...gestures.values()].filter((gesture) => gesture.isPinching);

  if (activeGestures.length === 0) {
    return 0.35;
  }

  return average(
    activeGestures.map((gesture) => {
      const closeScore = 1 - clamp01(gesture.normalizedDistance / Math.max(gesture.releaseThreshold, 0.001));
      const stabilityScore = clamp01((gesture.stableCloseFrames + gesture.stableOpenFrames) / 8);
      return closeScore * 0.72 + stabilityScore * 0.28;
    })
  );
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}
