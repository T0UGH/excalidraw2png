import type { Options } from "roughjs/bin/core";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { CanvasRenderingContext2D } from "canvas";
import type { ExcalidrawElementBase } from "../types";

// 移植自 Excalidraw shape.ts generateRoughOptions
export function generateRoughOptions(element: ExcalidrawElementBase): Options {
  const options: Options = {
    seed: element.seed,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    stroke: element.strokeColor,
    preserveVertices: element.roughness < 2,
  };

  if (element.strokeStyle === "dashed") {
    options.strokeLineDash = [8, 8 + element.strokeWidth];
    options.strokeWidth = element.strokeWidth + 0.5;
    options.disableMultiStroke = true;
  } else if (element.strokeStyle === "dotted") {
    options.strokeLineDash = [1.5, 6 + element.strokeWidth];
    options.strokeWidth = element.strokeWidth + 0.5;
    options.disableMultiStroke = true;
  }

  if (element.backgroundColor && element.backgroundColor !== "transparent") {
    options.fill = element.backgroundColor;
    options.fillStyle = element.fillStyle as any;
    options.fillWeight = element.strokeWidth / 2;
    options.hachureGap = element.strokeWidth * 4;
  }

  return options;
}

// 坐标变换：平移到元素位置 + 绕中心旋转
export function applyTransform(
  element: ExcalidrawElementBase,
  ctx: CanvasRenderingContext2D,
  draw: () => void,
): void {
  ctx.save();
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  ctx.translate(cx, cy);
  ctx.rotate(element.angle || 0);
  ctx.translate(-element.width / 2, -element.height / 2);
  draw();
  ctx.restore();
}

export function renderRectangle(
  element: ExcalidrawElementBase,
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
): void {
  applyTransform(element, ctx, () => {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const options = generateRoughOptions(element);

    if (element.roundness) {
      // 圆角矩形：用 path 近似
      const r = Math.min(element.width, element.height) * 0.1;
      const w = element.width;
      const h = element.height;
      const path = `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
      rc.path(path, options);
    } else {
      rc.rectangle(0, 0, element.width, element.height, options);
    }
  });
}

export function renderEllipse(
  element: ExcalidrawElementBase,
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
): void {
  applyTransform(element, ctx, () => {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const options = generateRoughOptions(element);
    rc.ellipse(
      element.width / 2,
      element.height / 2,
      element.width,
      element.height,
      options,
    );
  });
}

export function renderDiamond(
  element: ExcalidrawElementBase,
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
): void {
  applyTransform(element, ctx, () => {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const options = generateRoughOptions(element);
    const w = element.width;
    const h = element.height;
    rc.polygon(
      [
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2],
      ],
      options,
    );
  });
}
