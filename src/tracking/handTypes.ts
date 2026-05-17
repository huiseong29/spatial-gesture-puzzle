import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { VirtualBoundingBox } from "../interaction/boundingBox/boundingBoxTypes";
import type { CaptureState } from "../capture/snapshotTypes";
import type { PuzzleBoard } from "../puzzle/puzzleTypes";

export type Handedness = "Left" | "Right" | "Unknown";

export type ScreenPoint = {
  x: number;
  y: number;
  z: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TrackedHand = {
  id: string;
  handedness: Handedness;
  handednessScore: number;
  rawLandmarks: NormalizedLandmark[];
  smoothedLandmarks: NormalizedLandmark[];
  points: ScreenPoint[];
  center: ScreenPoint;
  boundingRect: Rect;
  visible: boolean;
  lastSeenAt: number;
};

export type FrameProfile = {
  detectMs: number;
  normalizeMs: number;
  interactionMs: number;
  renderMs: number;
  totalMs: number;
};

export type TrackingFrame = {
  timestamp: number;
  profile: FrameProfile;
  hands: TrackedHand[];
  pinchGestures: Map<string, PinchGestureState>;
  virtualBoundingBox: VirtualBoundingBox | null;
  capture: CaptureState | null;
  puzzle: PuzzleBoard | null;
  leftHand: TrackedHand | null;
  rightHand: TrackedHand | null;
  rawVideoSize: {
    width: number;
    height: number;
  };
  canvasSize: {
    width: number;
    height: number;
  };
};
