import { pinchConfig } from "../../config/gestureConfig";
import type { ScreenPoint, TrackedHand } from "../../tracking/handTypes";
import type { PinchGestureState, PinchPhase } from "./pinchTypes";

type InternalPinchState = Omit<
  PinchGestureState,
  | "pinchDistancePx"
  | "handScalePx"
  | "normalizedDistance"
  | "startThreshold"
  | "releaseThreshold"
  | "lastUpdatedAt"
>;

export class PinchDetector {
  private readonly states = new Map<string, InternalPinchState>();

  update(hands: TrackedHand[], timestamp: number) {
    const visibleHandIds = new Set(hands.map((hand) => hand.id));
    const gestures = new Map<string, PinchGestureState>();

    for (const hand of hands) {
      gestures.set(hand.id, this.updateHand(hand, timestamp));
    }

    for (const handId of this.states.keys()) {
      if (!visibleHandIds.has(handId)) {
        this.states.delete(handId);
      }
    }

    return gestures;
  }

  reset() {
    this.states.clear();
  }

  private updateHand(hand: TrackedHand, timestamp: number): PinchGestureState {
    const measurement = measurePinch(hand);
    const previous = this.states.get(hand.id) ?? createInitialState(hand.id);
    const next = transitionPinchState(previous, measurement.normalizedDistance);

    this.states.set(hand.id, next);

    return {
      ...next,
      pinchDistancePx: measurement.pinchDistancePx,
      handScalePx: measurement.handScalePx,
      normalizedDistance: measurement.normalizedDistance,
      startThreshold: pinchConfig.startThreshold,
      releaseThreshold: pinchConfig.releaseThreshold,
      lastUpdatedAt: timestamp
    };
  }
}

function createInitialState(handId: string): InternalPinchState {
  return {
    handId,
    phase: "not-pinching",
    isPinching: false,
    startedThisFrame: false,
    releasedThisFrame: false,
    stableCloseFrames: 0,
    stableOpenFrames: 0
  };
}

function transitionPinchState(
  previous: InternalPinchState,
  normalizedDistance: number
): InternalPinchState {
  const isClose = normalizedDistance <= pinchConfig.startThreshold;
  const isOpen = normalizedDistance >= pinchConfig.releaseThreshold;

  const stableCloseFrames = isClose ? previous.stableCloseFrames + 1 : 0;
  const stableOpenFrames = isOpen ? previous.stableOpenFrames + 1 : 0;

  let phase: PinchPhase = previous.phase;
  let isPinching = previous.isPinching;
  let startedThisFrame = false;
  let releasedThisFrame = false;

  if (!previous.isPinching && stableCloseFrames >= pinchConfig.startStableFrames) {
    phase = "pinch-start";
    isPinching = true;
    startedThisFrame = true;
  } else if (previous.isPinching && stableOpenFrames >= pinchConfig.releaseStableFrames) {
    phase = "pinch-release";
    isPinching = false;
    releasedThisFrame = true;
  } else if (previous.isPinching) {
    phase = "pinch-hold";
  } else {
    phase = "not-pinching";
  }

  return {
    handId: previous.handId,
    phase,
    isPinching,
    startedThisFrame,
    releasedThisFrame,
    stableCloseFrames,
    stableOpenFrames
  };
}

function measurePinch(hand: TrackedHand) {
  const thumbTip = hand.points[pinchConfig.thumbTipIndex];
  const indexTip = hand.points[pinchConfig.indexTipIndex];
  const wrist = hand.points[pinchConfig.wristIndex];
  const middleMcp = hand.points[pinchConfig.middleMcpIndex];

  const pinchDistancePx = distance(thumbTip, indexTip);
  const handScalePx = Math.max(distance(wrist, middleMcp), pinchConfig.minHandScalePx);

  return {
    pinchDistancePx,
    handScalePx,
    normalizedDistance: pinchDistancePx / handScalePx
  };
}

function distance(a: ScreenPoint, b: ScreenPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
