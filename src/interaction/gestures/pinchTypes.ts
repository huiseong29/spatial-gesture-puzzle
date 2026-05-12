export type PinchPhase = "not-pinching" | "pinch-start" | "pinch-hold" | "pinch-release";

export type PinchGestureState = {
  handId: string;
  phase: PinchPhase;
  isPinching: boolean;
  startedThisFrame: boolean;
  releasedThisFrame: boolean;
  pinchDistancePx: number;
  handScalePx: number;
  normalizedDistance: number;
  startThreshold: number;
  releaseThreshold: number;
  stableCloseFrames: number;
  stableOpenFrames: number;
  lastUpdatedAt: number;
};
