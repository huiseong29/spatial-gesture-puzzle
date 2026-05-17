import type { CaptureState } from "../capture/snapshotTypes";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { VirtualBoundingBox } from "../interaction/boundingBox/boundingBoxTypes";
import { getLockedPieceCount } from "../puzzle/puzzleCompletion";
import type { PuzzleBoard } from "../puzzle/puzzleTypes";
import type { FrameProfile, InteractionConfidenceState, TrackedHand } from "../tracking/handTypes";
import { getThemeTokens } from "../theme/themeTokens";
import type { ThemeMode } from "../theme/themeTypes";

export type DebugOverlayOptions = {
  fps: number;
  profile: FrameProfile | null;
  handCount: number;
  hands: TrackedHand[];
  pinchGestures: Map<string, PinchGestureState>;
  virtualBoundingBox: VirtualBoundingBox | null;
  capture: CaptureState | null;
  puzzle: PuzzleBoard | null;
  interactionConfidence: InteractionConfidenceState | null;
};

type DebugLine = {
  text: string;
  kind?: "section" | "muted";
};

export function renderDebugOverlay(
  context: CanvasRenderingContext2D,
  options: DebugOverlayOptions,
  themeMode: ThemeMode = "dark"
) {
  const lines = buildDebugLines(options);
  const theme = getThemeTokens(themeMode);
  const fontSize = 10;
  const lineHeight = 12;
  const paddingX = 8;
  const paddingY = 7;
  const safeRight = 14;
  const safeBottom = 86;
  const maxPanelWidth = 300;
  const maxPanelHeight = Math.max(96, Math.min(168, context.canvas.height - 132));
  const maxVisibleLines = Math.max(5, Math.floor((maxPanelHeight - paddingY * 2) / lineHeight));
  const visibleLines = lines.length > maxVisibleLines
    ? [...lines.slice(0, maxVisibleLines - 1), { text: `+${lines.length - maxVisibleLines + 1} more`, kind: "muted" as const }]
    : lines;

  context.save();
  context.font = `600 ${fontSize}px "JetBrains Mono", "SFMono-Regular", Consolas, monospace`;
  context.textBaseline = "top";

  const measuredWidth = Math.max(...visibleLines.map((line) => context.measureText(line.text).width));
  const width = Math.min(maxPanelWidth, Math.ceil(measuredWidth + paddingX * 2));
  const height = Math.min(maxPanelHeight, visibleLines.length * lineHeight + paddingY * 2);
  const x = Math.max(12, context.canvas.width - width - safeRight);
  const y = Math.max(12, context.canvas.height - height - safeBottom);

  context.fillStyle = themeMode === "light" ? "rgba(255, 255, 255, 0.78)" : "rgba(8, 8, 8, 0.64)";
  context.strokeStyle = themeMode === "light" ? "rgba(122, 90, 74, 0.16)" : "rgba(255, 237, 213, 0.12)";
  context.lineWidth = 1;
  roundRect(context, x, y, width, height, 8);
  context.fill();
  context.stroke();

  visibleLines.forEach((line, index) => {
    if (line.kind === "section") {
      context.fillStyle = theme.tomatoPrimary;
    } else if (line.kind === "muted") {
      context.fillStyle = theme.textSecondary;
    } else {
      context.fillStyle = theme.textPrimary;
    }

    context.fillText(truncate(line.text, 48), x + paddingX, y + paddingY + index * lineHeight);
  });

  context.restore();
}

function buildDebugLines(options: DebugOverlayOptions): DebugLine[] {
  return [
    {
      text: `FPS ${options.fps} | detect ${ms(options.profile?.detectMs)} | render ${ms(options.profile?.renderMs)}`
    },
    {
      text: `TRK hands ${options.handCount}/2 | jitter ${round(options.interactionConfidence?.jitterPx)} | lag ${round(options.interactionConfidence?.lagPx)}`
    },
    {
      text: `RIPE ${percent(options.interactionConfidence?.ripeness)} | conf ${fixed(options.interactionConfidence?.gestureConfidence, 2)}`,
      kind: "muted"
    },
    { text: "[BOX]", kind: "section" },
    formatBoxLine(options.virtualBoundingBox),
    { text: "[CAPTURE]", kind: "section" },
    formatCaptureLine(options.capture),
    { text: "[PUZZLE]", kind: "section" },
    ...formatPuzzleLines(options.puzzle, options.pinchGestures)
  ];
}

function formatBoxLine(box: VirtualBoundingBox | null): DebugLine {
  if (!box) {
    return { text: "idle" };
  }

  return {
    text: `${box.mode} | lost ${box.lostFrameCount} | ${Math.round(box.smoothedRect.width)}x${Math.round(box.smoothedRect.height)}`
  };
}

function formatCaptureLine(capture: CaptureState | null): DebugLine {
  if (!capture) {
    return { text: "idle" };
  }

  const ready = capture.captureReady ? "ready" : "not-ready";
  const fail = capture.failureReason === "none" ? "ok" : capture.failureReason;
  return {
    text: `${capture.phase} | ${ready} | ${fail}`
  };
}

function formatPuzzleLines(
  puzzle: PuzzleBoard | null,
  pinchGestures: Map<string, PinchGestureState>
): DebugLine[] {
  if (!puzzle) {
    return [{ text: "empty" }];
  }

  const interaction = puzzle.interaction;
  const locked = getLockedPieceCount(puzzle.pieces);
  const activePinch = interaction.activeHandId
    ? pinchGestures.get(interaction.activeHandId)?.phase ?? "missing"
    : "-";

  return [
    {
      text: `${puzzle.mode} | ${puzzle.difficulty.gridSize}x${puzzle.difficulty.gridSize} | locked ${locked}/${puzzle.pieces.length}`
    },
    {
      text: `shuffle ${puzzle.shuffleValid ? "valid" : "invalid"} | fixed ${countFixedPieces(puzzle)}`,
      kind: "muted"
    },
    {
      text: `drag ${interaction.dragPhase} | sel ${shortId(interaction.selectedPieceId)} | pinch ${activePinch}`,
      kind: "muted"
    },
    {
      text: `snap ${interaction.nearestCellIndex ?? "-"} | dist ${round(interaction.snapDistancePx)} | replay ${interaction.heatmapReplayMode}`,
      kind: "muted"
    }
  ];
}

function countFixedPieces(puzzle: PuzzleBoard) {
  return puzzle.pieces.filter((piece) => piece.originalIndex === piece.currentIndex).length;
}

function ms(value: number | undefined) {
  return value === undefined ? "-" : `${Math.round(value)}ms`;
}

function round(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${Math.round(value)}`;
}

function fixed(value: number | null | undefined, digits: number) {
  return value === null || value === undefined ? "-" : value.toFixed(digits);
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${Math.round(value * 100)}%`;
}

function shortId(value: string | null) {
  return value ? value.replace("piece-", "p") : "-";
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
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
