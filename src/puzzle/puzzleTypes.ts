import type { Rect, ScreenPoint } from "../tracking/handTypes";

export type PuzzleMode = "empty" | "loading" | "transitioning" | "ready" | "completed";
export type PuzzleDragPhase = "idle" | "grabbed" | "dragging" | "release-pending" | "pointer-lost";
export type PuzzleTransitionPhase = "captured" | "splitting" | "shuffling" | "playable";
export type HeatmapReplayMode = "hidden" | "ready" | "playing" | "finished";

export type PuzzleTransitionState = {
  phase: PuzzleTransitionPhase;
  startedAt: number;
  gridDurationMs: number;
  popDurationMs: number;
  shuffleDurationMs: number;
  staggerMs: number;
  completedAt: number;
};

export type SnapPreview = {
  cellIndex: number;
  cellRect: Rect;
  distancePx: number;
  isCorrect: boolean;
  strength: number;
} | null;

export type DifficultyState = {
  gridSize: number;
  score: number;
  smoothedScore: number;
  captureAreaRatio: number;
  gestureConfidence: number;
  trackingJitterPx: number;
  reason: "small-capture" | "medium-capture" | "large-capture" | "low-stability" | "high-confidence";
};

export type PointerHistorySample = {
  x: number;
  y: number;
  t: number;
  dragging: boolean;
  pieceId: string | null;
};

export type PointerHistory = {
  samples: PointerHistorySample[];
  maxSamples: number;
};

export type PuzzlePiece = {
  id: string;
  originalIndex: number;
  currentIndex: number;
  row: number;
  col: number;
  sourceRect: Rect;
  correctRect: Rect;
  currentRect: Rect;
  locked: boolean;
};

export type PuzzleInteractionState = {
  selectedPieceId: string | null;
  activeHandId: string | null;
  dragPhase: PuzzleDragPhase;
  pointer: ScreenPoint | null;
  rawPointer: ScreenPoint | null;
  smoothedPointer: ScreenPoint | null;
  pointerVelocityPxPerSec: number;
  pointerSmoothingAlpha: number;
  pointerLagPx: number;
  grabWindowFrames: number;
  pointerLostFrames: number;
  releaseGraceFrames: number;
  dragOffset: {
    x: number;
    y: number;
  };
  originCellIndex: number | null;
  hoveredPieceId: string | null;
  lastSnapPieceId: string | null;
  lastSnapAt: number;
  snapPreview: SnapPreview;
  snapDistancePx: number | null;
  nearestCellIndex: number | null;
  completed: boolean;
  completedAt: number;
  heatmapReplayMode: HeatmapReplayMode;
  heatmapReplayStartedAt: number;
  pointerHistory: PointerHistory;
};

export type PuzzleBoard = {
  mode: PuzzleMode;
  snapshotId: string | null;
  image: HTMLImageElement | null;
  rows: number;
  cols: number;
  boardRect: Rect;
  pieces: PuzzlePiece[];
  interaction: PuzzleInteractionState;
  transition: PuzzleTransitionState | null;
  difficulty: DifficultyState;
};
