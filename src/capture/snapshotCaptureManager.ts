import { captureConfig } from "../config/captureConfig";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { TrackingFrame } from "../tracking/handTypes";
import { captureSnapshot } from "./snapshotCropper";
import type { CaptureFailureReason, CaptureState } from "./snapshotTypes";

type UpdateOptions = {
  frame: TrackingFrame;
  video: HTMLVideoElement;
  timestamp: number;
};

export class SnapshotCaptureManager {
  private state: CaptureState = createInitialState();
  private readonly lastPinchStartAtByHand = new Map<string, number>();

  update(options: UpdateOptions): CaptureState {
    this.recordPinchStarts(options.frame.pinchGestures, options.timestamp);

    if (options.timestamp < this.state.lockedUntil) {
      this.state = {
        ...this.state,
        phase: "locked",
        lastTrigger: "none",
        captureReady: false,
        simultaneousDeltaMs: null,
        failureReason: "locked"
      };
      return this.state;
    }

    const readyUntil = getReadyUntil(options.frame);
    const captureReady = readyUntil > 0 && options.timestamp <= readyUntil;
    const simultaneous = getSimultaneousPinchStart(
      options.frame,
      this.lastPinchStartAtByHand,
      options.timestamp
    );

    const blockReason = getCaptureBlockReason(options.frame);
    const failureReason = getCaptureFailureReason(captureReady, simultaneous, blockReason);

    if (failureReason !== "none") {
      this.state = {
        ...this.state,
        phase: captureReady ? "ready" : "idle",
        lockedUntil: 0,
        lastTrigger: "none",
        captureReady,
        readyUntil,
        simultaneousDeltaMs: simultaneous.deltaMs,
        failureReason
      };
      return this.state;
    }

    const box = options.frame.virtualBoundingBox;
    if (!box) {
      return this.state;
    }

    const snapshot = captureSnapshot({
      video: options.video,
      canvasWidth: options.frame.canvasSize.width,
      canvasHeight: options.frame.canvasSize.height,
      cropRectCanvas: box.confirmedRect,
      timestamp: options.timestamp,
      gestureConfidence: calculateGestureConfidence(options.frame),
      trackingJitterPx: calculateTrackingJitter(options.frame)
    });

    if (!snapshot) {
      this.state = {
        ...this.state,
        captureReady,
        readyUntil,
        simultaneousDeltaMs: simultaneous.deltaMs,
        failureReason: "crop-failed"
      };
      return this.state;
    }

    this.state = {
      phase: "locked",
      lockedUntil: options.timestamp + captureConfig.cooldownMs,
      lastCapturedAt: options.timestamp,
      latestSnapshot: snapshot,
      lastTrigger: "both-hand-simultaneous-pinch-start",
      captureReady: false,
      readyUntil,
      simultaneousDeltaMs: simultaneous.deltaMs,
      failureReason: "none"
    };

    return this.state;
  }

  isLocked(timestamp: number) {
    return timestamp < this.state.lockedUntil;
  }

  reset() {
    this.state = createInitialState();
    this.lastPinchStartAtByHand.clear();
  }

  clearSnapshot() {
    this.state = createInitialState();
  }

  private recordPinchStarts(gestures: Map<string, PinchGestureState>, timestamp: number) {
    for (const gesture of gestures.values()) {
      if (gesture.startedThisFrame) {
        this.lastPinchStartAtByHand.set(gesture.handId, timestamp);
      }
    }
  }
}

function createInitialState(): CaptureState {
  return {
    phase: "idle",
    lockedUntil: 0,
    lastCapturedAt: 0,
    latestSnapshot: null,
    lastTrigger: "none",
    captureReady: false,
    readyUntil: 0,
    simultaneousDeltaMs: null,
    failureReason: "none"
  };
}

function getReadyUntil(frame: TrackingFrame) {
  const completedAt = frame.virtualBoundingBox?.editCompletedAt ?? 0;
  return completedAt > 0 ? completedAt + captureConfig.captureReadyWindowMs : 0;
}

function getSimultaneousPinchStart(
  frame: TrackingFrame,
  lastPinchStartAtByHand: Map<string, number>,
  timestamp: number
) {
  const [handA, handB] = frame.hands;
  const firstId = handA?.id;
  const secondId = handB?.id;

  if (!firstId || !secondId) {
    return {
      matched: false,
      deltaMs: null
    };
  }

  const firstStartedAt = lastPinchStartAtByHand.get(firstId);
  const secondStartedAt = lastPinchStartAtByHand.get(secondId);

  if (firstStartedAt === undefined || secondStartedAt === undefined) {
    return {
      matched: false,
      deltaMs: null
    };
  }

  const deltaMs = Math.abs(firstStartedAt - secondStartedAt);
  const recentEnough =
    timestamp - Math.max(firstStartedAt, secondStartedAt) <= captureConfig.simultaneousThresholdMs;

  return {
    matched: deltaMs <= captureConfig.simultaneousThresholdMs && recentEnough,
    deltaMs
  };
}

function getCaptureFailureReason(
  captureReady: boolean,
  simultaneous: { matched: boolean; deltaMs: number | null },
  blockReason: CaptureFailureReason
): CaptureFailureReason {
  if (blockReason !== "none") {
    return blockReason;
  }

  if (!captureReady) {
    return "not-ready";
  }

  if (!simultaneous.matched) {
    return simultaneous.deltaMs === null ? "not-ready" : "sim-delta-too-large";
  }

  return "none";
}

function getCaptureBlockReason(frame: TrackingFrame): CaptureFailureReason {
  const box = frame.virtualBoundingBox;

  if (box?.mode === "editing") {
    return "resize-active";
  }

  if (!box || !box.active || box.mode !== "idle") {
    return "no-confirmed-rect";
  }

  if (
    box.confirmedRect.width < captureConfig.minCropWidth ||
    box.confirmedRect.height < captureConfig.minCropHeight
  ) {
    return "no-confirmed-rect";
  }

  let pinchingCount = 0;
  for (const gesture of frame.pinchGestures.values()) {
    if (gesture.isPinching) {
      pinchingCount += 1;
    }

    if (pinchingCount >= 2) {
      return "none";
    }
  }

  return "not-ready";
}

function calculateGestureConfidence(frame: TrackingFrame) {
  const hands = frame.hands.filter((hand) => hand.trackingState === "stable");
  const gestures: PinchGestureState[] = [];
  for (const gesture of frame.pinchGestures.values()) {
    if (gesture.isPinching) {
      gestures.push(gesture);
    }
  }

  if (hands.length === 0 || gestures.length === 0) {
    return 0;
  }

  const trackingQuality = average(hands.map((hand) => hand.trackingQuality));
  const pinchQuality = average(
    gestures.map((gesture) => {
      const normalized = gesture.normalizedDistance / Math.max(gesture.releaseThreshold, 0.001);
      return 1 - clamp(normalized, 0, 1);
    })
  );

  return clamp(trackingQuality * 0.65 + pinchQuality * 0.35, 0, 1);
}

function calculateTrackingJitter(frame: TrackingFrame) {
  const hands = frame.hands.filter((hand) => hand.trackingState === "stable");

  if (hands.length === 0) {
    return 0;
  }

  return average(hands.map((hand) => hand.jumpDistancePx));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
