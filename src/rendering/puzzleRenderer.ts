import type { PuzzleBoard } from "../puzzle/puzzleTypes";

export function renderPuzzleBoard(context: CanvasRenderingContext2D, board: PuzzleBoard | null) {
  if (!board || (board.mode !== "ready" && board.mode !== "completed") || !board.image) {
    return;
  }

  context.save();
  renderBoardFrame(context, board);

  const selectedPiece = board.pieces.find((piece) => piece.id === board.interaction.selectedPieceId);
  const drawPieces = selectedPiece
    ? [...board.pieces.filter((piece) => piece.id !== selectedPiece.id), selectedPiece]
    : board.pieces;

  for (const piece of drawPieces) {
    const selected = piece.id === board.interaction.selectedPieceId;
    const snapped = piece.id === board.interaction.lastSnapPieceId;

    context.shadowColor = selected
      ? "rgba(59, 130, 246, 0.54)"
      : snapped || piece.locked
        ? "rgba(34, 197, 94, 0.42)"
        : "rgba(2, 6, 23, 0.36)";
    context.shadowBlur = selected ? 14 : snapped || piece.locked ? 10 : 6;
    context.shadowOffsetY = selected ? 6 : 3;

    context.drawImage(
      board.image,
      piece.sourceRect.x,
      piece.sourceRect.y,
      piece.sourceRect.width,
      piece.sourceRect.height,
      piece.currentRect.x,
      piece.currentRect.y,
      piece.currentRect.width,
      piece.currentRect.height
    );

    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.strokeStyle = piece.locked
      ? "rgba(34, 197, 94, 0.95)"
      : selected
        ? "rgba(96, 165, 250, 0.95)"
        : "rgba(226, 232, 240, 0.72)";
    context.lineWidth = selected ? 3 : 1.5;
    context.strokeRect(piece.currentRect.x, piece.currentRect.y, piece.currentRect.width, piece.currentRect.height);
  }

  if (board.interaction.pointer) {
    context.fillStyle = "rgba(96, 165, 250, 0.95)";
    context.beginPath();
    context.arc(board.interaction.pointer.x, board.interaction.pointer.y, 7, 0, Math.PI * 2);
    context.fill();
  }

  if (board.mode === "completed") {
    renderCompletionOverlay(context, board);
  }

  context.restore();
}

function renderBoardFrame(context: CanvasRenderingContext2D, board: PuzzleBoard) {
  const { boardRect } = board;
  context.shadowColor = "rgba(15, 23, 42, 0.42)";
  context.shadowBlur = 16;
  context.fillStyle = "rgba(15, 23, 42, 0.32)";
  context.fillRect(boardRect.x - 12, boardRect.y - 12, boardRect.width + 24, boardRect.height + 24);
  context.shadowBlur = 0;

  context.strokeStyle = board.mode === "completed"
    ? "rgba(34, 197, 94, 0.95)"
    : "rgba(226, 232, 240, 0.84)";
  context.lineWidth = 2;
  context.strokeRect(boardRect.x, boardRect.y, boardRect.width, boardRect.height);

  context.strokeStyle = "rgba(226, 232, 240, 0.28)";
  context.lineWidth = 1;

  for (let col = 1; col < board.cols; col += 1) {
    const x = boardRect.x + (boardRect.width / board.cols) * col;
    context.beginPath();
    context.moveTo(x, boardRect.y);
    context.lineTo(x, boardRect.y + boardRect.height);
    context.stroke();
  }

  for (let row = 1; row < board.rows; row += 1) {
    const y = boardRect.y + (boardRect.height / board.rows) * row;
    context.beginPath();
    context.moveTo(boardRect.x, y);
    context.lineTo(boardRect.x + boardRect.width, y);
    context.stroke();
  }
}

function renderCompletionOverlay(context: CanvasRenderingContext2D, board: PuzzleBoard) {
  const label = "퍼즐 완성";
  const subLabel = "모든 조각이 정답 위치에 배치되었습니다";
  context.save();
  context.fillStyle = "rgba(15, 23, 42, 0.72)";
  context.fillRect(board.boardRect.x, board.boardRect.y, board.boardRect.width, board.boardRect.height);
  context.shadowColor = "rgba(34, 197, 94, 0.52)";
  context.shadowBlur = 18;
  context.font = "800 30px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.textAlign = "center";
  context.fillStyle = "rgba(248, 250, 252, 0.98)";
  context.fillText(label, board.boardRect.x + board.boardRect.width / 2, board.boardRect.y + board.boardRect.height / 2 - 12);
  context.shadowBlur = 0;
  context.font = "600 16px Inter, system-ui, sans-serif";
  context.fillStyle = "rgba(203, 213, 225, 0.95)";
  context.fillText(subLabel, board.boardRect.x + board.boardRect.width / 2, board.boardRect.y + board.boardRect.height / 2 + 26);
  context.restore();
}
