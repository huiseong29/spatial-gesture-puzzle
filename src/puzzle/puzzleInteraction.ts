import { pinchConfig } from "../config/gestureConfig";
import { puzzleConfig } from "../config/puzzleConfig";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { Rect, ScreenPoint, TrackedHand } from "../tracking/handTypes";
import type { PuzzleBoard, PuzzleDragPhase, PuzzleInteractionState, PuzzlePiece } from "./puzzleTypes";
import { withCompletionState } from "./puzzleCompletion";

export function updatePuzzleInteraction(
  board: PuzzleBoard,
  hands: TrackedHand[],
  pinchGestures: Map<string, PinchGestureState>
): PuzzleBoard {
  if (board.mode === "completed") {
    return board;
  }

  const hasSelection = Boolean(board.interaction.selectedPieceId);
  const activeHand = selectActiveHand(board, hands, pinchGestures);
  const activeGesture = activeHand ? pinchGestures.get(activeHand.id) : undefined;
  const rawPointer = activeHand ? getPointer(activeHand) : null;
  const pointerLostFrames = hasSelection && !rawPointer ? board.interaction.pointerLostFrames + 1 : 0;
  const dragPointer = resolveDragPointer(board, rawPointer, hasSelection);
  const pointer = dragPointer.pointer;
  let pieces = board.pieces.map((piece) => ({ ...piece }));
  let interaction: PuzzleInteractionState = {
    ...board.interaction,
    activeHandId: hasSelection ? board.interaction.activeHandId : board.interaction.activeHandId,
    pointer,
    rawPointer,
    smoothedPointer: dragPointer.pointer,
    pointerVelocityPxPerSec: dragPointer.velocityPxPerSec,
    pointerSmoothingAlpha: dragPointer.alpha,
    pointerLagPx: dragPointer.lagDistancePx,
    pointerLostFrames,
    hoveredPieceId: !hasSelection && pointer ? hitTestPieceForgiving(pieces, pointer)?.id ?? null : null,
    lastSnapPieceId: null,
    nearestCellIndex: getSelectedNearestCellIndex(board, pieces, board.interaction.selectedPieceId),
    snapDistancePx: getSelectedSnapDistance(pieces, board.interaction.selectedPieceId)
  };

  if (!interaction.selectedPieceId) {
    return handleIdleInteraction({
      board,
      pieces,
      interaction,
      activeHand,
      activeGesture,
      pointer
    });
  }

  if (activeHand && interaction.activeHandId !== activeHand.id) {
    interaction = {
      ...interaction,
      activeHandId: activeHand.id,
      pointerLostFrames: 0
    };
  }

  if (!activeHand || !rawPointer) {
    return handleLockedDragWithoutActivePointer(board, pieces, interaction);
  }

  return handleActiveDrag({
    board,
    pieces,
    interaction,
    gesture: activeGesture,
    pointer
  });
}

function handleIdleInteraction(options: {
  board: PuzzleBoard;
  pieces: PuzzlePiece[];
  interaction: PuzzleInteractionState;
  activeHand: TrackedHand | null;
  activeGesture: PinchGestureState | undefined;
  pointer: ScreenPoint | null;
}) {
  let { pieces, interaction } = options;
  const grabWindowFrames = getNextGrabWindowFrames(interaction.grabWindowFrames, options.activeGesture);
  const canGrab =
    Boolean(options.activeHand && options.pointer && options.activeGesture?.isPinching) && grabWindowFrames > 0;

  if (canGrab && options.activeHand && options.pointer) {
    const hitPiece = hitTestPieceForgiving(pieces, options.pointer);

    if (hitPiece && !hitPiece.locked) {
      interaction = {
        ...interaction,
        selectedPieceId: hitPiece.id,
        activeHandId: options.activeHand.id,
        dragPhase: "grabbed",
        grabWindowFrames: 0,
        pointerLostFrames: 0,
        releaseGraceFrames: 0,
        dragOffset: {
          x: options.pointer.x - hitPiece.currentRect.x,
          y: options.pointer.y - hitPiece.currentRect.y
        },
        originCellIndex: hitPiece.currentIndex,
        nearestCellIndex: hitPiece.currentIndex,
        snapDistancePx: rectDistance(hitPiece.currentRect, hitPiece.correctRect)
      };
    }
  }

  return withCompletionState({
    ...options.board,
    pieces,
    interaction: {
      ...interaction,
      dragPhase: resolveDragPhase(interaction.selectedPieceId, interaction.dragPhase),
      activeHandId: interaction.selectedPieceId || grabWindowFrames > 0 ? interaction.activeHandId ?? options.activeHand?.id ?? null : null,
      grabWindowFrames: interaction.selectedPieceId ? 0 : grabWindowFrames,
      releaseGraceFrames: interaction.selectedPieceId ? interaction.releaseGraceFrames : 0,
      pointerLostFrames: interaction.selectedPieceId ? interaction.pointerLostFrames : 0,
      originCellIndex: interaction.selectedPieceId ? interaction.originCellIndex : null
    }
  });
}

function handleLockedDragWithoutActivePointer(
  board: PuzzleBoard,
  pieces: PuzzlePiece[],
  interaction: PuzzleInteractionState
) {
  if (interaction.pointerLostFrames > puzzleConfig.pointerLostToleranceFrames) {
    return dropAndUnlock(board, pieces, {
      ...interaction,
      dragPhase: "pointer-lost" as const
    });
  }

  return {
    ...board,
    pieces,
    interaction: {
      ...interaction,
      dragPhase: "pointer-lost" as const
    }
  };
}

function handleActiveDrag(options: {
  board: PuzzleBoard;
  pieces: PuzzlePiece[];
  interaction: PuzzleInteractionState;
  gesture: PinchGestureState | undefined;
  pointer: ScreenPoint | null;
}) {
  let { pieces, interaction } = options;
  const selectedPieceId = interaction.selectedPieceId;

  if (!selectedPieceId) {
    return {
      ...options.board,
      pieces,
      interaction
    };
  }

  if (options.pointer) {
    pieces = moveSelectedPiece(pieces, selectedPieceId, {
      x: options.pointer.x - interaction.dragOffset.x,
      y: options.pointer.y - interaction.dragOffset.y
    });
  }

  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId);
  const releaseGraceFrames = !options.gesture || !options.gesture.isPinching || options.gesture.releasedThisFrame
    ? interaction.releaseGraceFrames + 1
    : 0;
  const nearestCellIndex = selectedPiece ? findNearestDroppableCellIndex(options.board, pieces, selectedPiece) : null;
  const snapDistancePx = selectedPiece ? rectDistance(selectedPiece.currentRect, selectedPiece.correctRect) : null;

  interaction = {
    ...interaction,
    releaseGraceFrames,
    nearestCellIndex,
    snapDistancePx,
    dragPhase: releaseGraceFrames > 0 ? "release-pending" : "dragging"
  };

  if (interaction.pointerLostFrames > puzzleConfig.pointerLostToleranceFrames) {
    return dropAndUnlock(options.board, pieces, {
      ...interaction,
      dragPhase: "pointer-lost"
    });
  }

  if (releaseGraceFrames >= puzzleConfig.dragReleaseGraceFrames) {
    return dropAndUnlock(options.board, pieces, interaction);
  }

  return {
    ...options.board,
    pieces,
    interaction
  };
}

function dropAndUnlock(board: PuzzleBoard, pieces: PuzzlePiece[], interaction: PuzzleInteractionState) {
  if (!interaction.selectedPieceId) {
    return {
      ...board,
      pieces,
      interaction
    };
  }

  const dropResult = dropSelectedPiece(board, pieces, interaction.selectedPieceId, interaction.originCellIndex);

  return withCompletionState({
    ...board,
    pieces: dropResult.pieces,
    interaction: {
      ...interaction,
      selectedPieceId: null,
      activeHandId: null,
      dragPhase: "idle",
      grabWindowFrames: 0,
      pointerLostFrames: 0,
      releaseGraceFrames: 0,
      dragOffset: {
        x: 0,
        y: 0
      },
      originCellIndex: null,
      lastSnapPieceId: dropResult.snappedPieceId,
      nearestCellIndex: dropResult.nearestCellIndex,
      snapDistancePx: dropResult.snapDistancePx
    }
  });
}

function selectActiveHand(
  board: PuzzleBoard,
  hands: TrackedHand[],
  pinchGestures: Map<string, PinchGestureState>
) {
  const { interaction } = board;

  if (interaction.selectedPieceId && interaction.activeHandId) {
    const exact = hands.find((hand) => hand.id === interaction.activeHandId);
    if (exact) {
      return exact;
    }

    return null;
  }

  if (interaction.activeHandId && interaction.grabWindowFrames > 0) {
    const windowHand = hands.find((hand) => hand.id === interaction.activeHandId);
    const windowGesture = windowHand ? pinchGestures.get(windowHand.id) : undefined;
    if (windowHand && windowGesture?.isPinching) {
      return windowHand;
    }
  }

  return (
    hands.find((hand) => {
      const gesture = pinchGestures.get(hand.id);
      return Boolean(gesture?.startedThisFrame);
    }) ?? null
  );
}

function getPointer(hand: TrackedHand): ScreenPoint {
  const pointerPoints = hand.rawPoints.length > 0 ? hand.rawPoints : hand.points;
  const thumbTip = pointerPoints[pinchConfig.thumbTipIndex];
  const indexTip = pointerPoints[pinchConfig.indexTipIndex];

  return {
    x: (thumbTip.x + indexTip.x) / 2,
    y: (thumbTip.y + indexTip.y) / 2,
    z: (thumbTip.z + indexTip.z) / 2
  };
}

function resolveDragPointer(board: PuzzleBoard, rawPointer: ScreenPoint | null, hasSelection: boolean) {
  if (!rawPointer) {
    return {
      pointer: board.interaction.smoothedPointer ?? board.interaction.pointer,
      velocityPxPerSec: 0,
      alpha: board.interaction.pointerSmoothingAlpha,
      lagDistancePx: board.interaction.pointerLagPx
    };
  }

  if (!hasSelection) {
    return {
      pointer: rawPointer,
      velocityPxPerSec: 0,
      alpha: 0,
      lagDistancePx: 0
    };
  }

  return adaptiveSmoothPointer(board.interaction.smoothedPointer, rawPointer);
}

function adaptiveSmoothPointer(previous: ScreenPoint | null, current: ScreenPoint) {
  if (!previous) {
    return {
      pointer: current,
      velocityPxPerSec: 0,
      alpha: puzzleConfig.dragPointerFastAlpha,
      lagDistancePx: 0
    };
  }

  const velocityPxPerSec = distance(previous, current) * 60;

  if (velocityPxPerSec >= puzzleConfig.dragPointerVelocityThreshold) {
    return {
      pointer: current,
      velocityPxPerSec,
      alpha: 0,
      lagDistancePx: 0
    };
  }

  const t = clamp(velocityPxPerSec / puzzleConfig.dragPointerVelocityThreshold, 0, 1);
  const alpha = lerp(puzzleConfig.dragPointerSlowAlpha, puzzleConfig.dragPointerFastAlpha, t);
  const pointer = {
    x: previous.x * alpha + current.x * (1 - alpha),
    y: previous.y * alpha + current.y * (1 - alpha),
    z: current.z
  };

  return {
    pointer,
    velocityPxPerSec,
    alpha,
    lagDistancePx: distance(current, pointer)
  };
}

function getNextGrabWindowFrames(currentFrames: number, gesture: PinchGestureState | undefined) {
  if (gesture?.startedThisFrame) {
    return puzzleConfig.grabStartWindowFrames;
  }

  if (gesture?.isPinching) {
    return Math.max(0, currentFrames - 1);
  }

  return 0;
}

function hitTestPieceForgiving(pieces: PuzzlePiece[], pointer: ScreenPoint) {
  let bestPiece: PuzzlePiece | null = null;
  let bestDistance = Infinity;

  for (const piece of [...pieces].reverse()) {
    if (piece.locked) {
      continue;
    }

    const center = rectCenter(piece.currentRect);
    const centerDistance = distance(center, pointer);
    const radius = Math.max(piece.currentRect.width, piece.currentRect.height) * puzzleConfig.centerGrabRadiusRatio;
    const paddedHit = containsPoint(expandRect(piece.currentRect, puzzleConfig.hitPaddingPx), pointer);
    const centerHit = centerDistance <= radius;

    if ((paddedHit || centerHit) && centerDistance < bestDistance) {
      bestPiece = piece;
      bestDistance = centerDistance;
    }
  }

  return bestPiece;
}

function moveSelectedPiece(pieces: PuzzlePiece[], pieceId: string, position: { x: number; y: number }) {
  return pieces.map((piece) =>
    piece.id === pieceId
      ? {
          ...piece,
          currentRect: {
            ...piece.currentRect,
            x: position.x,
            y: position.y
          }
        }
      : piece
  );
}

function dropSelectedPiece(
  board: PuzzleBoard,
  pieces: PuzzlePiece[],
  pieceId: string,
  originCellIndex: number | null
) {
  const selectedPiece = pieces.find((piece) => piece.id === pieceId);

  if (!selectedPiece) {
    return {
      pieces,
      snappedPieceId: null,
      nearestCellIndex: null,
      snapDistancePx: null
    };
  }

  const nearestCellIndex = findNearestDroppableCellIndex(board, pieces, selectedPiece);
  const targetCellIndex = nearestCellIndex ?? originCellIndex ?? selectedPiece.currentIndex;
  const targetCellRect = cellRectForIndex(targetCellIndex, board.boardRect, board.rows, board.cols);
  const occupier = pieces.find(
    (piece) => piece.id !== pieceId && !piece.locked && piece.currentIndex === targetCellIndex
  );
  const snapDistancePx = rectDistance(targetCellRect, selectedPiece.correctRect);
  const shouldLock = targetCellIndex === selectedPiece.originalIndex || snapDistancePx <= puzzleConfig.snapThresholdPx;
  let snappedPieceId: string | null = shouldLock ? selectedPiece.id : null;

  const nextPieces = pieces.map((piece) => {
    if (piece.id === pieceId) {
      return {
        ...piece,
        currentIndex: shouldLock ? piece.originalIndex : targetCellIndex,
        currentRect: shouldLock ? { ...piece.correctRect } : targetCellRect,
        locked: shouldLock
      };
    }

    if (occupier && piece.id === occupier.id && originCellIndex !== null) {
      const originRect = cellRectForIndex(originCellIndex, board.boardRect, board.rows, board.cols);
      const occupierLocks = originCellIndex === piece.originalIndex;

      if (occupierLocks) {
        snappedPieceId = snappedPieceId ?? piece.id;
      }

      return {
        ...piece,
        currentIndex: originCellIndex,
        currentRect: occupierLocks ? { ...piece.correctRect } : originRect,
        locked: occupierLocks
      };
    }

    return piece;
  });

  return {
    pieces: nextPieces,
    snappedPieceId,
    nearestCellIndex: targetCellIndex,
    snapDistancePx
  };
}

function findNearestDroppableCellIndex(board: PuzzleBoard, pieces: PuzzlePiece[], selectedPiece: PuzzlePiece) {
  const center = rectCenter(selectedPiece.currentRect);
  let bestIndex: number | null = null;
  let bestDistance = Infinity;

  for (let index = 0; index < board.rows * board.cols; index += 1) {
    if (isLockedCell(pieces, index, selectedPiece.id)) {
      continue;
    }

    const cellCenter = rectCenter(cellRectForIndex(index, board.boardRect, board.rows, board.cols));
    const cellDistance = distance(center, cellCenter);

    if (cellDistance < bestDistance) {
      bestIndex = index;
      bestDistance = cellDistance;
    }
  }

  return bestIndex;
}

function isLockedCell(pieces: PuzzlePiece[], cellIndex: number, selectedPieceId: string) {
  return pieces.some((piece) => piece.id !== selectedPieceId && piece.locked && piece.currentIndex === cellIndex);
}

function getSelectedNearestCellIndex(board: PuzzleBoard, pieces: PuzzlePiece[], selectedPieceId: string | null) {
  if (!selectedPieceId) {
    return null;
  }

  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId);
  return selectedPiece ? findNearestDroppableCellIndex(board, pieces, selectedPiece) : null;
}

function getSelectedSnapDistance(pieces: PuzzlePiece[], selectedPieceId: string | null) {
  if (!selectedPieceId) {
    return null;
  }

  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId);
  return selectedPiece ? rectDistance(selectedPiece.currentRect, selectedPiece.correctRect) : null;
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

function containsPoint(rect: Rect, point: ScreenPoint) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function expandRect(rect: Rect, paddingPx: number): Rect {
  return {
    x: rect.x - paddingPx,
    y: rect.y - paddingPx,
    width: rect.width + paddingPx * 2,
    height: rect.height + paddingPx * 2
  };
}

function rectCenter(rect: Rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function rectDistance(a: Rect, b: Rect) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveDragPhase(selectedPieceId: string | null, currentPhase: PuzzleDragPhase): PuzzleDragPhase {
  return selectedPieceId ? currentPhase : "idle";
}
