import { ValidationError, ValidationResult } from "./types";

const KNOWN_ELEMENT_TYPES = [
  "rectangle",
  "ellipse",
  "diamond",
  "line",
  "arrow",
  "freedraw",
  "text",
  "image",
  "frame",
  "magicframe",
  "iframe",
  "embeddable",
];

const VALID_STROKE_STYLES = ["solid", "dashed", "dotted"];
const VALID_FILL_STYLES = ["hachure", "cross-hatch", "solid", "zigzag"];
const VALID_TEXT_ALIGN = ["left", "center", "right"];
const VALID_VERTICAL_ALIGN = ["top", "middle", "bottom"];

const REQUIRED_BASE_FIELDS = [
  "id",
  "type",
  "x",
  "y",
  "width",
  "height",
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
  "seed",
];

const NUMERIC_FIELDS = [
  "x",
  "y",
  "width",
  "height",
  "opacity",
  "strokeWidth",
  "roughness",
  "seed",
  "angle",
];

// --- L1: 顶层结构校验 ---

function validateL1(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    errors.push({
      level: "L1",
      path: "$",
      got: Array.isArray(data) ? "array" : typeof data,
      expected: "object",
      fix: 'the file must contain a JSON object with "type", "elements", "appState", and "files" fields',
    });
    return errors;
  }

  if (data.type !== "excalidraw") {
    errors.push({
      level: "L1",
      path: "$.type",
      field: "type",
      got: data.type ?? "missing",
      expected: "excalidraw",
      fix: 'set "type" to "excalidraw"',
    });
  }

  if (!Array.isArray(data.elements)) {
    errors.push({
      level: "L1",
      path: "$.elements",
      field: "elements",
      got: data.elements === undefined ? "missing" : typeof data.elements,
      expected: "array",
      fix: 'add "elements" field as an array of element objects',
    });
  }

  if (typeof data.appState !== "object" || data.appState === null || Array.isArray(data.appState)) {
    errors.push({
      level: "L1",
      path: "$.appState",
      field: "appState",
      got: data.appState === undefined ? "missing" : typeof data.appState,
      expected: "object",
      fix: 'add "appState" field as an object, e.g. {"viewBackgroundColor": "#ffffff"}',
    });
  }

  if (
    typeof data.files !== "object" ||
    data.files === null ||
    Array.isArray(data.files)
  ) {
    errors.push({
      level: "L1",
      path: "$.files",
      field: "files",
      got: data.files === undefined ? "missing" : typeof data.files,
      expected: "object",
      fix: 'add "files" field as an object (can be empty: {})',
    });
  }

  return errors;
}

// --- L2: 元素校验 ---

function validateL2(
  elements: any[],
  files: Record<string, any>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  elements.forEach((el, index) => {
    const prefix = `$.elements[${index}]`;
    const elDesc = el.id ? `"${el.id}"` : `index ${index}`;

    // 必填字段
    for (const field of REQUIRED_BASE_FIELDS) {
      if (el[field] === undefined || el[field] === null) {
        errors.push({
          level: "L2",
          path: `${prefix}.${field}`,
          elementId: el.id,
          elementType: el.type,
          field,
          got: "missing",
          expected: field === "type" ? KNOWN_ELEMENT_TYPES : "required field",
          fix: `add "${field}" field to element ${elDesc}`,
        });
      }
    }

    // type 枚举
    if (el.type && !KNOWN_ELEMENT_TYPES.includes(el.type)) {
      errors.push({
        level: "L2",
        path: `${prefix}.type`,
        elementId: el.id,
        elementType: el.type,
        field: "type",
        got: el.type,
        expected: KNOWN_ELEMENT_TYPES,
        fix: `change type to one of: ${KNOWN_ELEMENT_TYPES.join(", ")}`,
      });
    }

    // 数值字段类型
    for (const field of NUMERIC_FIELDS) {
      if (el[field] !== undefined && el[field] !== null && typeof el[field] !== "number") {
        errors.push({
          level: "L2",
          path: `${prefix}.${field}`,
          elementId: el.id,
          elementType: el.type,
          field,
          got: `${typeof el[field]} (${JSON.stringify(el[field])})`,
          expected: "number",
          fix: `change "${field}" to a number value`,
        });
      }
    }

    // opacity 范围
    if (
      typeof el.opacity === "number" &&
      (el.opacity < 0 || el.opacity > 100)
    ) {
      errors.push({
        level: "L2",
        path: `${prefix}.opacity`,
        elementId: el.id,
        elementType: el.type,
        field: "opacity",
        got: el.opacity,
        expected: "number in [0, 100]",
        fix: `set opacity to a value between 0 and 100 (got ${el.opacity})`,
      });
    }

    // strokeStyle 枚举
    if (el.strokeStyle && !VALID_STROKE_STYLES.includes(el.strokeStyle)) {
      errors.push({
        level: "L2",
        path: `${prefix}.strokeStyle`,
        elementId: el.id,
        elementType: el.type,
        field: "strokeStyle",
        got: el.strokeStyle,
        expected: VALID_STROKE_STYLES,
        fix: `change strokeStyle to one of: ${VALID_STROKE_STYLES.join(", ")}`,
      });
    }

    // fillStyle 枚举
    if (el.fillStyle && !VALID_FILL_STYLES.includes(el.fillStyle)) {
      errors.push({
        level: "L2",
        path: `${prefix}.fillStyle`,
        elementId: el.id,
        elementType: el.type,
        field: "fillStyle",
        got: el.fillStyle,
        expected: VALID_FILL_STYLES,
        fix: `change fillStyle to one of: ${VALID_FILL_STYLES.join(", ")}`,
      });
    }

    // --- text 元素 ---
    if (el.type === "text") {
      for (const field of ["text", "fontSize", "fontFamily"]) {
        if (el[field] === undefined || el[field] === null) {
          const hint =
            field === "text"
              ? '"text": "Hello"'
              : field === "fontSize"
                ? '"fontSize": 16'
                : '"fontFamily": 1 (1=Virgil/hand-drawn, 2=Helvetica/sans-serif, 3=Cascadia/monospace)';
          errors.push({
            level: "L2",
            path: `${prefix}.${field}`,
            elementId: el.id,
            elementType: el.type,
            field,
            got: "missing",
            expected: field === "text" ? "string" : "number > 0",
            fix: `add ${hint} to text element ${elDesc}`,
          });
        }
      }

      if (el.textAlign && !VALID_TEXT_ALIGN.includes(el.textAlign)) {
        errors.push({
          level: "L2",
          path: `${prefix}.textAlign`,
          elementId: el.id,
          elementType: el.type,
          field: "textAlign",
          got: el.textAlign,
          expected: VALID_TEXT_ALIGN,
          fix: `change textAlign to one of: ${VALID_TEXT_ALIGN.join(", ")}`,
        });
      }

      if (el.verticalAlign && !VALID_VERTICAL_ALIGN.includes(el.verticalAlign)) {
        errors.push({
          level: "L2",
          path: `${prefix}.verticalAlign`,
          elementId: el.id,
          elementType: el.type,
          field: "verticalAlign",
          got: el.verticalAlign,
          expected: VALID_VERTICAL_ALIGN,
          fix: `change verticalAlign to one of: ${VALID_VERTICAL_ALIGN.join(", ")}`,
        });
      }
    }

    // --- arrow/line 元素 ---
    if (el.type === "arrow" || el.type === "line") {
      if (!Array.isArray(el.points)) {
        errors.push({
          level: "L2",
          path: `${prefix}.points`,
          elementId: el.id,
          elementType: el.type,
          field: "points",
          got: el.points === undefined ? "missing" : typeof el.points,
          expected: "array of [x, y] pairs",
          fix: 'add "points" as array of [x, y] pairs, e.g. [[0, 0], [100, 50]]',
        });
      } else {
        el.points.forEach((pt: any, pi: number) => {
          if (
            !Array.isArray(pt) ||
            pt.length < 2 ||
            typeof pt[0] !== "number" ||
            typeof pt[1] !== "number"
          ) {
            errors.push({
              level: "L2",
              path: `${prefix}.points[${pi}]`,
              elementId: el.id,
              elementType: el.type,
              field: "points",
              got: JSON.stringify(pt),
              expected: "[number, number]",
              fix: `fix points[${pi}] to be [x, y] pair of numbers`,
            });
          }
        });
      }
    }

    // --- image 元素 ---
    if (el.type === "image") {
      if (!el.fileId) {
        errors.push({
          level: "L2",
          path: `${prefix}.fileId`,
          elementId: el.id,
          elementType: el.type,
          field: "fileId",
          got: "missing",
          expected: "string (file ID referencing files object)",
          fix: 'add "fileId" field referencing an entry in the "files" object',
        });
      } else if (!files[el.fileId]) {
        const available = Object.keys(files);
        errors.push({
          level: "L2",
          path: `${prefix}.fileId`,
          elementId: el.id,
          elementType: el.type,
          field: "fileId",
          got: el.fileId,
          expected: `existing key in files object (available: ${available.length > 0 ? available.join(", ") : "none"})`,
          fix: `add file entry with id "${el.fileId}" to the "files" object with mimeType and dataURL`,
        });
      }
    }
  });

  return errors;
}

// --- L3: 引用完整性 ---

function validateL3(elements: any[]): ValidationError[] {
  const warnings: ValidationError[] = [];
  const elementIds = new Set(elements.map((e) => e.id));

  elements.forEach((el, index) => {
    const prefix = `$.elements[${index}]`;

    // boundElements 引用
    if (Array.isArray(el.boundElements)) {
      el.boundElements.forEach((bound: any, bi: number) => {
        if (bound.id && !elementIds.has(bound.id)) {
          warnings.push({
            level: "L3",
            path: `${prefix}.boundElements[${bi}].id`,
            elementId: el.id,
            elementType: el.type,
            field: "boundElements",
            got: bound.id,
            expected: "existing element id",
            fix: `element "${bound.id}" referenced in boundElements does not exist. Either add it or remove this entry`,
          });
        }
      });
    }

    // containerId 引用
    if (el.containerId && !elementIds.has(el.containerId)) {
      warnings.push({
        level: "L3",
        path: `${prefix}.containerId`,
        elementId: el.id,
        elementType: el.type,
        field: "containerId",
        got: el.containerId,
        expected: "existing element id",
        fix: `container element "${el.containerId}" does not exist. Either add it or set containerId to null`,
      });
    }

    // arrow binding 引用
    if (el.type === "arrow") {
      for (const side of ["startBinding", "endBinding"] as const) {
        const binding = el[side];
        if (binding && binding.elementId && !elementIds.has(binding.elementId)) {
          warnings.push({
            level: "L3",
            path: `${prefix}.${side}.elementId`,
            elementId: el.id,
            elementType: el.type,
            field: side,
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

// --- 入口 ---

export function validate(data: any): ValidationResult {
  const l1Errors = validateL1(data);

  // L1 失败则无法继续
  if (l1Errors.length > 0) {
    return {
      valid: false,
      errors: l1Errors,
      warnings: [],
      summary: {
        totalElements: 0,
        validElements: 0,
        errorCount: l1Errors.length,
        warningCount: 0,
      },
    };
  }

  const l2Errors = validateL2(data.elements, data.files || {});
  const l3Warnings = validateL3(data.elements);

  const errorElementIds = new Set(l2Errors.map((e) => e.elementId).filter(Boolean));
  const totalElements = data.elements.length;
  const validElements = totalElements - errorElementIds.size;

  return {
    valid: l2Errors.length === 0,
    errors: l2Errors,
    warnings: l3Warnings,
    summary: {
      totalElements,
      validElements,
      errorCount: l2Errors.length,
      warningCount: l3Warnings.length,
    },
  };
}
