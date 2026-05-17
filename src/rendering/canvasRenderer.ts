import { coordinateConfig } from "../config/coordinateConfig";
import { performanceConfig } from "../config/performanceConfig";
import type { TrackingFrame } from "../tracking/handTypes";
import { renderDebugOverlay, type DebugOverlayOptions } from "./debugOverlay";
import { renderCaptureFlash } from "./captureFlashRenderer";
import { renderVirtualBoundingBox } from "./virtualBoundingBoxRenderer";
import { renderSkeleton } from "./skeletonRenderer";
import { renderPuzzleBoard } from "./puzzleRenderer";
import { renderModeHud } from "./modeHudRenderer";

type CanvasRenderOptions = {
  video: HTMLVideoElement;
  frame: TrackingFrame | null;
  fps: number;
};

export class CanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private lastDebugSampleAt = 0;
  private debugSample: DebugOverlayOptions | null = null;
  private debugEnabled = false;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas 2D context is not available");
    }

    this.canvas = canvas;
    this.context = context;
  }

  render(options: CanvasRenderOptions) {
    const { context } = this;
    const width = this.canvas.width;
    const height = this.canvas.height;

    context.clearRect(0, 0, width, height);
    this.drawVideo(options.video, width, height);

    if (options.frame) {
      renderVirtualBoundingBox(context, options.frame.virtualBoundingBox);
      renderPuzzleBoard(context, options.frame.puzzle);

      for (const hand of options.frame.hands) {
        renderSkeleton(context, hand, options.frame.pinchGestures.get(hand.id));
      }

      renderCaptureFlash(context, {
        capture: options.frame.capture,
        now: options.frame.timestamp,
        width,
        height
      });
    }

    renderModeHud(context, options.frame);

    if (!this.debugEnabled) {
      return;
    }

    const now = performance.now();
    if (!this.debugSample || now - this.lastDebugSampleAt >= performanceConfig.debugOverlaySampleMs) {
      this.debugSample = {
        fps: options.fps,
        profile: options.frame?.profile ?? null,
        handCount: options.frame?.hands.length ?? 0,
        hands: options.frame?.hands ?? [],
        pinchGestures: options.frame?.pinchGestures ?? new Map(),
        virtualBoundingBox: options.frame?.virtualBoundingBox ?? null,
        capture: options.frame?.capture ?? null,
        puzzle: options.frame?.puzzle ?? null
      };
      this.lastDebugSampleAt = now;
    }

    renderDebugOverlay(context, this.debugSample);
  }

  setDebugEnabled(enabled: boolean) {
    this.debugEnabled = enabled;
  }

  private drawVideo(video: HTMLVideoElement, width: number, height: number) {
    if (coordinateConfig.mirrorPreview) {
      this.context.save();
      this.context.translate(width, 0);
      this.context.scale(-1, 1);
      this.context.drawImage(video, 0, 0, width, height);
      this.context.restore();
      return;
    }

    this.context.drawImage(video, 0, 0, width, height);
  }
}
