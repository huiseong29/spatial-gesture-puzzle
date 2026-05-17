export const puzzleConfig = {
  rows: 3,
  cols: 3,
  pieceGap: 3,
  objectFit: "cover",
  shuffleAttempts: 8,
  snapThresholdPx: 34,
  hitPaddingPx: 20,
  grabStartWindowFrames: 4,
  centerGrabRadiusRatio: 0.65,
  dragReleaseGraceFrames: 4,
  pointerLostToleranceFrames: 5,
  activeHandReacquireRadiusPx: 80,
  dragPointerSlowAlpha: 0.18,
  dragPointerFastAlpha: 0.03,
  dragPointerVelocityThreshold: 520
} as const;
