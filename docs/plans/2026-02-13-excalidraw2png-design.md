# excalidraw2png 设计文档

## 目标

CLI 工具，提供两个核心命令：
1. **validate** — 校验 .excalidraw 文件格式，输出结构化错误信息
2. **convert** — 将 .excalidraw 文件转换为 PNG，渲染效果与 Excalidraw 官方导出保持一致

典型工作流：agent 生成 .excalidraw 文件 → validate 校验 → convert 转 PNG

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

**输出格式（默认人类可读）：**
```
ERROR [L1] 缺少 elements 数组
ERROR [L2] 元素 "abc123" (rectangle): opacity 值 150 超出范围 [0, 100]
WARN  [L3] 元素 "arrow-1" (arrow): startBinding 引用的元素 "box-99" 不存在
```

**JSON 格式（--json）：**
```json
{
  "valid": false,
  "errors": [
    {"level": "L1", "message": "缺少 elements 数组", "path": "$.elements"},
    {"level": "L2", "elementId": "abc123", "elementType": "rectangle", "message": "opacity 值 150 超出范围 [0, 100]", "path": "$.elements[0].opacity"}
  ],
  "warnings": [
    {"level": "L3", "elementId": "arrow-1", "elementType": "arrow", "message": "startBinding 引用的元素 \"box-99\" 不存在"}
  ],
  "summary": {"total": 20, "valid": 18, "errors": 1, "warnings": 1}
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
