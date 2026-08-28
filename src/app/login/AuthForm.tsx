"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
import { signIn, signUp, type AuthState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full" disabled={pending}>
      {pending ? "กำลังดำเนินการ…" : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  next = "/dashboard",
}: {
  mode: "signin" | "signup";
  next?: string;
}) {
  const isSignUp = mode === "signup";
  const [state, formAction] = useActionState<AuthState, FormData>(
    isSignUp ? signUp : signIn,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <Field label="อีเมล">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </Field>

      <Field
        label="รหัสผ่าน"
        hint={isSignUp ? "อย่างน้อย 6 ตัวอักษร" : undefined}
      >
        <PasswordInput
          name="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          placeholder="••••••••"
          minLength={isSignUp ? 6 : undefined}
          required
        />
      </Field>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          ⚠️ {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p
          role="status"
          className="rounded-xl bg-ok-soft px-3 py-2.5 text-sm leading-relaxed text-ok"
        >
          ✉️ {state.notice}
        </p>
      ) : null}

      <SubmitButton label={isSignUp ? "สมัครสมาชิก" : "เข้าสู่ระบบ"} />

      <p className="text-center text-sm text-muted">
        {isSignUp ? (
          <>
            มีบัญชีอยู่แล้ว?{" "}
            <Link href="/login" className="font-medium text-brand underline">
              เข้าสู่ระบบ
            </Link>
          </>
        ) : (
          <>
            ยังไม่มีบัญชี?{" "}
            <Link href="/signup" className="font-medium text-brand underline">
              สมัครสมาชิก
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
