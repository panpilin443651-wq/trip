/**
 * โหมดสีของเว็บ — มืด/สว่าง
 *
 * ค่าที่ผู้ใช้เลือกเก็บใน localStorage ไม่ใช่คุกกี้ เพราะถ้าอ่านคุกกี้ใน root layout
 * ทั้งเว็บจะหลุดจากการ prerender แบบ static (ดู
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md)
 * แลกกับต้องมีสคริปต์ตัวเล็ก ๆ วิ่งก่อนหน้าเว็บถูกวาด
 */
export type Theme = "dark" | "light";

export const THEME_KEY = "theme";

/** สีของแถบบนสุดในเบราว์เซอร์มือถือ ต้องตรงกับ --color-canvas ของแต่ละโหมด */
export const THEME_COLOR: Record<Theme, string> = {
  dark: "#071b33",
  light: "#f2f7fc",
};

export const isTheme = (value: unknown): value is Theme =>
  value === "dark" || value === "light";

/**
 * สคริปต์ที่ฝังใน <head> ให้วิ่งตอนเบราว์เซอร์อ่าน HTML ก่อนวาดหน้าจอ
 *
 * ต้องทำก่อนวาด ไม่งั้นคนที่เลือกโหมดสว่างไว้จะเห็นหน้าจอดำวาบขึ้นมาก่อน
 * ทุกครั้งที่โหลดหน้า เขียนเป็นสตริงเพราะต้องวิ่งก่อน React จะทำงาน
 *
 * ยังไม่เคยเลือก = ตามการตั้งค่าของเครื่อง
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});
if(t!=="dark"&&t!=="light")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
document.documentElement.setAttribute("data-theme",t);
var m=document.querySelector('meta[name="theme-color"]');
if(m)m.setAttribute("content",t==="light"?${JSON.stringify(THEME_COLOR.light)}:${JSON.stringify(THEME_COLOR.dark)});
}catch(e){}})()`;

/** อ่านโหมดที่ควรใช้ตอนนี้ — ใช้ให้ React เริ่มต้นตรงกับที่สคริปต์ตั้งไว้ */
export function resolveTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isTheme(stored)) return stored;
    return matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

/** ลงมือเปลี่ยนโหมดจริง ๆ ทั้งหน้าเว็บ */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // เบราว์เซอร์บล็อก storage อยู่ (โหมดส่วนตัวบางตัว) — เปลี่ยนได้แต่ไม่จำ
  }
}
