import type { VirtualBoundingBox } from "../interaction/boundingBox/boundingBoxTypes";

export function renderVirtualBoundingBox(
  context: CanvasRenderingContext2D,
  box: VirtualBoundingBox | null
) {
  if (!box || !box.active) {
    return;
  }

  const rect = box.smoothedRect;
  const opacity = box.lostFrameCount > 0 ? 0.42 : 0.92;
  const isEditing = box.mode === "editing";

  context.save();
  context.shadowColor = isEditing ? "rgba(45, 212, 191, 0.62)" : "rgba(59, 130, 246, 0.44)";
  context.shadowBlur = isEditing ? 28 : 20;
  context.lineWidth = isEditing ? 4 : 3;
  context.setLineDash(box.lostFrameCount > 0 ? [10, 8] : []);
  context.strokeStyle = isEditing ? `rgba(34, 197, 94, ${opacity})` : `rgba(59, 130, 246, ${opacity})`;
  context.fillStyle = isEditing ? `rgba(34, 197, 94, ${opacity * 0.08})` : `rgba(59, 130, 246, ${opacity * 0.08})`;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.strokeRect(rect.x, rect.y, rect.width, rect.height);

  context.shadowBlur = 0;
  context.setLineDash([]);
  context.fillStyle = `rgba(59, 130, 246, ${opacity})`;
  context.beginPath();
  context.arc(box.center.x, box.center.y, 6, 0, Math.PI * 2);
  context.fill();

  if (box.cornerA && box.cornerB) {
    context.shadowColor = "rgba(250, 204, 21, 0.65)";
    context.shadowBlur = 14;
    context.fillStyle = `rgba(250, 204, 21, ${opacity})`;
    context.beginPath();
    context.arc(box.cornerA.x, box.cornerA.y, 7, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(box.cornerB.x, box.cornerB.y, 7, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}
