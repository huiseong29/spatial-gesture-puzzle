import type { PuzzleBoard, PuzzlePiece } from "./puzzleTypes";

export function getLockedPieceCount(pieces: PuzzlePiece[]) {
  return pieces.filter((piece) => piece.locked).length;
}

export function isPuzzleCompleted(pieces: PuzzlePiece[]) {
  return pieces.length > 0 && getLockedPieceCount(pieces) === pieces.length;
}

export function withCompletionState(board: PuzzleBoard): PuzzleBoard {
  const completed = isPuzzleCompleted(board.pieces);

  return {
    ...board,
    mode: completed ? "completed" : board.mode,
    interaction: {
      ...board.interaction,
      completed
    }
  };
}
