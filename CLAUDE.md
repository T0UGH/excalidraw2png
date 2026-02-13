# excalidraw2png

## Project Overview

Node.js CLI tool that validates and converts `.excalidraw` files to PNG. Primary consumer is AI agents that generate Excalidraw diagrams.

## Tech Stack

- TypeScript (strict, commonjs, target ES2022)
- node-canvas (Cairo-based Canvas 2D for Node.js)
- RoughJS (hand-drawn style rendering, same library Excalidraw uses)
- commander (CLI framework)
- wawoff2 (WOFF2 → TTF font decompression)

## Project Structure

```
src/
  cli.ts            — CLI entry point (validate + convert commands)
  types.ts          — Type definitions (elements, validation results)
  validator.ts      — Three-layer validation (L1 structure, L2 elements, L3 references)
  renderer.ts       — Core renderer (canvas setup, bounding box, element dispatch)
  fonts.ts          — Font loading (woff2 → ttf conversion, caching)
  elements/
    shapes.ts       — Rectangle, ellipse, diamond rendering + RoughJS options
    text.ts         — Text rendering (multi-line, alignment, font families)
    linear.ts       — Line and arrow rendering (arrowheads, path drawing)
  canvas-types.d.ts — Module declarations for wawoff2
fonts/              — Bundled woff2 font files (Virgil, LiberationSans, CascadiaCode)
test/fixtures/      — .excalidraw test case files
docs/plans/         — Design and implementation documents
```

## Build & Run

```bash
npm install
npx -p typescript tsc        # build (do NOT use `npx tsc`, it installs the wrong package)
node dist/cli.js validate test/fixtures/case1-basic-shapes.excalidraw
node dist/cli.js convert test/fixtures/case1-basic-shapes.excalidraw -o /tmp/out.png
```

## Key Design Decisions

- **Bounding box for arrows/lines**: Use `points` array, NOT `width`/`height` (those values are unreliable for linear elements)
- **Font handling**: node-canvas `registerFont` doesn't support woff2. We use wawoff2 to decompress at runtime, cached in `fonts/.ttf-cache/`
- **Validation error format**: Each error has `path`, `got`, `expected`, `fix` — designed so AI agents can directly locate and fix issues
- **L1 errors block convert**: Structural errors prevent rendering. L2 errors warn but proceed.

## Supported Elements

rectangle, ellipse, diamond, text, line, arrow. Not yet: freedraw, image, frame.

## Font Family Mapping

- `1` → Virgil (hand-drawn)
- `2` → Liberation Sans (Helvetica substitute)
- `3` → Cascadia Code (monospace)

## Common Pitfalls

- `npx tsc` installs the wrong package `tsc@2.0.4`. Always use `npx -p typescript tsc`.
- `CanvasRenderingContext2D` must be imported from `"canvas"` package, not from DOM types.
- wawoff2 has no @types — declared in `src/canvas-types.d.ts`.
