import type { Options } from "roughjs/bin/core";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { CanvasRenderingContext2D } from "canvas";
import type { ExcalidrawLinearElement } from "../types";
import { generateRoughOptions } from "./shapes";

export function renderLinear(
  element: ExcalidrawLinearElement,
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
): void {
  const points = element.points;
  if (!points || points.length < 2) return;

  ctx.save();
  ctx.translate(element.x, element.y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const options = generateRoughOptions(element);

  // 绘制路径
  if (points.length === 2) {
    rc.line(points[0][0], points[0][1], points[1][0], points[1][1], options);
  } else {
    rc.linearPath(points as [number, number][], options);
  }

  // 箭头帽
  if (element.type === "arrow") {
    const arrowOpts: Options = {
      ...options,
      fill: undefined,
      fillStyle: "solid",
      strokeLineDash: undefined, // 箭头帽不用虚线
      disableMultiStroke: true,
    };

    if (element.endArrowhead === "arrow") {
      drawArrowhead(rc, points, "end", arrowOpts, element.strokeWidth);
    }
    if (element.startArrowhead === "arrow") {
      drawArrowhead(rc, points, "start", arrowOpts, element.strokeWidth);
    }
  }

  ctx.restore();
}

function drawArrowhead(
  rc: RoughCanvas,
  points: [number, number][],
  position: "start" | "end",
  options: Options,
  strokeWidth: number,
): void {
  const arrowLength = strokeWidth * 4 + 10;
  const arrowAngle = (25 * Math.PI) / 180;

  let tipX: number, tipY: number, dx: number, dy: number;

  if (position === "end") {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    tipX = last[0];
    tipY = last[1];
    dx = last[0] - prev[0];
    dy = last[1] - prev[1];
  } else {
    const first = points[0];
    const next = points[1];
    tipX = first[0];
    tipY = first[1];
    dx = first[0] - next[0];
    dy = first[1] - next[1];
  }

  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const nx = dx / len;
  const ny = dy / len;

  const leftX =
    tipX - arrowLength * (nx * Math.cos(arrowAngle) - ny * Math.sin(arrowAngle));
  const leftY =
    tipY - arrowLength * (nx * Math.sin(arrowAngle) + ny * Math.cos(arrowAngle));
  const rightX =
    tipX -
    arrowLength * (nx * Math.cos(-arrowAngle) - ny * Math.sin(-arrowAngle));
  const rightY =
    tipY -
    arrowLength * (nx * Math.sin(-arrowAngle) + ny * Math.cos(-arrowAngle));

  rc.line(leftX, leftY, tipX, tipY, options);
  rc.line(rightX, rightY, tipX, tipY, options);
}
