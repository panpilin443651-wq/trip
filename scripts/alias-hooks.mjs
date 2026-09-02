/**
 * ให้ node รู้จัก path alias "@/" และเติมนามสกุล .ts ให้เอง
 *
 * ใช้ตอนอยากทดสอบตรรกะใน src/lib ด้วย node ตรง ๆ โดยไม่ต้องผ่าน Next
 *   node --experimental-strip-types --import ./scripts/alias-hooks.mjs test.mts
 * ต้องรันจากรากโปรเจกต์ และพาธของ --import ต้องเป็นแบบสัมพัทธ์
 * (พาธเต็มแบบ C:\... จะโดน node ปฏิเสธเพราะไม่ใช่ file:// URL)
 */
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "src");

function resolveFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of [".ts", ".tsx"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  const index = path.join(base, "index.ts");
  if (existsSync(index)) return index;
  return base;
}

/** แปลง file:// URL เป็นพาธของ Windows ได้ถูกต้อง */
function toPath(url) {
  return decodeURIComponent(new URL(url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      return next(pathToFileURL(resolveFile(path.join(SRC, specifier.slice(2)))).href, context);
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:") &&
      !/\.[mc]?[jt]sx?$/.test(specifier)
    ) {
      const dir = path.dirname(toPath(context.parentURL));
      return next(pathToFileURL(resolveFile(path.resolve(dir, specifier))).href, context);
    }
    return next(specifier, context);
  },
});
