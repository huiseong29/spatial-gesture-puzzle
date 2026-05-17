import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const SMOOTHING_ALPHA = 0.42;

export function smoothLandmarks(
  current: NormalizedLandmark[],
  previous: NormalizedLandmark[] | undefined
): NormalizedLandmark[] {
  if (!previous || previous.length !== current.length) {
    return current.map(copyLandmark);
  }

  return current.map((landmark, index) => {
    const old = previous[index];

    return {
      x: old.x * SMOOTHING_ALPHA + landmark.x * (1 - SMOOTHING_ALPHA),
      y: old.y * SMOOTHING_ALPHA + landmark.y * (1 - SMOOTHING_ALPHA),
      z: old.z * SMOOTHING_ALPHA + landmark.z * (1 - SMOOTHING_ALPHA),
      visibility: landmark.visibility
    };
  });
}

function copyLandmark(landmark: NormalizedLandmark): NormalizedLandmark {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility
  };
}
