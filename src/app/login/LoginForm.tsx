"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input } from "@/components/ui";
import { login, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full" disabled={pending}>
      {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="ชื่อผู้ใช้">
        <Input
          name="username"
          autoComplete="username"
          placeholder="admin"
          required
        />
      </Field>

      <Field label="รหัสผ่าน">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
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

      <SubmitButton />
    </form>
  );
}
