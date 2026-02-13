import { registerFont } from "canvas";
import * as fs from "fs";
import * as path from "path";
import { decompress } from "wawoff2";

const FONTS_DIR = path.join(__dirname, "..", "fonts");
const CACHE_DIR = path.join(FONTS_DIR, ".ttf-cache");

// Excalidraw fontFamily ID → 字体配置
const FONT_CONFIG: Record<number, { name: string; woff2: string; fallback: string }> = {
  1: { name: "Virgil", woff2: "Virgil-Regular.woff2", fallback: "serif" },
  2: { name: "Liberation Sans", woff2: "LiberationSans-Regular.woff2", fallback: "Helvetica, Arial, sans-serif" },
  3: { name: "Cascadia Code", woff2: "CascadiaCode-Regular.woff2", fallback: "Menlo, Courier New, monospace" },
};

let fontsRegistered = false;

// woff2 → ttf 转换并缓存
async function convertWoff2ToTtf(woff2Path: string, ttfPath: string): Promise<void> {
  const woff2Buf = fs.readFileSync(woff2Path);
  const ttfBuf = await decompress(woff2Buf);
  fs.mkdirSync(path.dirname(ttfPath), { recursive: true });
  fs.writeFileSync(ttfPath, Buffer.from(ttfBuf));
}

export async function registerFonts(): Promise<void> {
  if (fontsRegistered) return;

  for (const [, config] of Object.entries(FONT_CONFIG)) {
    const woff2Path = path.join(FONTS_DIR, config.woff2);
    const ttfPath = path.join(CACHE_DIR, config.woff2.replace(".woff2", ".ttf"));

    if (!fs.existsSync(woff2Path)) {
      // 字体文件不存在，使用系统 fallback
      continue;
    }

    // 如果 ttf 缓存不存在或比 woff2 旧，重新转换
    if (
      !fs.existsSync(ttfPath) ||
      fs.statSync(woff2Path).mtimeMs > fs.statSync(ttfPath).mtimeMs
    ) {
      await convertWoff2ToTtf(woff2Path, ttfPath);
    }

    try {
      registerFont(ttfPath, { family: config.name });
    } catch {
      // 注册失败，使用系统 fallback
    }
  }

  fontsRegistered = true;
}

export function getFontFamily(fontFamilyId: number): string {
  const config = FONT_CONFIG[fontFamilyId];
  return config ? config.name : "Liberation Sans";
}

export function getFontString(fontSize: number, fontFamilyId: number): string {
  return `${fontSize}px "${getFontFamily(fontFamilyId)}"`;
}
