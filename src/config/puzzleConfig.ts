export const puzzleConfig = {
  rows: 3,
  cols: 3,
  pieceGap: 3,
  objectFit: "cover",
  shuffleAttempts: 8,
  snapThresholdPx: 34,
  hitPaddingPx: 20,
  dragReleaseGraceFrames: 4,
  pointerLostToleranceFrames: 5,
  dragPointerSlowAlpha: 0.52,
  dragPointerFastAlpha: 0.18,
  dragPointerVelocityThreshold: 900
} as const;
