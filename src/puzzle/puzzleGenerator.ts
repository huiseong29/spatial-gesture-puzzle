import { puzzleConfig } from "../config/puzzleConfig";
import type { Snapshot } from "../capture/snapshotTypes";
import type { Rect } from "../tracking/handTypes";
import type { PuzzleBoard, PuzzleInteractionState, PuzzlePiece } from "./puzzleTypes";

export async function createPuzzleBoardFromSnapshot(
  snapshot: Snapshot,
  canvasWidth: number,
  canvasHeight: number
): Promise<PuzzleBoard> {
  const image = await loadSnapshotImage(snapshot.dataUrl);
  const boardRect = computeBoardRect(snapshot, canvasWidth, canvasHeight);
  const sourceArea = computeSourceArea(snapshot, boardRect);
  const pieces = createPieces(sourceArea, boardRect);
  const shuffledIndexes = createShuffledIndexes(pieces.length);

  return {
    mode: "ready",
    snapshotId: snapshot.id,
    image,
    rows: puzzleConfig.rows,
    cols: puzzleConfig.cols,
    boardRect,
    pieces: pieces.map((piece, index) => ({
      ...piece,
      currentIndex: shuffledIndexes[index],
      currentRect: cellRectForIndex(shuffledIndexes[index], boardRect)
    })),
    interaction: createInitialInteraction()
  };
}

function loadSnapshotImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load snapshot image"));
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

function createPieces(sourceArea: Rect, boardRect: Rect): PuzzlePiece[] {
  const sourceCellWidth = sourceArea.width / puzzleConfig.cols;
  const sourceCellHeight = sourceArea.height / puzzleConfig.rows;
  const pieces: PuzzlePiece[] = [];

  for (let row = 0; row < puzzleConfig.rows; row += 1) {
    for (let col = 0; col < puzzleConfig.cols; col += 1) {
      const originalIndex = row * puzzleConfig.cols + col;
      const correctRect = cellRectForIndex(originalIndex, boardRect);

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

function cellRectForIndex(index: number, boardRect: Rect): Rect {
  const row = Math.floor(index / puzzleConfig.cols);
  const col = index % puzzleConfig.cols;
  const gap = puzzleConfig.pieceGap;
  const cellWidth = boardRect.width / puzzleConfig.cols;
  const cellHeight = boardRect.height / puzzleConfig.rows;

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
    pointerLostFrames: 0,
    releaseGraceFrames: 0,
    dragOffset: {
      x: 0,
      y: 0
    },
    hoveredPieceId: null,
    lastSnapPieceId: null,
    snapDistancePx: null,
    completed: false
  };
}
