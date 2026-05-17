import type { PuzzleBoard, PuzzlePiece } from "./puzzleTypes";

export function getLockedPieceCount(pieces: PuzzlePiece[]) {
  return pieces.filter((piece) => piece.locked).length;
}

export function isPuzzleCompleted(pieces: PuzzlePiece[]) {
  return pieces.length > 0 && getLockedPieceCount(pieces) === pieces.length;
}

export function withCompletionState(board: PuzzleBoard): PuzzleBoard {
  const completed = isPuzzleCompleted(board.pieces);
  const newlyCompleted = completed && !board.interaction.completed;
  const completedAt = completed && !board.interaction.completed
    ? performance.now()
    : board.interaction.completedAt;

  return {
    ...board,
    mode: completed ? "completed" : board.mode,
    interaction: {
      ...board.interaction,
      completed,
      completedAt,
      heatmapReplayMode: newlyCompleted ? "ready" : board.interaction.heatmapReplayMode
    }
  };
}
