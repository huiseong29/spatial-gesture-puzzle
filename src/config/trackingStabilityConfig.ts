export const trackingStabilityConfig = {
  minHandScore: 0.58,
  maxJumpPx: 150,
  stableFramesRequired: 2,
  lostToleranceFrames: 5,
  freezeOnUnstableFrames: 4,
  outlierRejectThresholdPx: 190
} as const;
