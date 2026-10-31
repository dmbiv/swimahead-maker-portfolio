"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/auth/form-state";

export function SubmitButton({ children, pendingLabel, disabled = false }: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="auth2-submit">
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  const isError = state.status === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`auth2-msg ${isError ? "auth2-msg--error" : "auth2-msg--ok"}`}
    >
      {state.message}
    </div>
  );
}

export function FieldError({ state, name }: { state: FormState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? <p className="auth2-err">{message}</p> : null;
}
