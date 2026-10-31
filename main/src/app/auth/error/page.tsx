import Link from "@/components/app-link";
import { AuthShell } from "@/app/auth/auth-shell";

export default function AuthErrorPage() {
  return (
    <AuthShell title="Sign-in could not be completed" description="Return to sign in and try Google again.">
      <div className="grid gap-3">
        <Link className="rounded-md bg-[var(--ink)] px-4 py-3 text-center text-sm font-semibold text-white no-underline" href="/sign-in">Sign in</Link>
      </div>
    </AuthShell>
  );
}
