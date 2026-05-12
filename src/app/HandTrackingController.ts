import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { createCameraStream, stopCameraStream } from "../media/camera";
import { createHandLandmarker } from "../tracking/handLandmarker";
import { normalizeHandResults } from "../tracking/handNormalizer";
import type { TrackingFrame } from "../tracking/handTypes";
import { CanvasRenderer } from "../rendering/canvasRenderer";
import { PinchDetector } from "../interaction/gestures/pinchDetector";
import { VirtualBoundingBoxTracker } from "../interaction/boundingBox/virtualBoundingBoxTracker";
import { SnapshotCaptureManager } from "../capture/snapshotCaptureManager";

export type RuntimePhase =
  | "idle"
  | "booting"
  | "camera-permission"
  | "camera-ready"
  | "model-loading"
  | "running"
  | "error";

export type RuntimeStatus = {
  phase: RuntimePhase;
  message: string;
};

type HandTrackingControllerOptions = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  onStatus: (status: RuntimeStatus) => void;
};

export class HandTrackingController {
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: CanvasRenderer;
  private readonly onStatus: (status: RuntimeStatus) => void;
  private handLandmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId = 0;
  private stopped = false;
  private lastVideoTime = -1;
  private lastFrame: TrackingFrame | null = null;
  private readonly pinchDetector = new PinchDetector();
  private readonly virtualBoundingBoxTracker = new VirtualBoundingBoxTracker();
  private readonly snapshotCaptureManager = new SnapshotCaptureManager();
  private fpsLastTime = performance.now();
  private fpsFrameCount = 0;
  private fps = 0;
  private starting = false;

  constructor(options: HandTrackingControllerOptions) {
    this.video = options.video;
    this.canvas = options.canvas;
    this.onStatus = options.onStatus;
    this.renderer = new CanvasRenderer(this.canvas);
  }

  async start() {
    if (this.starting || this.handLandmarker) {
      return;
    }

    this.starting = true;
    this.stopped = false;

    try {
      this.setStatus("camera-permission", "Waiting for webcam permission");
      this.stream = await createCameraStream();
      this.video.srcObject = this.stream;
      await this.video.play();

      this.setStatus("camera-ready", "Webcam stream ready");
      this.setStatus("model-loading", "Loading MediaPipe hand landmarker");
      this.handLandmarker = await createHandLandmarker();

      this.setStatus("running", "Tracking hands");
      this.loop();
    } catch (error) {
      this.setStatus("error", formatStartupError(error));
      this.stop();
    } finally {
      this.starting = false;
    }
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.animationFrameId);
    this.handLandmarker?.close();
    this.handLandmarker = null;
    stopCameraStream(this.stream);
    this.stream = null;
    this.video.srcObject = null;
    this.lastFrame = null;
    this.lastVideoTime = -1;
    this.pinchDetector.reset();
    this.virtualBoundingBoxTracker.reset();
    this.snapshotCaptureManager.reset();
  }

  private loop = () => {
    if (this.stopped) {
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);

    if (!this.handLandmarker || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    this.syncCanvasSize();

    const now = performance.now();
    let frame = this.lastFrame;

    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const result = this.handLandmarker.detectForVideo(this.video, now);
      frame = normalizeHandResults({
        result,
        timestamp: now,
        video: this.video,
        canvas: this.canvas,
        previousFrame: this.lastFrame
      });
      frame.pinchGestures = this.pinchDetector.update(frame.hands, now);
      if (!this.snapshotCaptureManager.isLocked(now)) {
        frame.virtualBoundingBox = this.virtualBoundingBoxTracker.update({
          leftHand: frame.leftHand,
          rightHand: frame.rightHand,
          pinchGestures: frame.pinchGestures,
          canvasWidth: this.canvas.width,
          canvasHeight: this.canvas.height,
          timestamp: now
        });
      }
      frame.capture = this.snapshotCaptureManager.update({
        frame,
        video: this.video,
        timestamp: now
      });
      this.lastFrame = frame;
      this.updateFps(now);
    }

    this.renderer.render({
      video: this.video,
      frame,
      fps: this.fps
    });
  };

  private syncCanvasSize() {
    const width = this.video.videoWidth;
    const height = this.video.videoHeight;

    if (width === 0 || height === 0) {
      return;
    }

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private updateFps(now: number) {
    this.fpsFrameCount += 1;
    const elapsed = now - this.fpsLastTime;

    if (elapsed >= 500) {
      this.fps = Math.round((this.fpsFrameCount * 1000) / elapsed);
      this.fpsFrameCount = 0;
      this.fpsLastTime = now;
    }
  }

  private setStatus(phase: RuntimePhase, message: string) {
    this.onStatus({ phase, message });
  }
}

function formatStartupError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission was denied by the browser";
    }

    if (error.name === "NotFoundError") {
      return "No camera device was found";
    }

    if (error.name === "NotReadableError") {
      return "Camera is already in use by another app";
    }

    return `${error.name}: ${error.message}`;
  }

  return error instanceof Error ? error.message : "Failed to start tracking";
}
