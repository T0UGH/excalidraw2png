# excalidraw2png 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** CLI 工具，提供 validate（格式校验）和 convert（转 PNG）两个命令，错误信息面向 AI agent 设计。

**Architecture:** Node.js + TypeScript，核心分三层：validator（JSON 校验）→ renderer（Canvas 渲染，移植 Excalidraw 的 RoughJS 管线）→ CLI（commander 命令行）。

**Tech Stack:** node-canvas (Cairo), roughjs, commander, TypeScript

**参考源码:** /Users/bytedance/code/github/excalidraw (Excalidraw 官方仓库)
**示例文件:** /Users/bytedance/code/github/cc-excalidraw-skill/code-review-flow.excalidraw

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/types.ts`

**Step 1: 初始化 npm 项目并安装依赖**

```bash
cd /Users/bytedance/code/github/excalidraw2png
npm init -y
npm install canvas roughjs commander
npm install -D typescript @types/node
```

**Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: 创建核心类型定义 src/types.ts**

从 Excalidraw 源码 (`/packages/element/src/types.ts`) 中提取最小必要类型集：

```typescript
// 元素基础类型
export interface ExcalidrawElementBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "hachure" | "cross-hatch" | "solid" | "zigzag";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  groupIds: string[];
  frameId: string | null;
  boundElements: { id: string; type: string }[] | null;
  link: string | null;
  locked: boolean;
  roundness: { type: number; value?: number } | null;
}

// 文本元素
export interface ExcalidrawTextElement extends ExcalidrawElementBase {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  lineHeight: number;
  containerId: string | null;
  originalText: string;
  autoResize: boolean;
}

// 线性元素 (line + arrow)
export interface ExcalidrawLinearElement extends ExcalidrawElementBase {
  type: "line" | "arrow";
  points: [number, number][];
  startArrowhead: string | null;
  endArrowhead: string | null;
  startBinding: { elementId: string; focus: number; gap: number } | null;
  endBinding: { elementId: string; focus: number; gap: number } | null;
}

// 图片元素
export interface ExcalidrawImageElement extends ExcalidrawElementBase {
  type: "image";
  fileId: string;
  status: "pending" | "saved" | "error";
  scale: [number, number];
  crop: { x: number; y: number; width: number; height: number } | null;
}

// 自由绘制
export interface ExcalidrawFreeDrawElement extends ExcalidrawElementBase {
  type: "freedraw";
  points: [number, number][];
  pressures: number[];
}

// 联合类型
export type ExcalidrawElement =
  | ExcalidrawElementBase
  | ExcalidrawTextElement
  | ExcalidrawLinearElement
  | ExcalidrawImageElement
  | ExcalidrawFreeDrawElement;

// .excalidraw 文件顶层结构
export interface ExcalidrawFile {
  type: "excalidraw";
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: {
    viewBackgroundColor: string;
    gridSize: number | null;
    [key: string]: any;
  };
  files: Record<string, {
    mimeType: string;
    id: string;
    dataURL: string;
  }>;
}

// 校验结果类型
export interface ValidationError {
  level: "L1" | "L2" | "L3";
  path: string;
  elementId?: string;
  elementType?: string;
  field?: string;
  got: any;
  expected: any;
  fix: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    totalElements: number;
    validElements: number;
    errorCount: number;
    warningCount: number;
  };
}
```

**Step 4: 提交**

```bash
git add package.json tsconfig.json src/types.ts package-lock.json
git commit -m "初始化项目脚手架：依赖、类型定义"
```

---

## Task 2: Validator — L1 结构校验

**Files:**
- Create: `src/validator.ts`
- Create: `src/validator.test.ts`

**Step 1: 实现 L1 结构校验**

L1 校验检查 JSON 顶层结构是否完整：

```typescript
// src/validator.ts
import { ValidationError, ValidationResult } from "./types";

const KNOWN_ELEMENT_TYPES = [
  "rectangle", "ellipse", "diamond", "line", "arrow",
  "freedraw", "text", "image", "frame", "magicframe",
  "iframe", "embeddable",
];

const VALID_STROKE_STYLES = ["solid", "dashed", "dotted"];
const VALID_FILL_STYLES = ["hachure", "cross-hatch", "solid", "zigzag"];

// L1: 顶层结构校验
function validateL1(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof data !== "object" || data === null) {
    errors.push({
      level: "L1", path: "$",
      got: typeof data, expected: "object",
      fix: "the file must contain a JSON object with type, elements, appState, and files fields",
    });
    return errors; // 无法继续
  }

  if (data.type !== "excalidraw") {
    errors.push({
      level: "L1", path: "$.type", field: "type",
      got: data.type ?? "missing", expected: "excalidraw",
      fix: 'set "type" to "excalidraw"',
    });
  }

  if (!Array.isArray(data.elements)) {
    errors.push({
      level: "L1", path: "$.elements", field: "elements",
      got: data.elements === undefined ? "missing" : typeof data.elements,
      expected: "array",
      fix: 'add "elements" field as an array of element objects',
    });
  }

  if (typeof data.appState !== "object" || data.appState === null) {
    errors.push({
      level: "L1", path: "$.appState", field: "appState",
      got: data.appState === undefined ? "missing" : typeof data.appState,
      expected: "object",
      fix: 'add "appState" field as an object, e.g. {"viewBackgroundColor": "#ffffff"}',
    });
  }

  if (typeof data.files !== "object" || data.files === null || Array.isArray(data.files)) {
    errors.push({
      level: "L1", path: "$.files", field: "files",
      got: data.files === undefined ? "missing" : typeof data.files,
      expected: "object",
      fix: 'add "files" field as an object (can be empty: {})',
    });
  }

  return errors;
}
```

**Step 2: 写测试**

```typescript
// src/validator.test.ts — 用 node 内置 test runner
import { describe, it } from "node:test";
import assert from "node:assert";
import { validate } from "./validator";

describe("L1 结构校验", () => {
  it("合法文件应通过", () => {
    const result = validate({
      type: "excalidraw", version: 2, source: "",
      elements: [], appState: { viewBackgroundColor: "#fff" }, files: {},
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("缺少 elements 应报错", () => {
    const result = validate({ type: "excalidraw", appState: {}, files: {} });
    const err = result.errors.find(e => e.path === "$.elements");
    assert.ok(err, "should have elements error");
    assert.strictEqual(err.level, "L1");
    assert.ok(err.fix.includes("elements"), "fix should mention elements");
  });

  it("非 JSON 对象应报错", () => {
    const result = validate("not an object" as any);
    assert.strictEqual(result.errors[0].level, "L1");
  });
});
```

**Step 3: 运行测试**

```bash
npx tsc && node --test dist/validator.test.js
```

**Step 4: 提交**

```bash
git add src/validator.ts src/validator.test.ts
git commit -m "实现 L1 结构校验和测试"
```

---

## Task 3: Validator — L2 元素校验

**Files:**
- Modify: `src/validator.ts`
- Modify: `src/validator.test.ts`

**Step 1: 实现 L2 元素校验**

在 `src/validator.ts` 中添加：

```typescript
// 必填基础字段
const REQUIRED_BASE_FIELDS = [
  "id", "type", "x", "y", "width", "height",
  "strokeColor", "backgroundColor", "fillStyle",
  "strokeWidth", "strokeStyle", "roughness", "opacity", "seed",
];

// 数值字段
const NUMERIC_FIELDS = [
  "x", "y", "width", "height", "opacity",
  "strokeWidth", "roughness", "seed", "angle",
];

function validateL2(elements: any[], files: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];

  elements.forEach((el, index) => {
    const prefix = `$.elements[${index}]`;
    const elDesc = el.id ? `"${el.id}"` : `index ${index}`;

    // 必填字段检查
    for (const field of REQUIRED_BASE_FIELDS) {
      if (el[field] === undefined || el[field] === null) {
        errors.push({
          level: "L2", path: `${prefix}.${field}`,
          elementId: el.id, elementType: el.type, field,
          got: "missing",
          expected: field === "type" ? KNOWN_ELEMENT_TYPES : "required field",
          fix: `add "${field}" field to element ${elDesc}`,
        });
      }
    }

    // 类型检查
    if (el.type && !KNOWN_ELEMENT_TYPES.includes(el.type)) {
      errors.push({
        level: "L2", path: `${prefix}.type`,
        elementId: el.id, elementType: el.type, field: "type",
        got: el.type,
        expected: KNOWN_ELEMENT_TYPES,
        fix: `change type to one of: ${KNOWN_ELEMENT_TYPES.join(", ")}`,
      });
    }

    // 数值字段类型检查
    for (const field of NUMERIC_FIELDS) {
      if (el[field] !== undefined && typeof el[field] !== "number") {
        errors.push({
          level: "L2", path: `${prefix}.${field}`,
          elementId: el.id, elementType: el.type, field,
          got: `${typeof el[field]} (${JSON.stringify(el[field])})`,
          expected: "number",
          fix: `change "${field}" to a number value`,
        });
      }
    }

    // opacity 范围
    if (typeof el.opacity === "number" && (el.opacity < 0 || el.opacity > 100)) {
      errors.push({
        level: "L2", path: `${prefix}.opacity`,
        elementId: el.id, elementType: el.type, field: "opacity",
        got: el.opacity,
        expected: "number in [0, 100]",
        fix: `set opacity to a value between 0 and 100 (got ${el.opacity})`,
      });
    }

    // 枚举字段
    if (el.strokeStyle && !VALID_STROKE_STYLES.includes(el.strokeStyle)) {
      errors.push({
        level: "L2", path: `${prefix}.strokeStyle`,
        elementId: el.id, elementType: el.type, field: "strokeStyle",
        got: el.strokeStyle,
        expected: VALID_STROKE_STYLES,
        fix: `change strokeStyle to one of: ${VALID_STROKE_STYLES.join(", ")}`,
      });
    }

    if (el.fillStyle && !VALID_FILL_STYLES.includes(el.fillStyle)) {
      errors.push({
        level: "L2", path: `${prefix}.fillStyle`,
        elementId: el.id, elementType: el.type, field: "fillStyle",
        got: el.fillStyle,
        expected: VALID_FILL_STYLES,
        fix: `change fillStyle to one of: ${VALID_FILL_STYLES.join(", ")}`,
      });
    }

    // text 元素特有字段
    if (el.type === "text") {
      for (const field of ["text", "fontSize", "fontFamily"]) {
        if (el[field] === undefined || el[field] === null) {
          errors.push({
            level: "L2", path: `${prefix}.${field}`,
            elementId: el.id, elementType: el.type, field,
            got: "missing",
            expected: field === "text" ? "string" : "number > 0",
            fix: `add "${field}" to text element ${elDesc}. ${
              field === "text" ? 'e.g. "text": "Hello"' :
              field === "fontSize" ? 'e.g. "fontSize": 16' :
              'e.g. "fontFamily": 1 (1=Virgil, 2=Helvetica, 3=Cascadia)'
            }`,
          });
        }
      }
    }

    // arrow/line 元素特有字段
    if (el.type === "arrow" || el.type === "line") {
      if (!Array.isArray(el.points)) {
        errors.push({
          level: "L2", path: `${prefix}.points`,
          elementId: el.id, elementType: el.type, field: "points",
          got: el.points === undefined ? "missing" : typeof el.points,
          expected: "array of [x, y] pairs",
          fix: `add "points" as array of [x, y] pairs, e.g. [[0, 0], [100, 50]]`,
        });
      } else {
        el.points.forEach((pt: any, pi: number) => {
          if (!Array.isArray(pt) || pt.length < 2 ||
              typeof pt[0] !== "number" || typeof pt[1] !== "number") {
            errors.push({
              level: "L2", path: `${prefix}.points[${pi}]`,
              elementId: el.id, elementType: el.type, field: "points",
              got: JSON.stringify(pt),
              expected: "[number, number]",
              fix: `fix points[${pi}] to be [x, y] pair of numbers`,
            });
          }
        });
      }
    }

    // image 元素：fileId 必须存在于 files 中
    if (el.type === "image") {
      if (!el.fileId) {
        errors.push({
          level: "L2", path: `${prefix}.fileId`,
          elementId: el.id, elementType: el.type, field: "fileId",
          got: "missing",
          expected: "string (file ID referencing files object)",
          fix: `add "fileId" field referencing an entry in the "files" object`,
        });
      } else if (!files[el.fileId]) {
        errors.push({
          level: "L2", path: `${prefix}.fileId`,
          elementId: el.id, elementType: el.type, field: "fileId",
          got: el.fileId,
          expected: `existing key in files object (available: ${Object.keys(files).join(", ") || "none"})`,
          fix: `add file entry with id "${el.fileId}" to the "files" object with mimeType and dataURL`,
        });
      }
    }
  });

  return errors;
}
```

**Step 2: 补充测试**

测试 L2 各种 case：opacity 超范围、未知 type、text 缺字段、arrow 缺 points 等。

**Step 3: 运行测试，提交**

---

## Task 4: Validator — L3 引用完整性 + validate 入口函数

**Files:**
- Modify: `src/validator.ts`
- Modify: `src/validator.test.ts`

**Step 1: 实现 L3 引用校验**

```typescript
function validateL3(elements: any[]): ValidationError[] {
  const warnings: ValidationError[] = [];
  const elementIds = new Set(elements.map(e => e.id));

  elements.forEach((el, index) => {
    const prefix = `$.elements[${index}]`;

    // boundElements 引用检查
    if (Array.isArray(el.boundElements)) {
      el.boundElements.forEach((bound: any, bi: number) => {
        if (bound.id && !elementIds.has(bound.id)) {
          warnings.push({
            level: "L3", path: `${prefix}.boundElements[${bi}].id`,
            elementId: el.id, elementType: el.type, field: "boundElements",
            got: bound.id,
            expected: "existing element id",
            fix: `element "${bound.id}" referenced in boundElements does not exist. Either add it or remove this entry`,
          });
        }
      });
    }

    // containerId 引用检查
    if (el.containerId && !elementIds.has(el.containerId)) {
      warnings.push({
        level: "L3", path: `${prefix}.containerId`,
        elementId: el.id, elementType: el.type, field: "containerId",
        got: el.containerId,
        expected: "existing element id",
        fix: `container element "${el.containerId}" does not exist. Either add it or set containerId to null`,
      });
    }

    // arrow binding 引用检查
    if (el.type === "arrow") {
      for (const side of ["startBinding", "endBinding"]) {
        const binding = el[side];
        if (binding && binding.elementId && !elementIds.has(binding.elementId)) {
          warnings.push({
            level: "L3", path: `${prefix}.${side}.elementId`,
            elementId: el.id, elementType: el.type, field: side,
            got: binding.elementId,
            expected: "existing element id",
            fix: `${side} references element "${binding.elementId}" which does not exist. Either add it or set ${side} to null`,
          });
        }
      }
    }
  });

  return warnings;
}
```

**Step 2: 组装 validate 入口函数**

```typescript
export function validate(data: any): ValidationResult {
  // L1
  const l1Errors = validateL1(data);
  if (l1Errors.length > 0) {
    return {
      valid: false,
      errors: l1Errors,
      warnings: [],
      summary: { totalElements: 0, validElements: 0, errorCount: l1Errors.length, warningCount: 0 },
    };
  }

  // L2
  const l2Errors = validateL2(data.elements, data.files || {});

  // L3
  const l3Warnings = validateL3(data.elements);

  // 统计
  const errorElementIds = new Set(l2Errors.map(e => e.elementId));
  const totalElements = data.elements.length;
  const validElements = totalElements - errorElementIds.size;

  return {
    valid: l2Errors.length === 0,
    errors: l2Errors,
    warnings: l3Warnings,
    summary: { totalElements, validElements, errorCount: l2Errors.length, warningCount: l3Warnings.length },
  };
}
```

**Step 3: 用示例文件测试**

```typescript
it("示例文件 code-review-flow.excalidraw 应通过校验", () => {
  const data = JSON.parse(fs.readFileSync(
    "/Users/bytedance/code/github/cc-excalidraw-skill/code-review-flow.excalidraw", "utf-8"
  ));
  const result = validate(data);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});
```

**Step 4: 提交**

---

## Task 5: 字体准备

**Files:**
- Create: `fonts/` 目录
- Create: `src/fonts.ts`

**Step 1: 从 Excalidraw 源码复制字体文件**

```bash
mkdir -p /Users/bytedance/code/github/excalidraw2png/fonts
cp /Users/bytedance/code/github/excalidraw/packages/excalidraw/fonts/Virgil/Virgil-Regular.woff2 fonts/
cp /Users/bytedance/code/github/excalidraw/packages/excalidraw/fonts/Cascadia/CascadiaCode-Regular.woff2 fonts/
cp /Users/bytedance/code/github/excalidraw/packages/excalidraw/fonts/Liberation/LiberationSans-Regular.woff2 fonts/
```

注意：node-canvas 的 registerFont 需要 .ttf 或 .otf 文件，不支持 .woff2。需要转换格式或寻找替代方案。

**方案：使用 .ttf 格式字体**
- 在线转换 woff2 → ttf，或直接使用 Google Fonts / 系统字体
- Virgil → 使用 Excalidraw 提供的字体（需确认源码中是否有 ttf 版本）
- 备选：用 `@fontsource` npm 包获取 ttf

**Step 2: 创建字体注册模块 src/fonts.ts**

```typescript
import { registerFont } from "canvas";
import path from "path";

const FONTS_DIR = path.join(__dirname, "..", "fonts");

// fontFamily 映射
// Excalidraw: 1=Virgil(手写), 2=Helvetica(无衬线), 3=Cascadia(等宽)
const FONT_FAMILY_MAP: Record<number, string> = {
  1: "Virgil",
  2: "Liberation Sans",  // Helvetica 替代
  3: "Cascadia Code",
};

export function registerFonts(): void {
  registerFont(path.join(FONTS_DIR, "Virgil-Regular.ttf"), { family: "Virgil" });
  registerFont(path.join(FONTS_DIR, "LiberationSans-Regular.ttf"), { family: "Liberation Sans" });
  registerFont(path.join(FONTS_DIR, "CascadiaCode-Regular.ttf"), { family: "Cascadia Code" });
}

export function getFontFamily(fontFamilyId: number): string {
  return FONT_FAMILY_MAP[fontFamilyId] || "Liberation Sans";
}

export function getFontString(fontSize: number, fontFamilyId: number): string {
  return `${fontSize}px "${getFontFamily(fontFamilyId)}"`;
}
```

**Step 3: 提交**

---

## Task 6: 核心渲染器 — Canvas 初始化和坐标系

**Files:**
- Create: `src/renderer.ts`

**Step 1: 实现渲染器骨架**

移植自 Excalidraw 的 `scene/export.ts` → `_exportToCanvas` 和 `renderer/staticScene.ts` → `_renderStaticScene`。

```typescript
import { createCanvas, Canvas } from "canvas";
import rough from "roughjs";
import { ExcalidrawFile, ExcalidrawElement } from "./types";
import { registerFonts } from "./fonts";

export interface RenderOptions {
  scale: number;        // 导出倍率，默认 1
  background: boolean;  // 是否绘制背景，默认 true
  darkMode: boolean;    // 深色模式，默认 false
  padding: number;      // 内边距像素，默认 10
}

// 计算所有元素的 bounding box
function getCanvasSize(elements: ExcalidrawElement[], padding: number) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of elements) {
    // 考虑旋转后的边界
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const angle = el.angle || 0;

    // 四个角点
    const corners = [
      [el.x, el.y],
      [el.x + el.width, el.y],
      [el.x + el.width, el.y + el.height],
      [el.x, el.y + el.height],
    ];

    for (const [px, py] of corners) {
      const rx = Math.cos(angle) * (px - cx) - Math.sin(angle) * (py - cy) + cx;
      const ry = Math.sin(angle) * (px - cx) + Math.cos(angle) * (py - cy) + cy;
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }

    // 对于 arrow/line，还要考虑 points
    if ((el.type === "arrow" || el.type === "line") && Array.isArray((el as any).points)) {
      for (const [px, py] of (el as any).points) {
        const ax = el.x + px;
        const ay = el.y + py;
        minX = Math.min(minX, ax);
        minY = Math.min(minY, ay);
        maxX = Math.max(maxX, ax);
        maxY = Math.max(maxY, ay);
      }
    }
  }

  const width = (maxX - minX) + padding * 2;
  const height = (maxY - minY) + padding * 2;
  return { minX, minY, width, height };
}

export function render(data: ExcalidrawFile, options: RenderOptions): Buffer {
  registerFonts();

  // 过滤已删除的元素
  const elements = data.elements.filter(el => !el.isDeleted);

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
    ctx.fillStyle = data.appState.viewBackgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 坐标变换：缩放 + 平移到 padding 位置
  ctx.scale(options.scale, options.scale);
  ctx.translate(-minX + options.padding, -minY + options.padding);

  // 逐元素渲染
  for (const element of elements) {
    ctx.save();
    ctx.globalAlpha = (element.opacity ?? 100) / 100;
    renderElement(element, rc, ctx, data.files);
    ctx.restore();
  }

  return canvas.toBuffer("image/png");
}
```

**Step 2: 提交**

---

## Task 7: 元素渲染 — 基础形状 (rectangle, ellipse, diamond)

**Files:**
- Create: `src/elements/shapes.ts`

**Step 1: 实现形状渲染**

移植自 Excalidraw `element/renderElement.ts` 第 394-403 行和 `element/shape.ts` 的 `generateRoughOptions`。

```typescript
import type { Options } from "roughjs/bin/core";
import type { RoughCanvas } from "roughjs/bin/canvas";
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

  // strokeStyle → strokeLineDash
  if (element.strokeStyle === "dashed") {
    options.strokeLineDash = [8, 8 + element.strokeWidth];
    options.strokeWidth = element.strokeWidth + 0.5;
  } else if (element.strokeStyle === "dotted") {
    options.strokeLineDash = [1.5, 6 + element.strokeWidth];
    options.strokeWidth = element.strokeWidth + 0.5;
  }
  if (element.strokeStyle !== "solid") {
    options.disableMultiStroke = true;
  }

  // 填充
  if (element.backgroundColor && element.backgroundColor !== "transparent") {
    options.fill = element.backgroundColor;
    options.fillStyle = element.fillStyle;
    options.fillWeight = element.strokeWidth / 2;
    options.hachureGap = element.strokeWidth * 4;
  }

  return options;
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
    rc.rectangle(0, 0, element.width, element.height, options);
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
      element.width / 2, element.height / 2,
      element.width, element.height,
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
    // 菱形四个顶点
    rc.polygon([
      [w / 2, 0],
      [w, h / 2],
      [w / 2, h],
      [0, h / 2],
    ], options);
  });
}

// 坐标变换：平移到元素位置 + 旋转
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
```

**Step 2: 提交**

---

## Task 8: 元素渲染 — 文本

**Files:**
- Create: `src/elements/text.ts`

**Step 1: 实现文本渲染**

移植自 Excalidraw `element/renderElement.ts` 第 546-599 行。

```typescript
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
    ctx.textAlign = element.textAlign as CanvasTextAlign;
    ctx.textBaseline = "top";

    const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
    const lineHeightPx = element.fontSize * (element.lineHeight || 1.25);

    // 水平偏移
    let horizontalOffset = 0;
    if (element.textAlign === "center") {
      horizontalOffset = element.width / 2;
    } else if (element.textAlign === "right") {
      horizontalOffset = element.width;
    }

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(
        lines[i],
        horizontalOffset,
        i * lineHeightPx,
      );
    }
  });
}
```

**Step 2: 提交**

---

## Task 9: 元素渲染 — 线条和箭头

**Files:**
- Create: `src/elements/linear.ts`

**Step 1: 实现线条和箭头渲染**

箭头是最复杂的部分。从 Excalidraw 移植简化版：

```typescript
import type { Options } from "roughjs/bin/core";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { ExcalidrawLinearElement } from "../types";
import { generateRoughOptions } from "./shapes";

export function renderLinear(
  element: ExcalidrawLinearElement,
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
): void {
  ctx.save();
  ctx.translate(element.x, element.y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const options = generateRoughOptions(element);
  const points = element.points;

  if (points.length < 2) {
    ctx.restore();
    return;
  }

  // 绘制路径
  if (points.length === 2) {
    rc.line(points[0][0], points[0][1], points[1][0], points[1][1], options);
  } else {
    rc.linearPath(points as [number, number][], options);
  }

  // 绘制箭头帽
  if (element.type === "arrow") {
    const arrowOptions: Options = {
      ...options,
      fill: undefined,    // 箭头帽不填充（简化版）
      fillStyle: "solid",
    };

    if (element.endArrowhead === "arrow") {
      renderArrowhead(ctx, rc, points, "end", arrowOptions, element.strokeWidth);
    }
    if (element.startArrowhead === "arrow") {
      renderArrowhead(ctx, rc, points, "start", arrowOptions, element.strokeWidth);
    }
  }

  ctx.restore();
}

function renderArrowhead(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  points: [number, number][],
  position: "start" | "end",
  options: Options,
  strokeWidth: number,
): void {
  const arrowLength = strokeWidth * 4 + 10;
  const arrowAngle = (25 * Math.PI) / 180; // 25 度

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

  // 左右两个翼点
  const leftX = tipX - arrowLength * (nx * Math.cos(arrowAngle) - ny * Math.sin(arrowAngle));
  const leftY = tipY - arrowLength * (nx * Math.sin(arrowAngle) + ny * Math.cos(arrowAngle));
  const rightX = tipX - arrowLength * (nx * Math.cos(-arrowAngle) - ny * Math.sin(-arrowAngle));
  const rightY = tipY - arrowLength * (nx * Math.sin(-arrowAngle) + ny * Math.cos(-arrowAngle));

  rc.line(leftX, leftY, tipX, tipY, options);
  rc.line(rightX, rightY, tipX, tipY, options);
}
```

**Step 2: 提交**

---

## Task 10: 渲染器分发 + render 函数完成

**Files:**
- Modify: `src/renderer.ts`

**Step 1: 补全 renderElement 分发逻辑**

```typescript
import { renderRectangle, renderEllipse, renderDiamond } from "./elements/shapes";
import { renderText } from "./elements/text";
import { renderLinear } from "./elements/linear";

function renderElement(
  element: ExcalidrawElement,
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  files: Record<string, any>,
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
      // TODO: Phase 2
      break;
    case "image":
      // TODO: Phase 2
      break;
    case "frame":
    case "magicframe":
      // frame 不渲染自身，只作为裁剪容器
      break;
    default:
      // 未知类型，静默跳过
      break;
  }
}
```

**Step 2: 提交**

---

## Task 11: CLI 命令行入口

**Files:**
- Create: `src/cli.ts`
- Modify: `package.json` (bin 配置)

**Step 1: 实现 CLI**

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { validate } from "./validator";
import { render, RenderOptions } from "./renderer";
import { ValidationResult } from "./types";

const program = new Command();

program.name("excalidraw2png").version("0.1.0");

// validate 命令
program
  .command("validate <file>")
  .description("校验 .excalidraw 文件格式")
  .option("--json", "以 JSON 格式输出（方便程序解析）")
  .action((file: string, opts: { json?: boolean }) => {
    const filePath = path.resolve(file);
    let data: any;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(content);
    } catch (e: any) {
      if (e.code === "ENOENT") {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
      }
      // JSON 解析错误
      const result: ValidationResult = {
        valid: false,
        errors: [{
          level: "L1", path: "$", got: "invalid JSON", expected: "valid JSON",
          fix: `JSON syntax error: ${e.message}`,
        }],
        warnings: [],
        summary: { totalElements: 0, validElements: 0, errorCount: 1, warningCount: 0 },
      };
      outputResult(result, opts.json ?? false);
      process.exit(1);
    }

    const result = validate(data);
    outputResult(result, opts.json ?? false);
    process.exit(result.valid ? 0 : 1);
  });

// convert 命令
program
  .command("convert <file>")
  .description("将 .excalidraw 转换为 PNG")
  .requiredOption("-o, --output <path>", "输出 PNG 文件路径")
  .option("--scale <n>", "导出倍率", "1")
  .option("--no-background", "不绘制背景色")
  .option("--dark-mode", "深色模式")
  .option("--padding <n>", "内边距像素", "10")
  .action((file: string, opts: any) => {
    const filePath = path.resolve(file);
    let data: any;

    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e: any) {
      console.error(`Failed to read file: ${e.message}`);
      process.exit(1);
    }

    // 转换前校验
    const validation = validate(data);
    if (validation.errors.some(e => e.level === "L1")) {
      console.error("Cannot convert: file has structural errors (L1)");
      outputResult(validation, false);
      process.exit(1);
    }
    if (validation.errors.length > 0) {
      console.warn(`Warning: ${validation.errors.length} element error(s), affected elements will be skipped`);
    }

    const renderOptions: RenderOptions = {
      scale: parseFloat(opts.scale),
      background: opts.background !== false,
      darkMode: opts.darkMode ?? false,
      padding: parseInt(opts.padding),
    };

    try {
      const pngBuffer = render(data, renderOptions);
      const outputPath = path.resolve(opts.output);
      fs.writeFileSync(outputPath, pngBuffer);
      console.log(`PNG saved to ${outputPath} (${pngBuffer.length} bytes)`);
    } catch (e: any) {
      console.error(`Render failed: ${e.message}`);
      process.exit(1);
    }
  });

function outputResult(result: ValidationResult, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // 人类可读格式
  for (const err of result.errors) {
    const elInfo = err.elementId ? ` (${err.elementType})` : "";
    console.log(
      `ERROR [${err.level}] ${err.path}${elInfo}: got ${JSON.stringify(err.got)}, ` +
      `expected ${JSON.stringify(err.expected)}. Fix: ${err.fix}`
    );
  }
  for (const warn of result.warnings) {
    console.log(
      `WARN  [${warn.level}] ${warn.path}: ${warn.fix}`
    );
  }

  if (result.valid) {
    console.log(`OK: ${result.summary.totalElements} elements, all valid`);
  } else {
    console.log(
      `FAILED: ${result.summary.errorCount} error(s), ${result.summary.warningCount} warning(s) ` +
      `(${result.summary.validElements}/${result.summary.totalElements} elements valid)`
    );
  }
}

program.parse();
```

**Step 2: package.json 添加 bin 和 scripts**

```json
{
  "bin": {
    "excalidraw2png": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "tsc && node --test dist/**/*.test.js"
  }
}
```

**Step 3: 提交**

---

## Task 12: 端到端测试 — 用示例文件验证

**Files:**
- Create: `test/e2e.test.ts`

**Step 1: 编译并测试 validate**

```bash
npm run build
node dist/cli.js validate /Users/bytedance/code/github/cc-excalidraw-skill/code-review-flow.excalidraw
node dist/cli.js validate /Users/bytedance/code/github/cc-excalidraw-skill/code-review-flow.excalidraw --json
```

**Step 2: 测试 convert**

```bash
node dist/cli.js convert /Users/bytedance/code/github/cc-excalidraw-skill/code-review-flow.excalidraw -o /tmp/test-output.png
# 然后用 open /tmp/test-output.png 查看结果
```

**Step 3: 对比原版导出，检查渲染差异**

**Step 4: 提交**

---

## Task 13: npm link 全局安装

```bash
cd /Users/bytedance/code/github/excalidraw2png
npm link
# 现在可以全局使用
excalidraw2png validate xxx.excalidraw
excalidraw2png convert xxx.excalidraw -o output.png
```

---

## 任务优先级

Phase 1（MVP）: Task 1-12，支持 validate + convert 基础元素（矩形、椭圆、菱形、文本、箭头、线条）
Phase 2（扩展）: 添加 freedraw、image、frame 支持
Phase 3（优化）: 深色模式、箭头帽完善（circle/diamond/triangle 变体）、PNG 元数据嵌入
