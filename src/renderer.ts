import { createCanvas, type CanvasRenderingContext2D } from "canvas";
import rough from "roughjs";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type {
  ExcalidrawFile,
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
} from "./types";
import { registerFonts } from "./fonts";
import { renderRectangle, renderEllipse, renderDiamond } from "./elements/shapes";
import { renderText } from "./elements/text";
import { renderLinear } from "./elements/linear";

export interface RenderOptions {
  scale: number;
  background: boolean;
  darkMode: boolean;
  padding: number;
}

interface BoundingBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

function getCanvasSize(
  elements: ExcalidrawElement[],
  padding: number,
): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    // arrow/line：只用 points 算边界，width/height 对线性元素不可靠
    if (
      (el.type === "arrow" || el.type === "line") &&
      Array.isArray((el as ExcalidrawLinearElement).points)
    ) {
      for (const [px, py] of (el as ExcalidrawLinearElement).points) {
        minX = Math.min(minX, el.x + px);
        minY = Math.min(minY, el.y + py);
        maxX = Math.max(maxX, el.x + px);
        maxY = Math.max(maxY, el.y + py);
      }
      continue;
    }

    // 非线性元素：用四角 + 旋转
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const angle = el.angle || 0;

    const corners = [
      [el.x, el.y],
      [el.x + el.width, el.y],
      [el.x + el.width, el.y + el.height],
      [el.x, el.y + el.height],
    ];

    for (const [px, py] of corners) {
      const rx =
        Math.cos(angle) * (px - cx) - Math.sin(angle) * (py - cy) + cx;
      const ry =
        Math.sin(angle) * (px - cx) + Math.cos(angle) * (py - cy) + cy;
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }
  }

  // 额外留出空间防止粗线条/箭头帽被裁
  const strokePadding = 4;
  minX -= strokePadding;
  minY -= strokePadding;
  maxX += strokePadding;
  maxY += strokePadding;

  return {
    minX,
    minY,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

function renderElement(
  element: ExcalidrawElement,
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
): void {
  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
      renderRectangle(element, rc, ctx);
      break;
    case "ellipse":
      renderEllipse(element, rc, ctx);
      break;
    case "diamond":
      renderDiamond(element, rc, ctx);
      break;
    case "text":
      renderText(element as ExcalidrawTextElement, ctx);
      break;
    case "arrow":
    case "line":
      renderLinear(element as ExcalidrawLinearElement, rc, ctx);
      break;
    case "freedraw":
      // Phase 2
      break;
    case "image":
      // Phase 2
      break;
    case "frame":
    case "magicframe":
      // frame 不渲染自身
      break;
    default:
      break;
  }
}

export async function render(
  data: ExcalidrawFile,
  options: RenderOptions,
): Promise<Buffer> {
  await registerFonts();

  const elements = data.elements.filter((el) => !el.isDeleted);

  if (elements.length === 0) {
    throw new Error("No visible elements to render");
  }

  const { minX, minY, width, height } = getCanvasSize(elements, options.padding);

  const canvasWidth = Math.ceil(width * options.scale);
  const canvasHeight = Math.ceil(height * options.scale);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");
  const rc = rough.canvas(canvas as any);

  // 背景
  if (options.background) {
    ctx.fillStyle = data.appState?.viewBackgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 坐标系：缩放 + 平移
  ctx.scale(options.scale, options.scale);
  ctx.translate(-minX + options.padding, -minY + options.padding);

  // 渲染元素
  for (const element of elements) {
    ctx.save();
    ctx.globalAlpha = (element.opacity ?? 100) / 100;
    renderElement(element, rc, ctx);
    ctx.restore();
  }

  return canvas.toBuffer("image/png");
}
