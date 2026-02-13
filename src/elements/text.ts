import type { CanvasRenderingContext2D } from "canvas";
import type { ExcalidrawTextElement } from "../types";
import { getFontString } from "../fonts";
import { applyTransform } from "./shapes";

export function renderText(
  element: ExcalidrawTextElement,
  ctx: CanvasRenderingContext2D,
): void {
  applyTransform(element, ctx, () => {
    ctx.font = getFontString(element.fontSize, element.fontFamily);
    ctx.fillStyle = element.strokeColor;
    ctx.textAlign = element.textAlign as any;
    ctx.textBaseline = "top";

    const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
    const lineHeightPx = element.fontSize * (element.lineHeight || 1.25);

    let horizontalOffset = 0;
    if (element.textAlign === "center") {
      horizontalOffset = element.width / 2;
    } else if (element.textAlign === "right") {
      horizontalOffset = element.width;
    }

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], horizontalOffset, i * lineHeightPx);
    }
  });
}
