import type { Snapshot } from "../capture/snapshotTypes";
import type { PinchGestureState } from "../interaction/gestures/pinchTypes";
import type { TrackedHand } from "../tracking/handTypes";
import { createPuzzleBoardFromSnapshot } from "./puzzleGenerator";
import type { PuzzleBoard } from "./puzzleTypes";
import { updatePuzzleInteraction } from "./puzzleInteraction";

export class PuzzleBoardManager {
  private board: PuzzleBoard | null = null;
  private loadingSnapshotId: string | null = null;
  private latestSnapshot: Snapshot | null = null;

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
      if (this.board?.mode === "ready") {
        this.board = updatePuzzleInteraction(this.board, hands, pinchGestures);
      }
      return this.board;
    }

    this.loadingSnapshotId = snapshot.id;
    void createPuzzleBoardFromSnapshot(snapshot, canvasWidth, canvasHeight)
      .then((board) => {
        if (this.loadingSnapshotId === snapshot.id) {
          this.board = board;
          this.loadingSnapshotId = null;
        }
      })
      .catch(() => {
        if (this.loadingSnapshotId === snapshot.id) {
          this.loadingSnapshotId = null;
        }
      });

    return this.board ?? {
      mode: "loading",
      snapshotId: snapshot.id,
      image: null,
      rows: 3,
      cols: 3,
      boardRect: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      },
      pieces: [],
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
        snapDistancePx: null,
        nearestCellIndex: null,
        completed: false
      }
    };
  }

  reset() {
    this.board = null;
    this.loadingSnapshotId = null;
  }

  restart(canvasWidth: number, canvasHeight: number) {
    if (!this.latestSnapshot) {
      return;
    }

    const snapshot = this.latestSnapshot;
    this.board = null;
    this.loadingSnapshotId = snapshot.id;

    void createPuzzleBoardFromSnapshot(snapshot, canvasWidth, canvasHeight)
      .then((board) => {
        if (this.loadingSnapshotId === snapshot.id) {
          this.board = board;
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
  }
}
