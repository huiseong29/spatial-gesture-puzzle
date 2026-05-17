import type { Rect, ScreenPoint } from "../tracking/handTypes";

export type PuzzleMode = "empty" | "loading" | "ready" | "completed";
export type PuzzleDragPhase = "idle" | "grabbed" | "dragging" | "release-pending" | "pointer-lost";

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
  snapDistancePx: number | null;
  nearestCellIndex: number | null;
  completed: boolean;
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
};
