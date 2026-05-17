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

  const activeHand = selectActiveHand(board, hands, pinchGestures);
  const activeGesture = activeHand ? pinchGestures.get(activeHand.id) : undefined;
  const rawPointer = activeHand ? getPointer(activeHand) : null;
  const hasSelection = Boolean(board.interaction.selectedPieceId);
  const pointerLostFrames = hasSelection && !rawPointer ? board.interaction.pointerLostFrames + 1 : 0;
  const dragPointer = resolveDragPointer(board, rawPointer, hasSelection);
  const pointer = dragPointer.pointer;
  let pieces = board.pieces.map((piece) => ({ ...piece }));
  let interaction: PuzzleInteractionState = {
    ...board.interaction,
    pointer,
    rawPointer,
    smoothedPointer: dragPointer.pointer,
    pointerVelocityPxPerSec: dragPointer.velocityPxPerSec,
    pointerSmoothingAlpha: dragPointer.alpha,
    pointerLagPx: dragPointer.lagDistancePx,
    pointerLostFrames,
    hoveredPieceId: !hasSelection && pointer ? hitTestPiece(pieces, pointer, puzzleConfig.hitPaddingPx)?.id ?? null : null,
    lastSnapPieceId: null,
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

  if (interaction.activeHandId && activeHand?.id !== interaction.activeHandId) {
    return handleLockedDragWithoutActiveHand(board, pieces, interaction);
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

  if (options.activeHand && options.pointer && options.activeGesture?.startedThisFrame) {
    const hitPiece = hitTestPiece(pieces, options.pointer, puzzleConfig.hitPaddingPx);

    if (hitPiece && !hitPiece.locked) {
      interaction = {
        ...interaction,
        selectedPieceId: hitPiece.id,
        activeHandId: options.activeHand.id,
        dragPhase: "grabbed",
        pointerLostFrames: 0,
        releaseGraceFrames: 0,
        dragOffset: {
          x: options.pointer.x - hitPiece.currentRect.x,
          y: options.pointer.y - hitPiece.currentRect.y
        },
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
      activeHandId: interaction.selectedPieceId ? interaction.activeHandId : null,
      releaseGraceFrames: interaction.selectedPieceId ? interaction.releaseGraceFrames : 0,
      pointerLostFrames: interaction.selectedPieceId ? interaction.pointerLostFrames : 0
    }
  });
}

function handleLockedDragWithoutActiveHand(
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
  const releaseGraceFrames = options.gesture?.isPinching === false || options.gesture?.releasedThisFrame
    ? interaction.releaseGraceFrames + 1
    : 0;
  const snapDistancePx = selectedPiece ? rectDistance(selectedPiece.currentRect, selectedPiece.correctRect) : null;

  interaction = {
    ...interaction,
    releaseGraceFrames,
    snapDistancePx,
    dragPhase: releaseGraceFrames > 0 ? "release-pending" : "dragging"
  };

  if (interaction.pointerLostFrames > puzzleConfig.pointerLostToleranceFrames) {
    return dropAndUnlock(options.board, pieces, {
      ...interaction,
      dragPhase: "pointer-lost" as const
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

  const dropResult = dropSelectedPiece(pieces, interaction.selectedPieceId);

  return withCompletionState({
    ...board,
    pieces: dropResult.pieces,
    interaction: {
      ...interaction,
      selectedPieceId: null,
      activeHandId: null,
      dragPhase: "idle",
      pointerLostFrames: 0,
      releaseGraceFrames: 0,
      dragOffset: {
        x: 0,
        y: 0
      },
      lastSnapPieceId: dropResult.snappedPieceId,
      snapDistancePx: dropResult.snapDistancePx
    }
  });
}

function selectActiveHand(
  board: PuzzleBoard,
  hands: TrackedHand[],
  pinchGestures: Map<string, PinchGestureState>
) {
  if (board.interaction.activeHandId) {
    return hands.find((hand) => hand.id === board.interaction.activeHandId) ?? null;
  }

  return (
    hands.find((hand) => {
      const gesture = pinchGestures.get(hand.id);
      return Boolean(gesture?.startedThisFrame);
    }) ?? null
  );
}

function getPointer(hand: TrackedHand): ScreenPoint {
  const thumbTip = hand.points[pinchConfig.thumbTipIndex];
  const indexTip = hand.points[pinchConfig.indexTipIndex];

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

function hitTestPiece(pieces: PuzzlePiece[], pointer: ScreenPoint, paddingPx: number) {
  return [...pieces]
    .reverse()
    .find((piece) => !piece.locked && containsPoint(expandRect(piece.currentRect, paddingPx), pointer));
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

function dropSelectedPiece(pieces: PuzzlePiece[], pieceId: string) {
  let snappedPieceId: string | null = null;
  let snapDistancePx: number | null = null;

  const nextPieces = pieces.map((piece) => {
    if (piece.id !== pieceId) {
      return piece;
    }

    snapDistancePx = rectDistance(piece.currentRect, piece.correctRect);

    if (snapDistancePx <= puzzleConfig.snapThresholdPx) {
      snappedPieceId = piece.id;
      return {
        ...piece,
        currentRect: { ...piece.correctRect },
        currentIndex: piece.originalIndex,
        locked: true
      };
    }

    return piece;
  });

  return {
    pieces: nextPieces,
    snappedPieceId,
    snapDistancePx
  };
}

function getSelectedSnapDistance(pieces: PuzzlePiece[], selectedPieceId: string | null) {
  if (!selectedPieceId) {
    return null;
  }

  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId);
  return selectedPiece ? rectDistance(selectedPiece.currentRect, selectedPiece.correctRect) : null;
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

function rectDistance(a: Rect, b: Rect) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distance(a: ScreenPoint, b: ScreenPoint) {
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
