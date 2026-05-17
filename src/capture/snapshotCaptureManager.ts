import { captureConfig } from "../config/captureConfig";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { TrackingFrame } from "../tracking/handTypes";
import { captureSnapshot } from "./snapshotCropper";
import type { CaptureState } from "./snapshotTypes";

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
        simultaneousDeltaMs: null
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

    if (!captureReady || !simultaneous.matched || !canCapture(options.frame)) {
      this.state = {
        ...this.state,
        phase: captureReady ? "ready" : "idle",
        lockedUntil: 0,
        lastTrigger: "none",
        captureReady,
        readyUntil,
        simultaneousDeltaMs: simultaneous.deltaMs
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
      timestamp: options.timestamp
    });

    if (!snapshot) {
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
      simultaneousDeltaMs: simultaneous.deltaMs
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
    simultaneousDeltaMs: null
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

function canCapture(frame: TrackingFrame) {
  const box = frame.virtualBoundingBox;

  if (!box || !box.active || box.mode !== "idle") {
    return false;
  }

  if (
    box.confirmedRect.width < captureConfig.minCropWidth ||
    box.confirmedRect.height < captureConfig.minCropHeight
  ) {
    return false;
  }

  const gestures = [...frame.pinchGestures.values()];
  return gestures.filter((gesture) => gesture.isPinching).length === 2;
}
