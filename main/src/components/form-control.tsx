import type { ComponentProps } from "react";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} suppressHydrationWarning />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} suppressHydrationWarning />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} suppressHydrationWarning />;
}
