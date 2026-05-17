import { captureConfig } from "../config/captureConfig";
import type { CaptureState } from "../capture/snapshotTypes";

type CaptureFlashOptions = {
  capture: CaptureState | null;
  now: number;
  width: number;
  height: number;
};

export function renderCaptureFlash(
  context: CanvasRenderingContext2D,
  options: CaptureFlashOptions
) {
  if (!options.capture?.lastCapturedAt) {
    return;
  }

  const elapsed = options.now - options.capture.lastCapturedAt;
  if (elapsed < 0 || elapsed > captureConfig.flashDurationMs) {
    return;
  }

  const opacity = 1 - elapsed / captureConfig.flashDurationMs;

  context.save();
  context.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
  context.fillRect(0, 0, options.width, options.height);
  context.strokeStyle = `rgba(94, 234, 212, ${opacity * 0.9})`;
  context.lineWidth = 8;
  context.strokeRect(8, 8, options.width - 16, options.height - 16);
  context.restore();
}
