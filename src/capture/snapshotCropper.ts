import { coordinateConfig } from "../config/coordinateConfig";
import type { Rect } from "../tracking/handTypes";
import type { Snapshot } from "./snapshotTypes";

type CaptureSnapshotOptions = {
  video: HTMLVideoElement;
  canvasWidth: number;
  canvasHeight: number;
  cropRectCanvas: Rect;
  timestamp: number;
};

export function captureSnapshot(options: CaptureSnapshotOptions): Snapshot | null {
  const cropRectVideo = canvasRectToVideoRect({
    rect: options.cropRectCanvas,
    canvasWidth: options.canvasWidth,
    canvasHeight: options.canvasHeight,
    videoWidth: options.video.videoWidth,
    videoHeight: options.video.videoHeight
  });

  const width = Math.max(1, Math.round(cropRectVideo.width));
  const height = Math.max(1, Math.round(cropRectVideo.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(
    options.video,
    cropRectVideo.x,
    cropRectVideo.y,
    cropRectVideo.width,
    cropRectVideo.height,
    0,
    0,
    width,
    height
  );

  return {
    id: `snapshot-${Math.round(options.timestamp)}`,
    createdAt: options.timestamp,
    dataUrl: canvas.toDataURL("image/png"),
    width,
    height,
    cropRectCanvas: { ...options.cropRectCanvas },
    cropRectVideo,
  };
}

function canvasRectToVideoRect(options: {
  rect: Rect;
  canvasWidth: number;
  canvasHeight: number;
  videoWidth: number;
  videoHeight: number;
}): Rect {
  const scaleX = options.videoWidth / options.canvasWidth;
  const scaleY = options.videoHeight / options.canvasHeight;

  const x = coordinateConfig.mirrorPreview || coordinateConfig.useViewerSpace
    ? options.canvasWidth - (options.rect.x + options.rect.width)
    : options.rect.x;

  return clampVideoRect(
    {
      x: x * scaleX,
      y: options.rect.y * scaleY,
      width: options.rect.width * scaleX,
      height: options.rect.height * scaleY
    },
    options.videoWidth,
    options.videoHeight
  );
}

function clampVideoRect(rect: Rect, videoWidth: number, videoHeight: number): Rect {
  const width = Math.min(rect.width, videoWidth);
  const height = Math.min(rect.height, videoHeight);

  return {
    x: clamp(rect.x, 0, videoWidth - width),
    y: clamp(rect.y, 0, videoHeight - height),
    width,
    height
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
