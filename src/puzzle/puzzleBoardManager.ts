import type { Snapshot } from "../capture/snapshotTypes";
import { puzzleConfig } from "../config/puzzleConfig";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { TrackedHand } from "../tracking/handTypes";
import { createPuzzleBoardFromSnapshot } from "./puzzleGenerator";
import type { DifficultyState, PuzzleBoard } from "./puzzleTypes";
import { updatePuzzleInteraction } from "./puzzleInteraction";

export class PuzzleBoardManager {
  private board: PuzzleBoard | null = null;
  private loadingSnapshotId: string | null = null;
  private latestSnapshot: Snapshot | null = null;
  private autoResetRequested = false;
  private lastDifficulty: DifficultyState | null = null;

  updateFromSnapshot(
    snapshot: Snapshot | null,
    canvasWidth: number,
    canvasHeight: number,
    hands: TrackedHand[],
    pinchGestures: Map<string, PinchGestureState>
  ): PuzzleBoard | null {
    if (!snapshot) {
      return this.board;
    }

    this.latestSnapshot = snapshot;

    if (this.board?.snapshotId === snapshot.id || this.loadingSnapshotId === snapshot.id) {
      this.board = this.updateTransition(this.board);
      this.board = this.updateHeatmapReplay(this.board);

      if (this.board?.mode === "ready") {
        this.board = updatePuzzleInteraction(this.board, hands, pinchGestures);
      }
      return this.board;
    }

    this.loadingSnapshotId = snapshot.id;
    void createPuzzleBoardFromSnapshot(snapshot, canvasWidth, canvasHeight, this.lastDifficulty)
      .then((board) => {
        if (this.loadingSnapshotId === snapshot.id) {
          this.board = board;
          this.lastDifficulty = board.difficulty;
          this.loadingSnapshotId = null;
        }
      })
      .catch(() => {
        if (this.loadingSnapshotId === snapshot.id) {
          this.loadingSnapshotId = null;
        }
      });

    const fallbackDifficulty = createFallbackDifficulty(snapshot, canvasWidth, canvasHeight, this.lastDifficulty);

    return this.board ?? {
      mode: "loading",
      snapshotId: snapshot.id,
      image: null,
      rows: fallbackDifficulty.gridSize,
      cols: fallbackDifficulty.gridSize,
      boardRect: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      },
      pieces: [],
      transition: null,
      difficulty: fallbackDifficulty,
      interaction: {
        selectedPieceId: null,
        activeHandId: null,
        dragPhase: "idle",
        pointer: null,
        rawPointer: null,
        smoothedPointer: null,
        pointerVelocityPxPerSec: 0,
        pointerSmoothingAlpha: 0,
        pointerLagPx: 0,
        grabWindowFrames: 0,
        pointerLostFrames: 0,
        releaseGraceFrames: 0,
        dragOffset: {
          x: 0,
          y: 0
        },
        originCellIndex: null,
        hoveredPieceId: null,
        lastSnapPieceId: null,
        lastSnapAt: 0,
        snapPreview: null,
        snapDistancePx: null,
        nearestCellIndex: null,
        completed: false,
        completedAt: 0,
        heatmapReplayMode: "hidden",
        heatmapReplayStartedAt: 0,
        pointerHistory: {
          samples: [],
          maxSamples: puzzleConfig.pointerHistoryMaxSamples
        }
      }
    };
  }

  reset() {
    this.board = null;
    this.loadingSnapshotId = null;
    this.latestSnapshot = null;
    this.autoResetRequested = false;
  }

  restart(canvasWidth: number, canvasHeight: number) {
    if (!this.latestSnapshot) {
      return;
    }

    const snapshot = this.latestSnapshot;
    this.board = null;
    this.loadingSnapshotId = snapshot.id;
    this.autoResetRequested = false;

    void createPuzzleBoardFromSnapshot(snapshot, canvasWidth, canvasHeight, this.lastDifficulty)
      .then((board) => {
        if (this.loadingSnapshotId === snapshot.id) {
          this.board = board;
          this.lastDifficulty = board.difficulty;
          this.loadingSnapshotId = null;
        }
      })
      .catch(() => {
        if (this.loadingSnapshotId === snapshot.id) {
          this.loadingSnapshotId = null;
        }
      });
  }

  clearAll() {
    this.board = null;
    this.loadingSnapshotId = null;
    this.latestSnapshot = null;
    this.autoResetRequested = false;
    this.lastDifficulty = null;
  }

  consumeAutoResetRequested() {
    const requested = this.autoResetRequested;
    this.autoResetRequested = false;
    return requested;
  }

  startHeatmapReplay() {
    if (!this.board || this.board.mode !== "completed") {
      return;
    }

    this.board = {
      ...this.board,
      interaction: {
        ...this.board.interaction,
        heatmapReplayMode: "playing" as const,
        heatmapReplayStartedAt: performance.now()
      }
    };
  }

  private updateTransition(board: PuzzleBoard | null) {
    if (!board || board.mode !== "transitioning" || !board.transition) {
      return board;
    }

    const now = performance.now();
    if (now >= board.transition.completedAt) {
      return {
        ...board,
        mode: "ready" as const,
        transition: {
          ...board.transition,
          phase: "playable" as const
        }
      };
    }

    const splitAt = board.transition.startedAt + board.transition.gridDurationMs;
    const shuffleAt = splitAt + board.transition.popDurationMs;
    const phase = now < splitAt ? "captured" as const : now < shuffleAt ? "splitting" as const : "shuffling" as const;

    return {
      ...board,
      transition: {
        ...board.transition,
        phase
      }
    };
  }

  private updateHeatmapReplay(board: PuzzleBoard | null) {
    if (!board || board.mode !== "completed" || board.interaction.heatmapReplayMode !== "playing") {
      return board;
    }

    if (performance.now() - board.interaction.heatmapReplayStartedAt < puzzleConfig.heatmapReplayMs) {
      return board;
    }

    return {
      ...board,
      interaction: {
        ...board.interaction,
        heatmapReplayMode: "finished" as const
      }
    };
  }
}

function createFallbackDifficulty(
  snapshot: Snapshot,
  canvasWidth: number,
  canvasHeight: number,
  previous: DifficultyState | null
): DifficultyState {
  const captureAreaRatio = (snapshot.cropRectCanvas.width * snapshot.cropRectCanvas.height) /
    Math.max(canvasWidth * canvasHeight, 1);
  const score = previous?.smoothedScore ?? 3;

  return {
    gridSize: Math.round(score),
    score,
    smoothedScore: score,
    captureAreaRatio,
    gestureConfidence: snapshot.gestureConfidence,
    trackingJitterPx: snapshot.trackingJitterPx,
    reason: "medium-capture"
  };
}
