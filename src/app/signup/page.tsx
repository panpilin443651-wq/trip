import { AuthShell } from "@/components/AuthShell";
import { AuthForm } from "../login/AuthForm";

export default function SignUpPage() {
  return (
    <AuthShell
      title="สมัครสมาชิก"
      subtitle="สร้างบัญชีเพื่อเก็บแผนทริปไว้บนคลาวด์"
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
