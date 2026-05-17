import type { PuzzleBoard } from "../puzzle/puzzleTypes";

export function renderPuzzleBoard(context: CanvasRenderingContext2D, board: PuzzleBoard | null) {
  if (
    !board ||
    (board.mode !== "transitioning" && board.mode !== "ready" && board.mode !== "completed") ||
    !board.image
  ) {
    return;
  }

  context.save();
  const transition = getTransitionProgress(board);
  renderBoardFrame(context, board, transition.gridOpacity);

  if (board.mode === "transitioning") {
    renderFrozenSnapshot(context, board, transition.snapshotOpacity);
  }

  const selectedPiece = board.pieces.find((piece) => piece.id === board.interaction.selectedPieceId);
  const drawPieces = selectedPiece
    ? [...board.pieces.filter((piece) => piece.id !== selectedPiece.id), selectedPiece]
    : board.pieces;

  for (const piece of drawPieces) {
    const selected = piece.id === board.interaction.selectedPieceId;
    const snapped = piece.id === board.interaction.lastSnapPieceId;
    const displayRect = getDisplayRect(piece.correctRect, piece.currentRect, transition.pieceProgress(piece.originalIndex));
    const radius = selected ? 14 : 11;

    if (transition.pieceOpacity <= 0) {
      continue;
    }

    context.globalAlpha = transition.pieceOpacity;
    context.shadowColor = selected
      ? "rgba(239, 68, 68, 0.62)"
      : snapped || piece.locked
        ? "rgba(251, 146, 60, 0.42)"
        : "rgba(24, 10, 8, 0.34)";
    context.shadowBlur = selected ? 20 : snapped || piece.locked ? 14 : 7;
    context.shadowOffsetY = selected ? 6 : 3;

    context.save();
    roundRect(
      context,
      displayRect.x,
      displayRect.y,
      displayRect.width,
      displayRect.height,
      radius
    );
    context.clip();
    context.drawImage(
      board.image,
      piece.sourceRect.x,
      piece.sourceRect.y,
      piece.sourceRect.width,
      piece.sourceRect.height,
      displayRect.x,
      displayRect.y,
      displayRect.width,
      displayRect.height
    );
    context.restore();

    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.strokeStyle = piece.locked
      ? "rgba(254, 215, 170, 0.92)"
      : selected
        ? "rgba(239, 68, 68, 0.98)"
        : "rgba(255, 237, 213, 0.58)";
    context.lineWidth = selected ? 3 : 1.5;
    roundRect(
      context,
      displayRect.x,
      displayRect.y,
      displayRect.width,
      displayRect.height,
      radius
    );
    context.stroke();

    if (snapped) {
      context.save();
      context.strokeStyle = "rgba(239, 68, 68, 0.72)";
      context.lineWidth = 5;
      context.shadowColor = "rgba(239, 68, 68, 0.55)";
      context.shadowBlur = 18;
      roundRect(
        context,
        displayRect.x - 5,
        displayRect.y - 5,
        displayRect.width + 10,
        displayRect.height + 10,
        radius + 4
      );
      context.stroke();
      context.restore();
    }
    context.globalAlpha = 1;
  }

  if (board.interaction.pointer) {
    context.fillStyle = "rgba(239, 68, 68, 0.95)";
    context.shadowColor = "rgba(239, 68, 68, 0.52)";
    context.shadowBlur = 14;
    context.beginPath();
    context.arc(board.interaction.pointer.x, board.interaction.pointer.y, 7, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  }

  if (board.mode === "completed") {
    renderCompletionOverlay(context, board);
  }

  context.restore();
}

function renderBoardFrame(context: CanvasRenderingContext2D, board: PuzzleBoard, gridOpacity = 1) {
  const { boardRect } = board;
  context.shadowColor = "rgba(24, 10, 8, 0.44)";
  context.shadowBlur = 18;
  context.fillStyle = "rgba(31, 18, 14, 0.42)";
  roundRect(context, boardRect.x - 12, boardRect.y - 12, boardRect.width + 24, boardRect.height + 24, 18);
  context.fill();
  context.shadowBlur = 0;

  context.strokeStyle = board.mode === "completed"
    ? `rgba(254, 215, 170, ${0.96 * gridOpacity})`
    : `rgba(255, 237, 213, ${0.76 * gridOpacity})`;
  context.lineWidth = 2;
  roundRect(context, boardRect.x, boardRect.y, boardRect.width, boardRect.height, 14);
  context.stroke();

  context.strokeStyle = `rgba(254, 215, 170, ${0.22 * gridOpacity})`;
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

function renderFrozenSnapshot(context: CanvasRenderingContext2D, board: PuzzleBoard, opacity: number) {
  if (opacity <= 0 || !board.image) {
    return;
  }

  const image = board.image;
  context.save();
  context.globalAlpha = opacity;
  roundRect(context, board.boardRect.x, board.boardRect.y, board.boardRect.width, board.boardRect.height, 14);
  context.clip();
  context.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    board.boardRect.x,
    board.boardRect.y,
    board.boardRect.width,
    board.boardRect.height
  );
  context.restore();
}

function renderCompletionOverlay(context: CanvasRenderingContext2D, board: PuzzleBoard) {
  const label = "퍼즐 완성";
  const subLabel = "모든 조각이 정답 위치에 배치되었습니다";

  context.save();
  context.fillStyle = "rgba(24, 10, 8, 0.74)";
  roundRect(context, board.boardRect.x, board.boardRect.y, board.boardRect.width, board.boardRect.height, 14);
  context.fill();
  context.shadowColor = "rgba(239, 68, 68, 0.52)";
  context.shadowBlur = 18;
  context.font = "800 30px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.textAlign = "center";
  context.fillStyle = "rgba(255, 237, 213, 0.98)";
  context.fillText(label, board.boardRect.x + board.boardRect.width / 2, board.boardRect.y + board.boardRect.height / 2 - 12);
  context.shadowBlur = 0;
  context.font = "600 16px Inter, system-ui, sans-serif";
  context.fillStyle = "rgba(254, 215, 170, 0.95)";
  context.fillText(subLabel, board.boardRect.x + board.boardRect.width / 2, board.boardRect.y + board.boardRect.height / 2 + 26);
  context.restore();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
}

function getTransitionProgress(board: PuzzleBoard) {
  if (board.mode !== "transitioning" || !board.transition) {
    return {
      gridOpacity: 1,
      snapshotOpacity: 0,
      pieceOpacity: 1,
      pieceProgress: () => 1
    };
  }

  const now = performance.now();
  const gridStart = board.transition.startedAt;
  const popStart = gridStart + board.transition.gridDurationMs;
  const shuffleStart = popStart + board.transition.popDurationMs;
  const gridOpacity = easeOutCubic(clamp01((now - gridStart) / board.transition.gridDurationMs));
  const popProgress = easeOutBack(clamp01((now - popStart) / board.transition.popDurationMs));
  const snapshotOpacity = 1 - clamp01((now - shuffleStart) / 260) * 0.72;

  return {
    gridOpacity,
    snapshotOpacity,
    pieceOpacity: clamp01(popProgress),
    pieceProgress: (pieceIndex: number) => {
      const pieceStart = shuffleStart + pieceIndex * board.transition!.staggerMs;
      return easeInOutCubic(clamp01((now - pieceStart) / board.transition!.shuffleDurationMs));
    }
  };
}

function getDisplayRect(from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number; width: number; height: number }, progress: number) {
  const popScale = 1 + Math.sin(progress * Math.PI) * 0.035;
  const width = lerp(from.width, to.width, progress) * popScale;
  const height = lerp(from.height, to.height, progress) * popScale;
  const centerX = lerp(from.x + from.width / 2, to.x + to.width / 2, progress);
  const centerY = lerp(from.y + from.height / 2, to.y + to.height / 2, progress);

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutBack(t: number) {
  const c1 = 1.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
