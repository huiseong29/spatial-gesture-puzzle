import type { HandLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { coordinateConfig } from "../config/coordinateConfig";
import { trackingStabilityConfig } from "../config/trackingStabilityConfig";
import type { Handedness, ScreenPoint, TrackedHand, TrackingFrame } from "./handTypes";
import { smoothLandmarks } from "./smoothing";

type NormalizeHandResultsOptions = {
  result: HandLandmarkerResult;
  timestamp: number;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  previousFrame: TrackingFrame | null;
};

export function normalizeHandResults(options: NormalizeHandResultsOptions): TrackingFrame {
  const previousHands = options.previousFrame?.hands ?? [];
  const matchedPreviousIds = new Set<string>();
  const detections = options.result.landmarks.map((landmarks, index) => {
    const handedness = readHandedness(options.result, index);
    const rawLandmarks = landmarks.map((landmark) => normalizeLandmark(landmark));
    const rawPoints = rawLandmarks.map((landmark) =>
      toScreenPoint(landmark, options.canvas.width, options.canvas.height)
    );

    return {
      index,
      handedness: handedness.label,
      handednessScore: handedness.score,
      rawLandmarks,
      rawPoints,
      rawCenter: computeCenter(rawPoints)
    };
  });

  const hands = detections.flatMap((detection) => {
    const previousHand = findNearestPreviousHand(detection.rawCenter, previousHands, matchedPreviousIds);
    const jumpDistancePx = previousHand ? distance(detection.rawCenter, previousHand.center) : 0;
    const rejectedReason = getRejectedReason(detection.handednessScore, jumpDistancePx, previousHand);

    if (previousHand) {
      matchedPreviousIds.add(previousHand.id);
    }

    if (rejectedReason) {
      const frozen = previousHand
        ? freezePreviousHand(previousHand, options.timestamp, rejectedReason)
        : null;
      return frozen ? [frozen] : [];
    }

    const smoothedLandmarks = smoothLandmarks(detection.rawLandmarks, previousHand?.smoothedLandmarks);
    const points = smoothedLandmarks.map((landmark) =>
      toScreenPoint(landmark, options.canvas.width, options.canvas.height)
    );

    return [
      createTrackedHand({
        index: detection.index,
        id: previousHand?.id ?? createInitialHandId(detection.handedness, detection.index),
        handedness: detection.handedness,
        handednessScore: detection.handednessScore,
        rawLandmarks: detection.rawLandmarks,
        smoothedLandmarks,
        rawPoints: detection.rawPoints,
        points,
        previousHand,
        jumpDistancePx,
        timestamp: options.timestamp
      })
    ];
  });

  for (const previousHand of previousHands) {
    if (matchedPreviousIds.has(previousHand.id)) {
      continue;
    }

    const frozen = freezePreviousHand(previousHand, options.timestamp, "lost");
    if (frozen) {
      hands.push(frozen);
    }
  }

  return {
    timestamp: options.timestamp,
    profile: options.previousFrame?.profile ?? {
      detectMs: 0,
      normalizeMs: 0,
      interactionMs: 0,
      renderMs: 0,
      totalMs: 0
    },
    hands,
    pinchGestures: options.previousFrame?.pinchGestures ?? new Map(),
    virtualBoundingBox: options.previousFrame?.virtualBoundingBox ?? null,
    capture: options.previousFrame?.capture ?? null,
    puzzle: options.previousFrame?.puzzle ?? null,
    leftHand: hands.find((hand) => hand.handedness === "Left") ?? null,
    rightHand: hands.find((hand) => hand.handedness === "Right") ?? null,
    rawVideoSize: {
      width: options.video.videoWidth,
      height: options.video.videoHeight
    },
    canvasSize: {
      width: options.canvas.width,
      height: options.canvas.height
    }
  };
}

function readHandedness(result: HandLandmarkerResult, index: number): { label: Handedness; score: number } {
  const category = result.handedness[index]?.[0];
  const rawLabel = category?.categoryName;
  let label: Handedness = rawLabel === "Left" || rawLabel === "Right" ? rawLabel : "Unknown";

  if (coordinateConfig.swapHandednessWhenNeeded && label !== "Unknown") {
    label = label === "Left" ? "Right" : "Left";
  }

  return {
    label,
    score: category?.score ?? 0
  };
}

function normalizeLandmark(landmark: NormalizedLandmark): NormalizedLandmark {
  const x = coordinateConfig.useViewerSpace ? 1 - landmark.x : landmark.x;

  return {
    x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility
  };
}

function toScreenPoint(landmark: NormalizedLandmark, width: number, height: number): ScreenPoint {
  return {
    x: landmark.x * width,
    y: landmark.y * height,
    z: landmark.z
  };
}

function createTrackedHand(options: {
  index: number;
  id: string;
  handedness: Handedness;
  handednessScore: number;
  rawLandmarks: NormalizedLandmark[];
  smoothedLandmarks: NormalizedLandmark[];
  rawPoints: ScreenPoint[];
  points: ScreenPoint[];
  previousHand: TrackedHand | undefined;
  jumpDistancePx: number;
  timestamp: number;
}): TrackedHand {
  const boundingRect = computeBoundingRect(options.points);
  const center = computeCenter(options.points);
  const stableFrameCount = (options.previousHand?.stableFrameCount ?? 0) + 1;
  const trackingState =
    stableFrameCount >= trackingStabilityConfig.stableFramesRequired ? "stable" : "warming";

  return {
    id: options.id,
    handedness: options.handedness,
    handednessScore: options.handednessScore,
    trackingState,
    trackingQuality: options.handednessScore,
    stableFrameCount,
    lostFrameCount: 0,
    rejectedFrameCount: 0,
    jumpDistancePx: options.jumpDistancePx,
    rejectedReason: null,
    rawLandmarks: options.rawLandmarks,
    smoothedLandmarks: options.smoothedLandmarks,
    rawPoints: options.rawPoints,
    points: options.points,
    center,
    boundingRect,
    visible: true,
    lastSeenAt: options.timestamp
  };
}

function findNearestPreviousHand(
  center: ScreenPoint,
  previousHands: TrackedHand[],
  matchedPreviousIds: Set<string>
) {
  let bestHand: TrackedHand | undefined;
  let bestDistance = Infinity;

  for (const previousHand of previousHands) {
    if (matchedPreviousIds.has(previousHand.id)) {
      continue;
    }

    const centerDistance = distance(center, previousHand.center);
    if (centerDistance < bestDistance) {
      bestHand = previousHand;
      bestDistance = centerDistance;
    }
  }

  return bestDistance <= trackingStabilityConfig.outlierRejectThresholdPx ? bestHand : undefined;
}

function getRejectedReason(
  handednessScore: number,
  jumpDistancePx: number,
  previousHand: TrackedHand | undefined
): TrackedHand["rejectedReason"] {
  if (handednessScore < trackingStabilityConfig.minHandScore) {
    return "low-score";
  }

  if (previousHand && jumpDistancePx > trackingStabilityConfig.maxJumpPx) {
    return "jump-outlier";
  }

  return null;
}

function freezePreviousHand(
  previousHand: TrackedHand,
  timestamp: number,
  rejectedReason: NonNullable<TrackedHand["rejectedReason"]>
): TrackedHand | null {
  const lostFrameCount = previousHand.lostFrameCount + 1;
  const rejectedFrameCount = previousHand.rejectedFrameCount + 1;

  if (
    lostFrameCount > trackingStabilityConfig.lostToleranceFrames ||
    rejectedFrameCount > trackingStabilityConfig.freezeOnUnstableFrames
  ) {
    return null;
  }

  return {
    ...previousHand,
    trackingState: "frozen",
    visible: false,
    lostFrameCount,
    rejectedFrameCount,
    rejectedReason,
    lastSeenAt: timestamp
  };
}

function createInitialHandId(handedness: Handedness, index: number) {
  return handedness === "Unknown" ? `hand-${index}` : handedness;
}

function computeBoundingRect(points: ScreenPoint[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function computeCenter(points: ScreenPoint[]): ScreenPoint {
  const sum = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      acc.z += point.z;
      return acc;
    },
    { x: 0, y: 0, z: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
    z: sum.z / points.length
  };
}

function distance(a: ScreenPoint, b: ScreenPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
