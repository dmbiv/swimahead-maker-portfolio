export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  inviteUrl?: string;
  delivery?: "sent" | "not_configured" | "failed";
};

export const initialFormState: FormState = { status: "idle" };
