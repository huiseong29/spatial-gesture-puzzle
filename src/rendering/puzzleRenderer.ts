import { puzzleConfig } from "../config/puzzleConfig";
import type { PuzzleBoard } from "../puzzle/puzzleTypes";
import type { InteractionConfidenceState } from "../tracking/handTypes";
import { renderInteractionHeatmap } from "./heatmapRenderer";
import { getRipenessTheme } from "./ripenessTheme";
import type { ThemeMode } from "../theme/themeTypes";
import { getThemeTokens } from "../theme/themeTokens";

export function renderPuzzleBoard(
  context: CanvasRenderingContext2D,
  board: PuzzleBoard | null,
  confidence: InteractionConfidenceState | null = null,
  themeMode: ThemeMode = "dark"
) {
  if (
    !board ||
    (board.mode !== "transitioning" && board.mode !== "ready" && board.mode !== "completed") ||
    !board.image
  ) {
    return;
  }

  context.save();
  const theme = getRipenessTheme(confidence, themeMode);
  const tokens = getThemeTokens(themeMode);
  const transition = getTransitionProgress(board);
  const completion = getCompletionProgress(board);
  renderBoardFrame(context, board, transition.gridOpacity);

  if (board.mode === "transitioning") {
    renderFrozenSnapshot(context, board, transition.snapshotOpacity);
  }

  renderSnapPreview(context, board, theme, tokens);

  const selectedPiece = board.pieces.find((piece) => piece.id === board.interaction.selectedPieceId);
  const drawPieces = selectedPiece
    ? [...board.pieces.filter((piece) => piece.id !== selectedPiece.id), selectedPiece]
    : board.pieces;

  for (const piece of drawPieces) {
    const selected = piece.id === board.interaction.selectedPieceId && !piece.locked;
    const snapped = piece.id === board.interaction.lastSnapPieceId;
    const snapPulse = snapped ? getSnapPulse(board) : 0;
    const displayRect = getDisplayRect(piece.correctRect, piece.currentRect, transition.pieceProgress(piece.originalIndex));
    const radius = selected ? 14 : 11;

    if (transition.pieceOpacity <= 0) {
      continue;
    }

    context.globalAlpha = transition.pieceOpacity * (1 - completion.mergeOpacity * 0.38);
    context.shadowColor = getPieceShadowColor(selected, snapped, piece.locked, snapPulse, theme.accentGlow, tokens.lockedAccent);
    context.shadowBlur = getPieceShadowBlur(selected, snapped, piece.locked, snapPulse, theme.pulse);
    context.shadowOffsetY = selected ? 6 : piece.locked ? 1 : 3;

    context.save();
    roundRect(context, displayRect.x, displayRect.y, displayRect.width, displayRect.height, radius);
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
    context.strokeStyle = getPieceStrokeStyle(selected, snapped, piece.locked, snapPulse, theme.accent, tokens.lockedAccent);
    context.lineWidth = piece.locked
      ? puzzleConfig.lockedOutlineWidth
      : selected
        ? 3
        : snapped
          ? 2.5 + snapPulse * 2
          : 1.5;
    roundRect(context, displayRect.x, displayRect.y, displayRect.width, displayRect.height, radius);
    context.stroke();

    if (piece.locked) {
      renderLockedMarker(context, displayRect, radius, snapPulse, tokens);
    }

    if (snapped || (piece.locked && snapPulse > 0)) {
      renderSnapPulse(context, displayRect, radius, snapPulse, theme);
    }

    context.globalAlpha = 1;
  }

  if (completion.mergeOpacity > 0) {
    renderMergedImage(context, board, completion.mergeOpacity);
  }

  renderInteractionHeatmap(context, board, themeMode);

  if (board.interaction.pointer && board.mode !== "completed") {
    context.fillStyle = withAlpha(theme.accent, 0.95);
    context.shadowColor = theme.accentGlow;
    context.shadowBlur = 12 * theme.pulse;
    context.beginPath();
    context.arc(board.interaction.pointer.x, board.interaction.pointer.y, 7, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  }

  if (board.mode === "completed" && board.interaction.heatmapReplayMode === "ready") {
    renderCompletionOverlay(context, board, completion);
  }

  context.restore();
}

function renderSnapPreview(
  context: CanvasRenderingContext2D,
  board: PuzzleBoard,
  theme: ReturnType<typeof getRipenessTheme>,
  tokens: ReturnType<typeof getThemeTokens>
) {
  const preview = board.interaction.snapPreview;

  if (!preview || board.mode !== "ready") {
    return;
  }

  const alpha = preview.isCorrect
    ? puzzleConfig.correctGlowAlpha * (0.45 + preview.strength * 0.55)
    : 0.16 + preview.strength * 0.18;
  const rect = preview.cellRect;

  context.save();
  context.shadowColor = preview.isCorrect ? theme.accentGlow : withAlpha(tokens.cream, 0.42);
  context.shadowBlur = preview.isCorrect ? 18 + preview.strength * 16 : 10 + preview.strength * 8;
  context.fillStyle = preview.isCorrect
    ? withAlpha(theme.accent, alpha)
    : withAlpha(tokens.cream, alpha);
  roundRect(context, rect.x, rect.y, rect.width, rect.height, puzzleConfig.cellHighlightRadius);
  context.fill();
  context.strokeStyle = preview.isCorrect
    ? withAlpha(theme.accent, 0.7 + preview.strength * 0.28)
    : withAlpha(tokens.cream, 0.42 + preview.strength * 0.34);
  context.lineWidth = preview.isCorrect ? 3 : 2;
  roundRect(context, rect.x, rect.y, rect.width, rect.height, puzzleConfig.cellHighlightRadius);
  context.stroke();
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

  renderImageInBoard(context, board, opacity);
}

function renderMergedImage(context: CanvasRenderingContext2D, board: PuzzleBoard, opacity: number) {
  renderImageInBoard(context, board, opacity * 0.96);
}

function renderImageInBoard(context: CanvasRenderingContext2D, board: PuzzleBoard, opacity: number) {
  if (!board.image) {
    return;
  }

  const image = board.image;
  context.save();
  context.globalAlpha = opacity;
  context.shadowColor = "rgba(239, 68, 68, 0.28)";
  context.shadowBlur = 22 * opacity;
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

function renderCompletionOverlay(
  context: CanvasRenderingContext2D,
  board: PuzzleBoard,
  completion: ReturnType<typeof getCompletionProgress>
) {
  const centerX = board.boardRect.x + board.boardRect.width / 2;
  const centerY = board.boardRect.y + board.boardRect.height / 2;
  const fadeOut = completion.fadeOutProgress;
  const alpha = 1 - fadeOut;

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "rgba(24, 10, 8, 0.48)";
  roundRect(context, board.boardRect.x, board.boardRect.y, board.boardRect.width, board.boardRect.height, 14);
  context.fill();

  context.shadowColor = "rgba(239, 68, 68, 0.52)";
  context.shadowBlur = 18;
  context.font = "800 30px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.textAlign = "center";
  context.fillStyle = "rgba(255, 237, 213, 0.98)";
  context.fillText("퍼즐 완성", centerX, centerY - 14);
  context.shadowBlur = 0;
  context.font = "600 15px Inter, system-ui, sans-serif";
  context.fillStyle = "rgba(254, 215, 170, 0.92)";
  context.fillText("잠시 후 캡처 단계로 돌아갑니다", centerX, centerY + 24);

  context.strokeStyle = `rgba(239, 68, 68, ${0.44 + completion.displayProgress * 0.28})`;
  context.lineWidth = 4;
  roundRect(
    context,
    board.boardRect.x - 10,
    board.boardRect.y - 10,
    board.boardRect.width + 20,
    board.boardRect.height + 20,
    20
  );
  context.stroke();
  context.restore();
}

function renderLockedMarker(
  context: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  radius: number,
  pulse: number,
  tokens: ReturnType<typeof getThemeTokens>
) {
  context.save();
  context.fillStyle = withAlpha(tokens.lockedAccent, puzzleConfig.lockedFillAlpha);
  roundRect(context, rect.x, rect.y, rect.width, rect.height, radius);
  context.fill();
  context.shadowColor = withAlpha(tokens.lockedAccent, puzzleConfig.lockedGlowAlpha);
  context.shadowBlur = 8 + pulse * 5;
  context.strokeStyle = withAlpha(tokens.lockedAccent, 0.62 + pulse * 0.1);
  context.lineWidth = puzzleConfig.lockedOutlineWidth;
  roundRect(context, rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3, Math.max(4, radius - 2));
  context.stroke();
  context.shadowBlur = 0;
  context.restore();
}

function renderSnapPulse(
  context: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  radius: number,
  pulse: number,
  theme: ReturnType<typeof getRipenessTheme>
) {
  context.save();
  context.globalAlpha = 0.35 + pulse * 0.55;
  context.strokeStyle = withAlpha(theme.accent, 0.72);
  context.lineWidth = 4 + pulse * 3;
  context.shadowColor = theme.accentGlow;
  context.shadowBlur = (14 + pulse * 14) * theme.pulse;
  roundRect(
    context,
    rect.x - 5 - pulse * 5,
    rect.y - 5 - pulse * 5,
    rect.width + 10 + pulse * 10,
    rect.height + 10 + pulse * 10,
    radius + 4
  );
  context.stroke();
  context.restore();
}

function getPieceShadowColor(
  selected: boolean,
  snapped: boolean,
  locked: boolean,
  pulse: number,
  accentGlow: string,
  lockedAccent: string
) {
  if (locked) {
    return withAlpha(lockedAccent, puzzleConfig.lockedGlowAlpha + pulse * 0.08);
  }

  if (selected) {
    return accentGlow;
  }

  return snapped ? "rgba(251, 146, 60, 0.42)" : "rgba(24, 10, 8, 0.34)";
}

function getPieceShadowBlur(selected: boolean, snapped: boolean, locked: boolean, pulse: number, themePulse: number) {
  if (locked) {
    return 6 + pulse * 5;
  }

  if (selected) {
    return (16 + pulse * 10) * themePulse;
  }

  return snapped ? 14 + pulse * 14 : 7;
}

function getPieceStrokeStyle(
  selected: boolean,
  snapped: boolean,
  locked: boolean,
  pulse: number,
  accent: string,
  lockedAccent: string
) {
  if (locked) {
    return withAlpha(lockedAccent, 0.62 + pulse * 0.1);
  }

  if (selected) {
    return withAlpha(accent, 0.98);
  }

  return snapped ? withAlpha(accent, 0.88) : "rgba(255, 237, 213, 0.58)";
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("#")) {
    const [r, g, b] = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }

  if (color.startsWith("rgba(")) {
    return color;
  }

  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha.toFixed(3)})`);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
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

function getCompletionProgress(board: PuzzleBoard) {
  if (board.mode !== "completed" || !board.interaction.completedAt) {
    return {
      displayProgress: 0,
      fadeOutProgress: 0,
      mergeOpacity: 0
    };
  }

  const elapsed = performance.now() - board.interaction.completedAt;
  const fadeStart = puzzleConfig.completionDisplayMs;

  return {
    displayProgress: clamp01(elapsed / puzzleConfig.completionDisplayMs),
    fadeOutProgress: clamp01((elapsed - fadeStart) / puzzleConfig.autoResetFadeMs),
    mergeOpacity: easeOutCubic(clamp01(elapsed / 720))
  };
}

function getSnapPulse(board: PuzzleBoard) {
  if (!board.interaction.lastSnapAt) {
    return 0;
  }

  return 1 - clamp01((performance.now() - board.interaction.lastSnapAt) / puzzleConfig.snapPulseMs);
}

function getDisplayRect(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
  progress: number
) {
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
