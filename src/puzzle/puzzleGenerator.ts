import { puzzleConfig } from "../config/puzzleConfig";
import type { Snapshot } from "../capture/snapshotTypes";
import type { Rect } from "../tracking/handTypes";
import type { DifficultyState, PuzzleBoard, PuzzleInteractionState, PuzzlePiece } from "./puzzleTypes";

export async function createPuzzleBoardFromSnapshot(
  snapshot: Snapshot,
  canvasWidth: number,
  canvasHeight: number,
  previousDifficulty: DifficultyState | null = null
): Promise<PuzzleBoard> {
  const image = await loadSnapshotImage(snapshot.dataUrl);
  const boardRect = computeBoardRect(snapshot, canvasWidth, canvasHeight);
  const difficulty = calculateDifficulty(snapshot, canvasWidth, canvasHeight, previousDifficulty);
  const sourceArea = computeSourceArea(snapshot, boardRect);
  const pieces = createPieces(sourceArea, boardRect, difficulty.gridSize, difficulty.gridSize);
  const shuffledIndexes = createShuffledIndexes(pieces.length);

  return {
    mode: "transitioning",
    snapshotId: snapshot.id,
    image,
    rows: difficulty.gridSize,
    cols: difficulty.gridSize,
    boardRect,
    pieces: pieces.map((piece, index) => ({
      ...piece,
      currentIndex: shuffledIndexes[index],
      currentRect: cellRectForIndex(shuffledIndexes[index], boardRect, difficulty.gridSize, difficulty.gridSize)
    })),
    interaction: createInitialInteraction(),
    transition: createInitialTransition(difficulty.gridSize),
    difficulty
  };
}

function loadSnapshotImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      image.onload = null;
      image.onerror = null;
      resolve(image);
    };
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("Failed to load snapshot image"));
    };
    image.src = dataUrl;
  });
}

function computeBoardRect(snapshot: Snapshot, canvasWidth: number, canvasHeight: number): Rect {
  return clampRect(snapshot.cropRectCanvas, canvasWidth, canvasHeight);
}

function computeSourceArea(snapshot: Snapshot, boardRect: Rect): Rect {
  const imageAspect = snapshot.width / snapshot.height;
  const boardAspect = boardRect.width / boardRect.height;

  if (puzzleConfig.objectFit === "cover") {
    if (imageAspect > boardAspect) {
      const width = snapshot.height * boardAspect;
      return {
        x: (snapshot.width - width) / 2,
        y: 0,
        width,
        height: snapshot.height
      };
    }

    const height = snapshot.width / boardAspect;
    return {
      x: 0,
      y: (snapshot.height - height) / 2,
      width: snapshot.width,
      height
    };
  }

  return {
    x: 0,
    y: 0,
    width: snapshot.width,
    height: snapshot.height
  };
}

function createPieces(sourceArea: Rect, boardRect: Rect, rows: number, cols: number): PuzzlePiece[] {
  const sourceCellWidth = sourceArea.width / cols;
  const sourceCellHeight = sourceArea.height / rows;
  const pieces: PuzzlePiece[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const originalIndex = row * cols + col;
      const correctRect = cellRectForIndex(originalIndex, boardRect, rows, cols);

      pieces.push({
        id: `piece-${originalIndex}`,
        originalIndex,
        currentIndex: originalIndex,
        row,
        col,
        sourceRect: {
          x: sourceArea.x + col * sourceCellWidth,
          y: sourceArea.y + row * sourceCellHeight,
          width: sourceCellWidth,
          height: sourceCellHeight
        },
        correctRect,
        currentRect: correctRect,
        locked: false
      });
    }
  }

  return pieces;
}

function cellRectForIndex(index: number, boardRect: Rect, rows: number, cols: number): Rect {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const gap = puzzleConfig.pieceGap;
  const cellWidth = boardRect.width / cols;
  const cellHeight = boardRect.height / rows;

  return {
    x: boardRect.x + col * cellWidth + gap,
    y: boardRect.y + row * cellHeight + gap,
    width: cellWidth - gap * 2,
    height: cellHeight - gap * 2
  };
}

function createShuffledIndexes(length: number) {
  let result = Array.from({ length }, (_, index) => index);

  for (let attempt = 0; attempt < puzzleConfig.shuffleAttempts; attempt += 1) {
    result = shuffle(result);

    if (!isSolved(result)) {
      return result;
    }
  }

  return result.length > 1 ? [result[1], result[0], ...result.slice(2)] : result;
}

function shuffle(values: number[]) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function isSolved(indexes: number[]) {
  return indexes.every((value, index) => value === index);
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createInitialInteraction(): PuzzleInteractionState {
  return {
    selectedPieceId: null,
    activeHandId: null,
    dragPhase: "idle",
    pointer: null,
    rawPointer: null,
    smoothedPointer: null,
    pointerVelocityPxPerSec: 0,
    pointerSmoothingAlpha: 0,
    pointerLagPx: 0,
    grabWindowFrames: 0,
    pointerLostFrames: 0,
    releaseGraceFrames: 0,
    dragOffset: {
      x: 0,
      y: 0
    },
    originCellIndex: null,
    hoveredPieceId: null,
    lastSnapPieceId: null,
    lastSnapAt: 0,
    snapPreview: null,
    snapDistancePx: null,
    nearestCellIndex: null,
    completed: false,
    completedAt: 0,
    heatmapReplayMode: "hidden",
    heatmapReplayStartedAt: 0,
    pointerHistory: {
      samples: [],
      maxSamples: puzzleConfig.pointerHistoryMaxSamples
    }
  };
}

function createInitialTransition(gridSize: number) {
  const startedAt = performance.now();
  const completedAt =
    startedAt +
    puzzleConfig.transitionGridMs +
    puzzleConfig.transitionPopMs +
    puzzleConfig.transitionShuffleMs +
    puzzleConfig.transitionStaggerMs * (gridSize * gridSize - 1);

  return {
    phase: "captured" as const,
    startedAt,
    gridDurationMs: puzzleConfig.transitionGridMs,
    popDurationMs: puzzleConfig.transitionPopMs,
    shuffleDurationMs: puzzleConfig.transitionShuffleMs,
    staggerMs: puzzleConfig.transitionStaggerMs,
    completedAt
  };
}

function calculateDifficulty(
  snapshot: Snapshot,
  canvasWidth: number,
  canvasHeight: number,
  previous: DifficultyState | null
): DifficultyState {
  const captureAreaRatio = (snapshot.cropRectCanvas.width * snapshot.cropRectCanvas.height) /
    Math.max(canvasWidth * canvasHeight, 1);
  let score = getCaptureAreaScore(captureAreaRatio);
  let reason: DifficultyState["reason"] =
    score <= 2 ? "small-capture" : score >= 4 ? "large-capture" : "medium-capture";

  if (snapshot.trackingJitterPx >= puzzleConfig.highJitterPx || snapshot.gestureConfidence <= puzzleConfig.lowGestureConfidence) {
    score -= 1;
    reason = "low-stability";
  } else if (snapshot.gestureConfidence >= puzzleConfig.highGestureConfidence) {
    score += 0.5;
    reason = "high-confidence";
  }

  score = clamp(score, puzzleConfig.minGridSize, puzzleConfig.maxGridSize);
  const smoothedScore = previous
    ? previous.smoothedScore * puzzleConfig.difficultySmoothingAlpha + score * (1 - puzzleConfig.difficultySmoothingAlpha)
    : score;
  const gridSize = Math.round(clamp(smoothedScore, puzzleConfig.minGridSize, puzzleConfig.maxGridSize));

  return {
    gridSize,
    score,
    smoothedScore,
    captureAreaRatio,
    gestureConfidence: snapshot.gestureConfidence,
    trackingJitterPx: snapshot.trackingJitterPx,
    reason
  };
}

function getCaptureAreaScore(areaRatio: number) {
  if (areaRatio < puzzleConfig.smallCaptureAreaRatio) {
    return 2;
  }

  if (areaRatio > puzzleConfig.largeCaptureAreaRatio) {
    return 4;
  }

  return 3;
}
