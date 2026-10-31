"use client";

import * as FormControl from "@/components/form-control";
import Link from "@/components/app-link";
import { useActionState, useState } from "react";
import { completeOnboardingAction } from "@/app/auth/actions";
import { initialFormState } from "@/app/auth/form-state";
import { fieldClassName, labelClassName } from "@/app/auth/auth-shell";
import { FieldError, FormMessage, SubmitButton } from "@/app/auth/form-controls";

export function AccountSetupForm({ initialRole, initialName, requiresSignupAcceptance }: {
  initialRole: "swimmer" | "coach";
  initialName: string;
  requiresSignupAcceptance: boolean;
}) {
  const [state, action] = useActionState(completeOnboardingAction, initialFormState);
  const [selectedRole, setSelectedRole] = useState(initialRole);

  return (
    <form action={action} className="space-y-4">
      {requiresSignupAcceptance ? (
        <fieldset className="auth2-roles">
          <legend className={labelClassName}>Account type</legend>
          <label className="auth2-role">
            <FormControl.Input
              type="radio"
              name="accountType"
              value="swimmer"
              checked={selectedRole === "swimmer"}
              onChange={() => setSelectedRole("swimmer")}
            />
            <span className="auth2-role-t">Swimmer</span>
            <span className="auth2-role-d">Build and share your recruiting profile.</span>
          </label>
          <label className="auth2-role">
            <FormControl.Input
              type="radio"
              name="accountType"
              value="coach"
              checked={selectedRole === "coach"}
              onChange={() => setSelectedRole("coach")}
            />
            <span className="auth2-role-t">Coach</span>
            <span className="auth2-role-d">Use recruiting workspace and subscription tools.</span>
          </label>
        </fieldset>
      ) : (
        <>
          <FormControl.Input type="hidden" name="accountType" value={initialRole} />
          <div>
            <p className={labelClassName}>Account type</p>
            <p className="rounded-md border border-[var(--accent)] bg-[var(--sunken)] p-3 text-sm font-medium">
              {initialRole === "coach" ? "Coach" : "Swimmer"}
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-3">This is the account type recorded with your policy attestations.</p>
          </div>
        </>
      )}
      <FieldError state={state} name="accountType" />

      <div>
        <label className={labelClassName} htmlFor="displayName">Display name</label>
        <FormControl.Input className={fieldClassName} id="displayName" name="displayName" autoComplete="name" defaultValue={initialName} required />
        <FieldError state={state} name="displayName" />
      </div>

      {selectedRole === "swimmer" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClassName} htmlFor="firstName">First name</label>
              <FormControl.Input className={fieldClassName} id="firstName" name="firstName" autoComplete="given-name" required />
              <FieldError state={state} name="firstName" />
            </div>
            <div>
              <label className={labelClassName} htmlFor="lastName">Last name</label>
              <FormControl.Input className={fieldClassName} id="lastName" name="lastName" autoComplete="family-name" required />
              <FieldError state={state} name="lastName" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClassName} htmlFor="gender">Recruiting category</label>
              <FormControl.Select className={fieldClassName} id="gender" name="gender" required defaultValue="">
                <option value="" disabled>Choose</option>
                <option value="F">Women</option>
                <option value="M">Men</option>
              </FormControl.Select>
              <FieldError state={state} name="gender" />
            </div>
            <div>
              <label className={labelClassName} htmlFor="gradYear">Graduation year</label>
              <FormControl.Input className={fieldClassName} id="gradYear" name="gradYear" type="number" inputMode="numeric" min="2024" max="2045" required />
              <FieldError state={state} name="gradYear" />
            </div>
          </div>
          <div>
            <label className={labelClassName} htmlFor="club">Club or high school</label>
            <FormControl.Input className={fieldClassName} id="club" name="club" autoComplete="organization" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClassName} htmlFor="state">State</label>
              <FormControl.Input className={fieldClassName} id="state" name="state" autoComplete="address-level1" />
            </div>
          </div>
        </>
      ) : (
        <div>
          <label className={labelClassName} htmlFor="jobTitle">Team role</label>
          <FormControl.Input className={fieldClassName} id="jobTitle" name="jobTitle" placeholder="Head coach, assistant coach, recruiting coordinator" required />
          <FieldError state={state} name="jobTitle" />
          <p className="mt-1 text-xs leading-5 text-[var(--ink-3)]">You’ll choose your program and start your paid coach season after this step.</p>
        </div>
      )}

      {requiresSignupAcceptance ? (
        <div className="space-y-3 border-t border-line pt-4">
          <label className="flex items-start gap-2.5 text-xs leading-5 text-ink-2">
            <FormControl.Input
              className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
              type="checkbox"
              name="legalAccepted"
              value="accepted"
              required
            />
            <span>
              I agree to the <Link className="font-semibold text-accent-2 underline" href="/terms" target="_blank">Terms of Service</Link>{" "}
              and acknowledge the <Link className="font-semibold text-accent-2 underline" href="/privacy" target="_blank">Privacy Policy</Link>.
            </span>
          </label>
          <FieldError state={state} name="legalAccepted" />
          <label className="flex items-start gap-2.5 text-xs leading-5 text-ink-2">
            <FormControl.Input
              className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
              type="checkbox"
              name="eligibilityConfirmed"
              value="confirmed"
              required
            />
            <span>
              {selectedRole === "coach"
                ? "I confirm I am at least 18 and genuinely authorized to act for each team or organization I identify in SwimAhead."
                : "I confirm I am at least 13. If I am under 18, my parent or legal guardian has reviewed and authorized my use of SwimAhead."}
            </span>
          </label>
          <FieldError state={state} name="eligibilityConfirmed" />
        </div>
      ) : null}

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving account...">Continue</SubmitButton>
    </form>
  );
}
