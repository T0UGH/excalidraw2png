# excalidraw2png 设计文档

## 目标

CLI 工具，将 .excalidraw 文件转换为 PNG，渲染效果与 Excalidraw 官方导出保持一致。

## 技术方案

Node.js + node-canvas (Cairo) + RoughJS

- **node-canvas**: 在 Node.js 中提供 Canvas 2D API
- **RoughJS**: 与 Excalidraw 相同的手绘风格渲染库，相同 seed 生成相同笔触
- **保真度**: ~95%，唯一差异在字体渲染（Cairo vs 浏览器）

## 数据流

```
.excalidraw JSON
  → 解析 + 过滤已删除元素 + 排序
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

## CLI 接口

```bash
excalidraw2png input.excalidraw -o output.png
excalidraw2png input.excalidraw --scale 2 --dark-mode --no-background
```

## 依赖

- `canvas` (node-canvas)
- `roughjs`
- `commander`

## 字体

从 Excalidraw 源码复制字体文件（Virgil, Cascadia），通过 node-canvas registerFont 注册。

## 风险

1. 字体渲染微小差异（Cairo vs 浏览器引擎）— CLI 场景可接受
2. Frame 裁剪边界情况 — 需要测试验证
3. 箭头帽计算 — 从 Excalidraw 源码移植
