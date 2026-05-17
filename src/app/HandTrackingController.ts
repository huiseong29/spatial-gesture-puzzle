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
import { calculateInteractionConfidence } from "../interaction/interactionConfidence";
import { InteractionSoundManager } from "../audio/interactionSoundManager";
import type { ThemeMode } from "../theme/themeTypes";

export type RuntimePhase =
  | "idle"
  | "booting"
  | "camera-permission"
  | "camera-ready"
  | "model-loading"
  | "running"
  | "stopped"
  | "error";

export type RuntimeStatus = {
  phase: RuntimePhase;
  message: string;
};

export type ExperienceState = {
  puzzleMode: string | null;
  puzzleTransitionPhase: string | null;
  boxMode: string | null;
  capturePhase: string | null;
  captureReady: boolean;
  heatmapReplayMode: "hidden" | "ready" | "playing" | "finished";
  pointerHistoryCount: number;
};

type HandTrackingControllerOptions = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  onStatus: (status: RuntimeStatus) => void;
  onExperienceState?: (state: ExperienceState) => void;
};

export class HandTrackingController {
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: CanvasRenderer;
  private readonly onStatus: (status: RuntimeStatus) => void;
  private readonly onExperienceState?: (state: ExperienceState) => void;
  private lastExperienceStateKey = "";
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
  private readonly soundManager: InteractionSoundManager;
  private fpsLastTime = performance.now();
  private fpsFrameCount = 0;
  private fps = 0;
  private starting = false;
  private startToken = 0;

  constructor(options: HandTrackingControllerOptions) {
    this.video = options.video;
    this.canvas = options.canvas;
    this.onStatus = options.onStatus;
    this.onExperienceState = options.onExperienceState;
    this.soundManager = new InteractionSoundManager();
    this.renderer = new CanvasRenderer(this.canvas);
  }

  async start() {
    if (this.starting || (this.handLandmarker && !this.stopped)) {
      return;
    }

    this.starting = true;
    this.stopped = false;
    const startToken = ++this.startToken;
    void this.soundManager.unlock();
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = 0;
    this.resetInteractionRuntime();

    try {
      this.setStatus("camera-permission", "Waiting for webcam permission");
      this.stream = await createCameraStream();
      if (!this.isCurrentStart(startToken)) {
        this.stopTrackingResources();
        return;
      }
      this.video.srcObject = this.stream;
      await this.video.play();
      if (!this.isCurrentStart(startToken)) {
        this.stopTrackingResources();
        return;
      }

      this.setStatus("camera-ready", "Webcam stream ready");
      this.setStatus("model-loading", "Loading MediaPipe hand landmarker");
      const handLandmarker = await createHandLandmarker();
      if (!this.isCurrentStart(startToken)) {
        handLandmarker.close();
        this.stopTrackingResources();
        return;
      }
      this.handLandmarker = handLandmarker;

      this.setStatus("running", "Tracking hands");
      this.loop();
    } catch (error) {
      this.stopTrackingResources();
      this.setStatus("error", formatStartupError(error));
    } finally {
      this.starting = false;
    }
  }

  stop() {
    this.stopTrackingResources();
    this.setStatus("stopped", "Camera stopped");
  }

  dispose() {
    this.stopTrackingResources();
    this.soundManager.dispose();
  }

  private stopTrackingResources() {
    this.startToken += 1;
    this.stopped = true;
    this.starting = false;
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = 0;
    this.handLandmarker?.close();
    this.handLandmarker = null;
    stopCameraStream(this.stream);
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.resetInteractionRuntime();
  }

  restartPuzzle() {
    if (this.stopped || !this.handLandmarker) {
      return;
    }

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
    if (this.stopped || !this.handLandmarker) {
      return;
    }

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
    this.publishExperienceState(null);
  }

  startInteractionReplay() {
    if (this.stopped || !this.handLandmarker) {
      return;
    }

    this.puzzleBoardManager.startHeatmapReplay();
    this.publishExperienceState(this.lastFrame);
  }

  setSoundMuted(muted: boolean) {
    this.soundManager.setMuted(muted);
  }

  setDebugEnabled(enabled: boolean) {
    this.renderer.setDebugEnabled(enabled);
  }

  setThemeMode(themeMode: ThemeMode) {
    this.renderer.setThemeMode(themeMode);
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
      frame.interactionConfidence = calculateInteractionConfidence({
        hands: interactionHands,
        pinchGestures: frame.pinchGestures,
        puzzle: frame.puzzle,
        previous: this.lastFrame?.interactionConfidence ?? null
      });

      if (this.puzzleBoardManager.consumeAutoResetRequested()) {
        this.snapshotCaptureManager.clearSnapshot();
        this.virtualBoundingBoxTracker.reset();
        frame.capture = null;
        frame.puzzle = null;
        frame.virtualBoundingBox = null;
      }
      this.soundManager.update(frame);
      this.publishExperienceState(frame);
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

  private resetInteractionRuntime() {
    this.lastExperienceStateKey = "";
    this.lastFrame = null;
    this.lastVideoTime = -1;
    this.fps = 0;
    this.fpsFrameCount = 0;
    this.fpsLastTime = performance.now();
    this.pinchDetector.reset();
    this.virtualBoundingBoxTracker.reset();
    this.snapshotCaptureManager.reset();
    this.puzzleBoardManager.reset();
    this.soundManager.reset();
    this.publishExperienceState(null);
  }

  private isCurrentStart(startToken: number) {
    return !this.stopped && this.startToken === startToken;
  }

  private setStatus(phase: RuntimePhase, message: string) {
    this.onStatus({ phase, message });
  }

  private publishExperienceState(frame: TrackingFrame | null) {
    if (!this.onExperienceState) {
      return;
    }

    const puzzle = frame?.puzzle ?? null;
    const state: ExperienceState = {
      puzzleMode: puzzle?.mode ?? null,
      puzzleTransitionPhase: puzzle?.transition?.phase ?? null,
      boxMode: frame?.virtualBoundingBox?.mode ?? null,
      capturePhase: frame?.capture?.phase ?? null,
      captureReady: frame?.capture?.captureReady ?? false,
      heatmapReplayMode: puzzle?.interaction.heatmapReplayMode ?? "hidden",
      pointerHistoryCount: puzzle?.interaction.pointerHistory.samples.length ?? 0
    };
    const key = [
      state.puzzleMode,
      state.puzzleTransitionPhase,
      state.boxMode,
      state.capturePhase,
      state.captureReady ? "capture-ready" : "capture-idle",
      state.heatmapReplayMode,
      state.pointerHistoryCount > 0 ? "has-history" : "empty"
    ].join(":");

    if (key === this.lastExperienceStateKey) {
      return;
    }

    this.lastExperienceStateKey = key;
    this.onExperienceState(state);
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
