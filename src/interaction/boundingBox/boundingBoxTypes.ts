import type { Rect, ScreenPoint } from "../../tracking/handTypes";

export type VirtualBoundingBox = {
  active: boolean;
  mode: "idle" | "editing";
  rawRect: Rect;
  smoothedRect: Rect;
  confirmedRect: Rect;
  cornerA: ScreenPoint | null;
  cornerB: ScreenPoint | null;
  center: ScreenPoint;
  rawCenter: ScreenPoint;
  cornerDistancePx: number;
  lostFrameCount: number;
  editInactiveFrameCount: number;
  editCompletedAt: number;
  updatedAt: number;
};
