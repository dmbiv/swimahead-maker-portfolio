import { redirect } from "next/navigation";

export default async function SignUpPage({ searchParams }: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = await searchParams;
  const next = params.role === "coach" ? "/onboarding?role=coach" : "/onboarding";
  redirect(`/sign-in?next=${encodeURIComponent(next)}`);
}
