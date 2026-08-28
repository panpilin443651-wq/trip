import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // สคริปต์ดูแลข้อมูลจังหวัด รันด้วย Node ตรง ๆ (CommonJS)
    // ไม่ได้อยู่ในแอปและไม่ถูกรวมเข้า build จึงไม่ต้องใช้กฎของ Next
    "scripts/**",
  ]),
]);

export default eslintConfig;
