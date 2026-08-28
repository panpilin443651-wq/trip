import { redirect } from "next/navigation";

export default function RootPage() {
  // proxy.ts จะเด้งไป /login เองถ้ายังไม่ได้ล็อกอิน
  redirect("/dashboard");
}
