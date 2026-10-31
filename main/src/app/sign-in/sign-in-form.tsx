"use client";

import * as FormControl from "@/components/form-control";
import { useActionState } from "react";
import { googleSignInAction } from "@/app/auth/actions";
import { initialFormState } from "@/app/auth/form-state";
import { FormMessage, SubmitButton } from "@/app/auth/form-controls";

export function SignInForm({ next, disabled }: { next?: string; disabled?: boolean }) {
  const [state, action] = useActionState(googleSignInAction, initialFormState);
  return (
    <form action={action} className="space-y-4">
      {next ? <FormControl.Input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Opening Google..." disabled={disabled}>Continue with Google</SubmitButton>
      <p className="text-center text-xs leading-5 text-ink-3">
        SwimAhead requests only your basic Google identity: name and verified email. It does not request Gmail access.
      </p>
    </form>
  );
}
