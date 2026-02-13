# excalidraw2png 设计文档

## 目标

CLI 工具，提供两个核心命令：
1. **validate** — 校验 .excalidraw 文件格式，输出结构化错误信息
2. **convert** — 将 .excalidraw 文件转换为 PNG，渲染效果与 Excalidraw 官方导出保持一致

典型工作流：AI agent 生成 .excalidraw 文件 → validate 校验 → convert 转 PNG

**核心设计原则：错误信息的消费者是 AI agent，不是人类。**
每条错误必须包含足够信息让 agent 直接定位并修复问题：当前值、合法值、JSON 路径。

## 技术方案

Node.js + node-canvas (Cairo) + RoughJS

- **node-canvas**: 在 Node.js 中提供 Canvas 2D API
- **RoughJS**: 与 Excalidraw 相同的手绘风格渲染库，相同 seed 生成相同笔触
- **保真度**: ~95%，唯一差异在字体渲染（Cairo vs 浏览器）

## CLI 接口

```bash
# 校验格式
excalidraw2png validate input.excalidraw
excalidraw2png validate input.excalidraw --json    # JSON 格式输出，方便程序解析

# 转换为 PNG
excalidraw2png convert input.excalidraw -o output.png
excalidraw2png convert input.excalidraw --scale 2 --dark-mode --no-background
```

### validate 命令

校验 .excalidraw 文件，输出错误列表。退出码：0 = 无错误，1 = 有错误。

**校验规则分三层：**

**L1 结构校验（致命错误，无法转换）：**
- JSON 语法是否合法
- 顶层必须有 `type: "excalidraw"`
- 必须有 `elements` 数组
- 必须有 `appState` 对象
- 必须有 `files` 对象（可为空）

**L2 元素校验（单个元素有问题，可能导致该元素渲染失败）：**
- 每个元素必须有必填字段：id, type, x, y, width, height, strokeColor, backgroundColor, fillStyle, strokeWidth, strokeStyle, roughness, opacity, seed
- type 必须是已知类型：rectangle, ellipse, diamond, line, arrow, freedraw, text, image, frame, magicframe, iframe, embeddable
- 数值字段（x, y, width, height, opacity, fontSize, seed）必须是数字
- opacity 范围 0-100
- strokeStyle 必须是 solid/dashed/dotted
- fillStyle 必须是 hachure/cross-hatch/solid/zigzag
- text 元素必须有 text, fontSize, fontFamily 字段
- arrow/line 元素必须有 points 数组，每个点必须是 [x, y]
- image 元素必须有 fileId，且 fileId 必须在 files 中存在

**L3 引用完整性（不影响渲染，但可能是逻辑错误）：**
- boundElements 引用的元素 ID 必须存在
- containerId 引用的元素 ID 必须存在
- arrow 的 startBinding/endBinding 引用的 elementId 必须存在

**输出格式设计 — 面向 AI agent**

每条错误必须包含 4 个要素，让 agent 能直接修复：
1. **path** — JSON 路径，agent 知道改哪里
2. **got** — 当前值，agent 知道错在哪
3. **expected** — 合法值/范围，agent 知道改成什么
4. **fix** — 修复建议（一句话）

**默认输出（人类可读，但信息完整）：**
```
ERROR [L1] $.elements: missing required field "elements" (expected: array of element objects)
ERROR [L2] $.elements[0].opacity: got 150, expected number in [0, 100]. Fix: set opacity to a value between 0 and 100
ERROR [L2] $.elements[3].type: got "hexagon", expected one of: rectangle, ellipse, diamond, line, arrow, freedraw, text, image, frame, magicframe, iframe, embeddable. Fix: use a supported element type
ERROR [L2] $.elements[5].strokeStyle: got "wavy", expected one of: solid, dashed, dotted. Fix: change strokeStyle to "solid", "dashed", or "dotted"
ERROR [L2] $.elements[7] (text): missing required field "fontSize" (expected: number > 0). Fix: add "fontSize" field with a positive number, e.g. 16
ERROR [L2] $.elements[9] (arrow): "points" must be array of [x, y] pairs, got string. Fix: set points to array like [[0,0],[100,50]]
WARN  [L3] $.elements[2].boundElements[0].id: references element "box-99" which does not exist in elements array. Fix: ensure element with id "box-99" exists, or remove this boundElements entry
```

**JSON 格式（--json，推荐 agent 使用）：**
```json
{
  "valid": false,
  "errors": [
    {
      "level": "L2",
      "path": "$.elements[0].opacity",
      "elementId": "abc123",
      "elementType": "rectangle",
      "field": "opacity",
      "got": 150,
      "expected": "number in [0, 100]",
      "fix": "set opacity to a value between 0 and 100"
    },
    {
      "level": "L2",
      "path": "$.elements[3].type",
      "elementId": "shape-1",
      "field": "type",
      "got": "hexagon",
      "expected": ["rectangle", "ellipse", "diamond", "line", "arrow", "freedraw", "text", "image", "frame", "magicframe", "iframe", "embeddable"],
      "fix": "use a supported element type"
    }
  ],
  "warnings": [
    {
      "level": "L3",
      "path": "$.elements[2].boundElements[0].id",
      "elementId": "arrow-1",
      "elementType": "arrow",
      "field": "boundElements",
      "got": "box-99",
      "expected": "existing element id",
      "fix": "ensure element with id \"box-99\" exists, or remove this boundElements entry"
    }
  ],
  "summary": {"totalElements": 20, "validElements": 18, "errorCount": 2, "warningCount": 1}
}
```

### convert 命令

```bash
excalidraw2png convert input.excalidraw -o output.png
excalidraw2png convert input.excalidraw --scale 2 --dark-mode --no-background --padding 20
```

转换前自动运行 L1 + L2 校验，有 L1 错误则拒绝转换，有 L2 错误则跳过问题元素并警告。

## 数据流

```
validate:
  .excalidraw → JSON 解析 → L1 结构校验 → L2 元素校验 → L3 引用校验 → 输出报告

convert:
  .excalidraw → JSON 解析 → L1+L2 校验（失败则中止）
    → 过滤 isDeleted 元素 + 排序
    → 计算 bounding box + 创建 Canvas
    → 注册字体 + 加载 base64 图片
    → RoughJS 渲染形状 + Canvas API 渲染文本/图片
    → canvas.toBuffer('image/png')
    → 写入文件
```

## 支持的元素类型

| 类型 | 渲染方式 |
|------|---------|
| rectangle, ellipse, diamond | RoughJS 形状 |
| line, arrow | RoughJS 路径 + 箭头帽 |
| freedraw | Canvas Path2D |
| text | Canvas fillText |
| image | Canvas drawImage |
| frame | 裁剪遮罩 |

## 依赖

- `canvas` (node-canvas) — Canvas 2D API
- `roughjs` — 手绘风格渲染
- `commander` — CLI 参数解析

## 字体

从 Excalidraw 源码复制字体文件，通过 node-canvas registerFont 注册：
- Virgil (fontFamily=1) → `Virgil-Regular.woff2`
- Helvetica (fontFamily=2) → 系统字体 fallback（LiberationSans-Regular.woff2）
- Cascadia (fontFamily=3) → `CascadiaCode-Regular.woff2`

## 风险

1. 字体渲染微小差异（Cairo vs 浏览器引擎）— CLI 场景可接受
2. Frame 裁剪边界情况 — 需要测试验证
3. 箭头帽计算 — 从 Excalidraw 源码移植
