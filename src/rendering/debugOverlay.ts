import type { TrackedHand } from "../tracking/handTypes";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { VirtualBoundingBox } from "../interaction/boundingBox/boundingBoxTypes";
import type { CaptureState } from "../capture/snapshotTypes";
import type { PuzzleBoard } from "../puzzle/puzzleTypes";
import { getLockedPieceCount } from "../puzzle/puzzleCompletion";
import type { FrameProfile } from "../tracking/handTypes";

export type DebugOverlayOptions = {
  fps: number;
  profile: FrameProfile | null;
  handCount: number;
  hands: TrackedHand[];
  pinchGestures: Map<string, PinchGestureState>;
  virtualBoundingBox: VirtualBoundingBox | null;
  capture: CaptureState | null;
  puzzle: PuzzleBoard | null;
};

export function renderDebugOverlay(context: CanvasRenderingContext2D, options: DebugOverlayOptions) {
  const box = options.virtualBoundingBox;
  const boxLines = options.virtualBoundingBox
    ? [
        `Box ${box!.active ? "active" : "inactive"} ${box!.mode} lost ${box!.lostFrameCount}`,
        `  A ${formatPoint(box!.cornerA)} B ${formatPoint(box!.cornerB)}`,
        `  raw ${Math.round(box!.rawRect.width)} x ${Math.round(box!.rawRect.height)}`,
        `  smooth ${Math.round(box!.smoothedRect.width)} x ${Math.round(box!.smoothedRect.height)}`,
        `  center ${Math.round(box!.center.x)}, ${Math.round(box!.center.y)}`,
        `  corner dist ${Math.round(box!.cornerDistancePx)}`
      ]
    : ["Box inactive"];

  const lines = [
    `FPS ${options.fps}`,
    ...formatProfileLines(options.profile),
    `Hands ${options.handCount}/2`,
    ...boxLines,
    ...formatCaptureLines(options.capture),
    ...formatPuzzleLines(options.puzzle, options.pinchGestures),
    ...options.hands.flatMap((hand) => {
      const pinch = options.pinchGestures.get(hand.id);

      if (!pinch) {
        return [`${hand.handedness} score ${Math.round(hand.handednessScore * 100)}%`];
      }

      return [
        `${hand.handedness} ${pinch.phase}`,
        `  dist ${pinch.normalizedDistance.toFixed(2)} px ${Math.round(pinch.pinchDistancePx)}`,
        `  start ${pinch.startThreshold.toFixed(2)} release ${pinch.releaseThreshold.toFixed(2)}`
      ];
    })
  ];

  context.save();
  context.font = "600 16px Inter, system-ui, sans-serif";
  context.textBaseline = "top";

  const width = Math.max(...lines.map((line) => context.measureText(line).width)) + 28;
  const height = lines.length * 24 + 20;

  context.fillStyle = "rgba(2, 6, 23, 0.72)";
  context.fillRect(16, 16, width, height);
  context.fillStyle = "rgba(241, 245, 249, 0.96)";

  lines.forEach((line, index) => {
    context.fillText(line, 30, 28 + index * 24);
  });

  context.restore();
}

function formatProfileLines(profile: FrameProfile | null) {
  if (!profile) {
    return ["Profile -"];
  }

  return [
    `ms detect ${profile.detectMs.toFixed(1)} render ${profile.renderMs.toFixed(1)} total ${profile.totalMs.toFixed(1)}`,
    `ms normalize ${profile.normalizeMs.toFixed(1)} interaction ${profile.interactionMs.toFixed(1)}`
  ];
}

function formatPuzzleLines(puzzle: PuzzleBoard | null, pinchGestures: Map<string, PinchGestureState>) {
  if (!puzzle) {
    return ["Puzzle empty"];
  }

  const interaction = puzzle.interaction;
  const activePinch = interaction.activeHandId
    ? pinchGestures.get(interaction.activeHandId)?.phase ?? "missing"
    : "-";

  return [
    `Puzzle ${puzzle.mode}`,
    `  pieces ${puzzle.pieces.length}`,
    `  board ${Math.round(puzzle.boardRect.width)} x ${Math.round(puzzle.boardRect.height)}`,
    `  completed ${interaction.completed ? "yes" : "no"}`,
    `  dragPhase ${interaction.dragPhase}`,
    `  selected ${interaction.selectedPieceId ?? "-"} activeHand ${interaction.activeHandId ?? "-"}`,
    `  hover ${interaction.hoveredPieceId ?? "-"}`,
    `  pointerLost ${interaction.pointerLostFrames} releaseGrace ${interaction.releaseGraceFrames}`,
    `  pinchPhase ${activePinch}`,
    `  pointer ${formatPoint(interaction.pointer)}`,
    `  raw ${formatPoint(interaction.rawPointer)} smooth ${formatPoint(interaction.smoothedPointer)}`,
    `  velocity ${Math.round(interaction.pointerVelocityPxPerSec)} alpha ${interaction.pointerSmoothingAlpha.toFixed(2)}`,
    `  lag ${Math.round(interaction.pointerLagPx)}px`,
    `  snap ${interaction.lastSnapPieceId ?? "-"} dist ${interaction.snapDistancePx === null ? "-" : Math.round(interaction.snapDistancePx)}`,
    `  locked ${getLockedPieceCount(puzzle.pieces)}/${puzzle.pieces.length}`
  ];
}

function formatCaptureLines(capture: CaptureState | null) {
  if (!capture) {
    return ["Capture idle"];
  }

  const snapshot = capture.latestSnapshot;
  return [
    `Capture ${capture.phase} ready ${capture.captureReady ? "yes" : "no"}`,
    `  trigger ${capture.lastTrigger}`,
    `  readyUntil ${capture.readyUntil ? Math.round(capture.readyUntil) : "-"}`,
    `  simDelta ${capture.simultaneousDeltaMs === null ? "-" : Math.round(capture.simultaneousDeltaMs)}`,
    `  lockedUntil ${capture.lockedUntil ? Math.round(capture.lockedUntil) : "-"}`,
    snapshot ? `  snapshot ${snapshot.width} x ${snapshot.height}` : "  snapshot none",
    snapshot
      ? `  video crop ${Math.round(snapshot.cropRectVideo.x)},${Math.round(
          snapshot.cropRectVideo.y
        )} ${Math.round(snapshot.cropRectVideo.width)}x${Math.round(snapshot.cropRectVideo.height)}`
      : "  video crop -"
  ];
}

function formatPoint(point: { x: number; y: number } | null) {
  if (!point) {
    return "-";
  }

  return `${Math.round(point.x)},${Math.round(point.y)}`;
}
