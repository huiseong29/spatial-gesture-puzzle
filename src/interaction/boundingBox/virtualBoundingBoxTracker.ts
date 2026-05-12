import { boundingBoxConfig } from "../../config/boundingBoxConfig";
import { pinchConfig } from "../../config/gestureConfig";
import type { PinchGestureState } from "../gestures/pinchTypes";
import type { Rect, ScreenPoint, TrackedHand } from "../../tracking/handTypes";
import type { VirtualBoundingBox } from "./boundingBoxTypes";

type UpdateOptions = {
  leftHand: TrackedHand | null;
  rightHand: TrackedHand | null;
  pinchGestures: Map<string, PinchGestureState>;
  canvasWidth: number;
  canvasHeight: number;
  timestamp: number;
};

type PinchCornerPair = {
  cornerA: ScreenPoint;
  cornerB: ScreenPoint;
  bothEditing: boolean;
  distancePx: number;
};

export class VirtualBoundingBoxTracker {
  private box: VirtualBoundingBox | null = null;

  update(options: UpdateOptions): VirtualBoundingBox | null {
    const hands = [options.leftHand, options.rightHand].filter((hand): hand is TrackedHand =>
      Boolean(hand)
    );

    if (hands.length < 2) {
      return this.updateLost(options.timestamp);
    }

    const pair = getPinchCornerPair(hands[0], hands[1], options.pinchGestures);
    const previousRect = this.box?.smoothedRect ?? createInitialRect(pair);
    const shouldEdit = pair.bothEditing;
    const editInactiveFrameCount = shouldEdit ? 0 : (this.box?.editInactiveFrameCount ?? 0) + 1;
    const keepEditing =
      this.box?.mode === "editing" &&
      editInactiveFrameCount <= boundingBoxConfig.editExitToleranceFrames;
    const mode = shouldEdit || keepEditing ? "editing" : "idle";
    const editCompletedAt =
      this.box?.mode === "editing" && mode === "idle"
        ? options.timestamp
        : this.box?.editCompletedAt ?? 0;

    const rawRect = shouldEdit
      ? normalizeBoxFromCorners(pair.cornerA, pair.cornerB, options.canvasWidth, options.canvasHeight)
      : previousRect;
    const smoothedRect = this.box ? smoothRect(this.box.smoothedRect, rawRect) : rawRect;
    const clampedSmoothedRect = clampRect(smoothedRect, options.canvasWidth, options.canvasHeight);
    const confirmedRect =
      mode === "idle" ? clampedSmoothedRect : this.box?.confirmedRect ?? clampedSmoothedRect;

    this.box = {
      active: true,
      mode,
      rawRect,
      smoothedRect: clampedSmoothedRect,
      confirmedRect,
      cornerA: pair.cornerA,
      cornerB: pair.cornerB,
      center: rectCenter(clampedSmoothedRect),
      rawCenter: rectCenter(rawRect),
      cornerDistancePx: pair.distancePx,
      lostFrameCount: 0,
      editInactiveFrameCount: mode === "editing" ? editInactiveFrameCount : 0,
      editCompletedAt,
      updatedAt: options.timestamp
    };

    return this.box;
  }

  reset() {
    this.box = null;
  }

  private updateLost(timestamp: number): VirtualBoundingBox | null {
    if (!this.box) {
      return null;
    }

    const lostFrameCount = this.box.lostFrameCount + 1;
    const active = lostFrameCount <= boundingBoxConfig.lostToleranceFrames;

    this.box = {
      ...this.box,
      active,
      mode: "idle",
      confirmedRect: this.box.smoothedRect,
      lostFrameCount,
      editInactiveFrameCount: 0,
      editCompletedAt: this.box.mode === "editing" ? timestamp : this.box.editCompletedAt,
      updatedAt: timestamp
    };

    return this.box;
  }
}

function getPinchCornerPair(
  handA: TrackedHand,
  handB: TrackedHand,
  gestures: Map<string, PinchGestureState>
): PinchCornerPair {
  const cornerA = getPinchPoint(handA);
  const cornerB = getPinchPoint(handB);
  const gestureA = gestures.get(handA.id);
  const gestureB = gestures.get(handB.id);

  return {
    cornerA,
    cornerB,
    bothEditing: Boolean(isEditPinch(gestureA) && isEditPinch(gestureB)),
    distancePx: distance(cornerA, cornerB)
  };
}

function isEditPinch(gesture: PinchGestureState | undefined) {
  return gesture?.phase === "pinch-hold";
}

function getPinchPoint(hand: TrackedHand): ScreenPoint {
  const thumbTip = hand.points[pinchConfig.thumbTipIndex];
  const indexTip = hand.points[pinchConfig.indexTipIndex];
  return midpoint(thumbTip, indexTip);
}

function normalizeBoxFromCorners(
  cornerA: ScreenPoint,
  cornerB: ScreenPoint,
  canvasWidth: number,
  canvasHeight: number
): Rect {
  const minX = Math.min(cornerA.x, cornerB.x);
  const maxX = Math.max(cornerA.x, cornerB.x);
  const minY = Math.min(cornerA.y, cornerB.y);
  const maxY = Math.max(cornerA.y, cornerB.y);
  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: 0
  };
  const maxWidth = canvasWidth * boundingBoxConfig.maxWidthRatio;
  const maxHeight = canvasHeight * boundingBoxConfig.maxHeightRatio;
  const width = clamp(maxX - minX, boundingBoxConfig.minWidth, maxWidth);
  const height = clamp(maxY - minY, boundingBoxConfig.minHeight, maxHeight);

  return clampRect(
    {
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height
    },
    canvasWidth,
    canvasHeight
  );
}

function createInitialRect(pair: PinchCornerPair): Rect {
  const center = midpoint(pair.cornerA, pair.cornerB);
  return {
    x: center.x - boundingBoxConfig.initialWidth / 2,
    y: center.y - boundingBoxConfig.initialHeight / 2,
    width: boundingBoxConfig.initialWidth,
    height: boundingBoxConfig.initialHeight
  };
}

function smoothRect(previous: Rect, current: Rect): Rect {
  const alpha = boundingBoxConfig.smoothingAlpha;

  return {
    x: previous.x * alpha + current.x * (1 - alpha),
    y: previous.y * alpha + current.y * (1 - alpha),
    width: previous.width * alpha + current.width * (1 - alpha),
    height: previous.height * alpha + current.height * (1 - alpha)
  };
}

function clampRect(rect: Rect, canvasWidth: number, canvasHeight: number): Rect {
  const width = Math.min(rect.width, canvasWidth);
  const height = Math.min(rect.height, canvasHeight);

  return {
    x: clamp(rect.x, 0, canvasWidth - width),
    y: clamp(rect.y, 0, canvasHeight - height),
    width,
    height
  };
}

function rectCenter(rect: Rect): ScreenPoint {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    z: 0
  };
}

function midpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2
  };
}

function distance(a: ScreenPoint, b: ScreenPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
