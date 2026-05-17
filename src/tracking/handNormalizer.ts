import type { HandLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { coordinateConfig } from "../config/coordinateConfig";
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
  const hands = options.result.landmarks.map((landmarks, index) => {
    const handedness = readHandedness(options.result, index);
    const previousHand = findPreviousHand(options.previousFrame, handedness.label, index);
    const rawLandmarks = landmarks.map((landmark) => normalizeLandmark(landmark));
    const smoothedLandmarks = smoothLandmarks(rawLandmarks, previousHand?.smoothedLandmarks);
    const points = smoothedLandmarks.map((landmark) =>
      toScreenPoint(landmark, options.canvas.width, options.canvas.height)
    );

    return createTrackedHand({
      index,
      handedness: handedness.label,
      handednessScore: handedness.score,
      rawLandmarks,
      smoothedLandmarks,
      points,
      timestamp: options.timestamp
    });
  });

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

function findPreviousHand(
  previousFrame: TrackingFrame | null,
  handedness: Handedness,
  fallbackIndex: number
) {
  if (!previousFrame) {
    return undefined;
  }

  if (handedness === "Left") {
    return previousFrame.leftHand ?? previousFrame.hands[fallbackIndex];
  }

  if (handedness === "Right") {
    return previousFrame.rightHand ?? previousFrame.hands[fallbackIndex];
  }

  return previousFrame.hands[fallbackIndex];
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
  handedness: Handedness;
  handednessScore: number;
  rawLandmarks: NormalizedLandmark[];
  smoothedLandmarks: NormalizedLandmark[];
  points: ScreenPoint[];
  timestamp: number;
}): TrackedHand {
  const boundingRect = computeBoundingRect(options.points);
  const center = computeCenter(options.points);

  return {
    id: options.handedness === "Unknown" ? `hand-${options.index}` : options.handedness,
    handedness: options.handedness,
    handednessScore: options.handednessScore,
    rawLandmarks: options.rawLandmarks,
    smoothedLandmarks: options.smoothedLandmarks,
    points: options.points,
    center,
    boundingRect,
    visible: true,
    lastSeenAt: options.timestamp
  };
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
