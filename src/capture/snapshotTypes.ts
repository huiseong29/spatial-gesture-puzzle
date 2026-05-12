import type { Rect } from "../tracking/handTypes";

export type CapturePhase = "idle" | "ready" | "locked";

export type Snapshot = {
  id: string;
  createdAt: number;
  dataUrl: string;
  width: number;
  height: number;
  cropRectCanvas: Rect;
  cropRectVideo: Rect;
};

export type CaptureState = {
  phase: CapturePhase;
  lockedUntil: number;
  lastCapturedAt: number;
  latestSnapshot: Snapshot | null;
  lastTrigger: "none" | "both-hand-simultaneous-pinch-start";
  captureReady: boolean;
  readyUntil: number;
  simultaneousDeltaMs: number | null;
};
