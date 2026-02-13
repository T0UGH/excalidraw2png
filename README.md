# excalidraw2png

CLI tool to validate and convert `.excalidraw` files to PNG. Designed for AI agent workflows — generate `.excalidraw` JSON, validate it, convert to PNG.

## Quick Start

```bash
# No installation needed (recommended)
npx excalidraw2png validate diagram.excalidraw
npx excalidraw2png convert diagram.excalidraw -o output.png
```

Or install globally:

```bash
npm install -g excalidraw2png
excalidraw2png validate diagram.excalidraw
excalidraw2png convert diagram.excalidraw -o output.png
```

## Commands

### validate

Check `.excalidraw` file format. Returns structured errors with fix suggestions.

```bash
npx excalidraw2png validate diagram.excalidraw

# JSON output (for programmatic use)
npx excalidraw2png validate diagram.excalidraw --json
```

Exit code: `0` = valid, `1` = has errors.

**Three validation layers:**

| Layer | Scope | Severity |
|-------|-------|----------|
| L1 | File structure (`type`, `elements`, `appState`, `files`) | Fatal — blocks convert |
| L2 | Element fields (required fields, type enums, numeric ranges) | Error — element may render wrong |
| L3 | Reference integrity (`boundElements`, `containerId`, arrow bindings) | Warning — non-blocking |

**Error format (designed for AI agents):**

```
ERROR [L2] $.elements[3].strokeStyle (rectangle): got "wavy", expected ["solid","dashed","dotted"]. Fix: change strokeStyle to one of: solid, dashed, dotted
```

JSON output (`--json`) returns:

```json
{
  "valid": false,
  "errors": [
    {
      "level": "L2",
      "path": "$.elements[3].strokeStyle",
      "elementId": "abc123",
      "elementType": "rectangle",
      "field": "strokeStyle",
      "got": "wavy",
      "expected": ["solid", "dashed", "dotted"],
      "fix": "change strokeStyle to one of: solid, dashed, dotted"
    }
  ],
  "warnings": [],
  "summary": {
    "totalElements": 5,
    "validElements": 4,
    "errorCount": 1,
    "warningCount": 0
  }
}
```

### convert

Render `.excalidraw` file to PNG.

```bash
npx excalidraw2png convert diagram.excalidraw -o output.png

# Options
npx excalidraw2png convert diagram.excalidraw -o output.png --scale 2
npx excalidraw2png convert diagram.excalidraw -o output.png --no-background
npx excalidraw2png convert diagram.excalidraw -o output.png --padding 20
```

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <path>` | (required) | Output PNG file path |
| `--scale <n>` | `1` | Export scale factor (2 = retina) |
| `--no-background` | `false` | Transparent background |
| `--padding <n>` | `10` | Padding around content in pixels |

Convert runs validation first. L1 errors block conversion, L2 errors print warnings but proceed.

## Supported Elements

| Element | Status |
|---------|--------|
| rectangle | Supported (with roundness) |
| ellipse | Supported |
| diamond | Supported |
| text | Supported (3 font families, multi-line, alignment) |
| arrow | Supported (arrowheads, bindings) |
| line | Supported |
| freedraw | Not yet |
| image | Not yet |
| frame | Not yet |

## Rendering Details

- Uses [RoughJS](https://roughjs.com/) for hand-drawn style rendering (same as Excalidraw)
- Same `seed` value produces identical strokes
- Fill styles: solid, hachure, cross-hatch, zigzag
- Stroke styles: solid, dashed, dotted
- Font families: Virgil (hand-drawn), Helvetica (sans-serif), Cascadia (monospace)

## For AI Agents

Typical workflow:

```
1. Generate .excalidraw JSON
2. npx excalidraw2png validate file.excalidraw --json
3. If errors → read "fix" field → correct JSON → re-validate
4. npx excalidraw2png convert file.excalidraw -o output.png
```

Minimal valid `.excalidraw` file:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "agent",
  "elements": [
    {
      "type": "rectangle",
      "id": "r1",
      "x": 0, "y": 0, "width": 200, "height": 100,
      "angle": 0,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "transparent",
      "fillStyle": "solid",
      "strokeWidth": 2,
      "strokeStyle": "solid",
      "roughness": 1,
      "opacity": 100,
      "seed": 1,
      "version": 1,
      "versionNonce": 1,
      "isDeleted": false,
      "groupIds": [],
      "boundElements": null,
      "link": null,
      "locked": false,
      "roundness": null
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

## Requirements

- Node.js >= 18
- The `canvas` npm package requires system-level Cairo. On most systems this is handled automatically. If you get build errors, see [node-canvas prerequisites](https://github.com/Automattic/node-canvas#compiling).

## License

MIT
