import { AuthShell } from "@/components/AuthShell";
import { AuthForm } from "./AuthForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const raw = params.next;
  const next = typeof raw === "string" && raw.startsWith("/") ? raw : "/dashboard";

  return (
    <AuthShell
      title="Travel Planner"
      subtitle="เข้าสู่ระบบเพื่อดูแผนทริปของคุณ"
    >
      <AuthForm mode="signin" next={next} />
    </AuthShell>
  );
}
