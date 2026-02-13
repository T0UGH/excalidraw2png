#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { validate } from "./validator";
import { render, RenderOptions } from "./renderer";
import { ValidationResult } from "./types";

const program = new Command();

program.name("excalidraw2png").version("0.1.0").description(
  "Validate and convert .excalidraw files to PNG",
);

// --- validate ---
program
  .command("validate <file>")
  .description("Validate .excalidraw file format")
  .option("--json", "Output as JSON (for programmatic use)")
  .action((file: string, opts: { json?: boolean }) => {
    const filePath = path.resolve(file);
    let data: any;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(content);
    } catch (e: any) {
      if (e.code === "ENOENT") {
        const result: ValidationResult = {
          valid: false,
          errors: [
            {
              level: "L1",
              path: "$",
              got: "file not found",
              expected: "readable .excalidraw file",
              fix: `file "${filePath}" does not exist. Check the path`,
            },
          ],
          warnings: [],
          summary: { totalElements: 0, validElements: 0, errorCount: 1, warningCount: 0 },
        };
        outputResult(result, opts.json ?? false);
        process.exit(1);
        return;
      }
      // JSON parse error
      const result: ValidationResult = {
        valid: false,
        errors: [
          {
            level: "L1",
            path: "$",
            got: "invalid JSON",
            expected: "valid JSON",
            fix: `JSON syntax error: ${e.message}`,
          },
        ],
        warnings: [],
        summary: { totalElements: 0, validElements: 0, errorCount: 1, warningCount: 0 },
      };
      outputResult(result, opts.json ?? false);
      process.exit(1);
      return;
    }

    const result = validate(data);
    outputResult(result, opts.json ?? false);
    process.exit(result.valid ? 0 : 1);
  });

// --- convert ---
program
  .command("convert <file>")
  .description("Convert .excalidraw file to PNG")
  .requiredOption("-o, --output <path>", "Output PNG file path")
  .option("--scale <n>", "Export scale factor", "1")
  .option("--no-background", "Transparent background")
  .option("--dark-mode", "Dark mode")
  .option("--padding <n>", "Padding in pixels", "10")
  .action(async (file: string, opts: any) => {
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
    if (validation.errors.some((e) => e.level === "L1")) {
      console.error("Cannot convert: file has structural errors (L1):");
      outputResult(validation, false);
      process.exit(1);
    }
    if (validation.errors.length > 0) {
      console.warn(
        `Warning: ${validation.errors.length} element error(s), affected elements may render incorrectly`,
      );
    }

    const renderOptions: RenderOptions = {
      scale: parseFloat(opts.scale),
      background: opts.background !== false,
      darkMode: opts.darkMode ?? false,
      padding: parseInt(opts.padding, 10),
    };

    try {
      const pngBuffer = await render(data, renderOptions);
      const outputPath = path.resolve(opts.output);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, pngBuffer);
      console.log(`PNG saved: ${outputPath} (${pngBuffer.length} bytes)`);
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

  for (const err of result.errors) {
    const elInfo = err.elementType ? ` (${err.elementType})` : "";
    console.log(
      `ERROR [${err.level}] ${err.path}${elInfo}: ` +
        `got ${JSON.stringify(err.got)}, expected ${JSON.stringify(err.expected)}. ` +
        `Fix: ${err.fix}`,
    );
  }
  for (const warn of result.warnings) {
    console.log(`WARN  [${warn.level}] ${warn.path}: ${warn.fix}`);
  }

  if (result.valid) {
    console.log(
      `OK: ${result.summary.totalElements} elements, all valid`,
    );
  } else {
    console.log(
      `FAILED: ${result.summary.errorCount} error(s), ${result.summary.warningCount} warning(s) ` +
        `(${result.summary.validElements}/${result.summary.totalElements} elements valid)`,
    );
  }
}

program.parse();
