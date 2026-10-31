import { redirect } from "next/navigation";

export default function CheckEmailPage() {
  redirect("/sign-in?error=google-only");
}
