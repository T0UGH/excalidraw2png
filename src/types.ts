// 元素基础类型 — 从 Excalidraw 源码精简而来
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
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
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

export interface ExcalidrawLinearElement extends ExcalidrawElementBase {
  type: "line" | "arrow";
  points: [number, number][];
  startArrowhead: string | null;
  endArrowhead: string | null;
  startBinding: { elementId: string; focus: number; gap: number } | null;
  endBinding: { elementId: string; focus: number; gap: number } | null;
}

export interface ExcalidrawImageElement extends ExcalidrawElementBase {
  type: "image";
  fileId: string;
  status: "pending" | "saved" | "error";
  scale: [number, number];
  crop: { x: number; y: number; width: number; height: number } | null;
}

export interface ExcalidrawFreeDrawElement extends ExcalidrawElementBase {
  type: "freedraw";
  points: [number, number][];
  pressures: number[];
}

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
  files: Record<
    string,
    {
      mimeType: string;
      id: string;
      dataURL: string;
    }
  >;
}

// 校验结果
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
