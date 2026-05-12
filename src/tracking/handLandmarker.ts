import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { mediapipeConfig } from "../config/mediapipeConfig";

export async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(mediapipeConfig.wasmAssetPath);

  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: mediapipeConfig.modelAssetPath,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: mediapipeConfig.numHands,
    minHandDetectionConfidence: mediapipeConfig.minHandDetectionConfidence,
    minHandPresenceConfidence: mediapipeConfig.minHandPresenceConfidence,
    minTrackingConfidence: mediapipeConfig.minTrackingConfidence
  });
}
