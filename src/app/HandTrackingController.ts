import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { createCameraStream, stopCameraStream } from "../media/camera";
import { createHandLandmarker } from "../tracking/handLandmarker";
import { normalizeHandResults } from "../tracking/handNormalizer";
import type { TrackingFrame } from "../tracking/handTypes";
import { CanvasRenderer } from "../rendering/canvasRenderer";
import { PinchDetector } from "../interaction/gestures/pinchDetector";
import { VirtualBoundingBoxTracker } from "../interaction/boundingBox/virtualBoundingBoxTracker";
import { SnapshotCaptureManager } from "../capture/snapshotCaptureManager";
import { PuzzleBoardManager } from "../puzzle/puzzleBoardManager";

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
  private readonly puzzleBoardManager = new PuzzleBoardManager();
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
    this.puzzleBoardManager.reset();
  }

  restartPuzzle() {
    this.puzzleBoardManager.restart(this.canvas.width, this.canvas.height);
    this.lastFrame = this.lastFrame
      ? {
          ...this.lastFrame,
          puzzle: null
        }
      : null;
    this.setStatus("running", "Puzzle restarted");
  }

  retakeSnapshot() {
    this.snapshotCaptureManager.clearSnapshot();
    this.puzzleBoardManager.clearAll();
    this.virtualBoundingBoxTracker.reset();
    this.lastFrame = this.lastFrame
      ? {
          ...this.lastFrame,
          capture: null,
          puzzle: null,
          virtualBoundingBox: null
        }
      : null;
    this.setStatus("running", "Ready for new capture");
  }

  setDebugEnabled(enabled: boolean) {
    this.renderer.setDebugEnabled(enabled);
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
      const frameStart = performance.now();
      const detectStart = performance.now();
      const result = this.handLandmarker.detectForVideo(this.video, now);
      const detectEnd = performance.now();
      const normalizeStart = performance.now();
      frame = normalizeHandResults({
        result,
        timestamp: now,
        video: this.video,
        canvas: this.canvas,
        previousFrame: this.lastFrame
      });
      const normalizeEnd = performance.now();
      const interactionStart = performance.now();
      const interactionHands = frame.hands.filter(isInteractionStableHand);
      frame.pinchGestures = this.pinchDetector.update(interactionHands, now);
      const puzzleActive = Boolean(frame.puzzle?.mode === "ready" || frame.puzzle?.mode === "completed");

      if (!puzzleActive && !this.snapshotCaptureManager.isLocked(now)) {
        frame.virtualBoundingBox = this.virtualBoundingBoxTracker.update({
          hands: interactionHands,
          pinchGestures: frame.pinchGestures,
          canvasWidth: this.canvas.width,
          canvasHeight: this.canvas.height,
          timestamp: now
        });
      }
      if (!puzzleActive) {
        frame.capture = this.snapshotCaptureManager.update({
          frame,
          video: this.video,
          timestamp: now
        });
      }
      frame.puzzle = this.puzzleBoardManager.updateFromSnapshot(
        frame.capture?.latestSnapshot ?? null,
        this.canvas.width,
        this.canvas.height,
        interactionHands,
        frame.pinchGestures
      );
      const interactionEnd = performance.now();
      frame.profile = {
        detectMs: detectEnd - detectStart,
        normalizeMs: normalizeEnd - normalizeStart,
        interactionMs: interactionEnd - interactionStart,
        renderMs: this.lastFrame?.profile.renderMs ?? 0,
        totalMs: interactionEnd - frameStart
      };
      this.lastFrame = frame;
      this.updateFps(now);
    }

    const renderStart = performance.now();
    this.renderer.render({
      video: this.video,
      frame,
      fps: this.fps
    });
    const renderEnd = performance.now();

    if (frame) {
      frame.profile = {
        ...frame.profile,
        renderMs: renderEnd - renderStart,
        totalMs: frame.profile.detectMs + frame.profile.normalizeMs + frame.profile.interactionMs + (renderEnd - renderStart)
      };
    }
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

function isInteractionStableHand(hand: TrackingFrame["hands"][number]) {
  return hand.trackingState === "stable";
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
