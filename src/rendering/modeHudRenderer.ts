import type { TrackingFrame } from "../tracking/handTypes";

type FriendlyMode = "ready" | "tracking" | "resize" | "capture" | "puzzle" | "completed";

export function renderModeHud(context: CanvasRenderingContext2D, frame: TrackingFrame | null) {
  const mode = getMode(frame);
  const label = modeToKoreanLabel(mode);
  const instruction = modeToKoreanInstruction(mode);

  context.save();
  context.font = "700 15px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";

  const width = Math.max(context.measureText(instruction).width + 154, 360);
  const x = 22;
  const y = 22;
  const height = 42;

  drawRoundRect(context, x, y, width, height, 10);
  context.fillStyle = "rgba(15, 23, 42, 0.72)";
  context.fill();
  context.strokeStyle = "rgba(148, 163, 184, 0.32)";
  context.lineWidth = 1;
  context.stroke();

  drawRoundRect(context, x + 6, y + 6, 118, height - 12, 8);
  context.fillStyle = mode === "completed" ? "rgba(34, 197, 94, 0.88)" : "rgba(59, 130, 246, 0.88)";
  context.fill();

  context.fillStyle = "rgba(248, 250, 252, 0.96)";
  context.fillText(label, x + 18, y + height / 2);

  context.fillStyle = "rgba(226, 232, 240, 0.94)";
  context.fillText(instruction, x + 142, y + height / 2);
  context.restore();
}

function getMode(frame: TrackingFrame | null): FriendlyMode {
  if (!frame) {
    return "ready";
  }

  if (frame.puzzle?.mode === "completed") {
    return "completed";
  }

  if (frame.puzzle?.mode === "ready") {
    return "puzzle";
  }

  if (frame.capture?.phase === "ready") {
    return "capture";
  }

  if (frame.virtualBoundingBox?.mode === "editing") {
    return "resize";
  }

  return "tracking";
}

function modeToKoreanLabel(mode: FriendlyMode) {
  switch (mode) {
    case "resize":
      return "영역 지정";
    case "capture":
      return "캡처 대기";
    case "puzzle":
      return "퍼즐 조작";
    case "completed":
      return "완성";
    case "tracking":
      return "손 인식";
    default:
      return "대기";
  }
}

function modeToKoreanInstruction(mode: FriendlyMode) {
  switch (mode) {
    case "resize":
      return "양손 pinch로 캡처 영역을 조정하세요";
    case "capture":
      return "양손 pinch-start로 캡처를 실행하세요";
    case "puzzle":
      return "pinch gesture로 조각을 이동하세요";
    case "completed":
      return "퍼즐 완성";
    case "tracking":
      return "카메라에 양손을 인식시키세요";
    default:
      return "카메라를 시작하세요";
  }
}

function drawRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}
