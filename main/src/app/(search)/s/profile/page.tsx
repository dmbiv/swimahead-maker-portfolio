import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };
export const unstable_instant = { prefetch: "static" };

export default async function SwimmerProfilePage() {
  const auth = await getOptionalAuthContext();
  if (!auth || auth.accountType !== "swimmer" || !auth.onboardingCompleted) redirect("/");

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("swimmers")
    .select("first_name,last_name,grad_year,club,city,state,email,phone,gpa,sat,act,max_annual_cost,majors,bio,video_url")
    .eq("owner_user_id", auth.userId)
    .maybeSingle();

  return (
    <ProfileForm
      initial={{
        firstName: s?.first_name ?? "",
        lastName: s?.last_name ?? "",
        gradYear: s?.grad_year ?? new Date().getFullYear() + 1,
        club: s?.club ?? "",
        city: s?.city ?? "",
        state: s?.state ?? "",
        email: s?.email ?? auth.email,
        phone: s?.phone ?? "",
        gpa: s?.gpa != null ? Number(s.gpa) : 0,
        sat: s?.sat ?? null,
        act: s?.act ?? null,
        maxAnnualCost: s?.max_annual_cost ?? null,
        majors: s?.majors ?? [],
        bio: s?.bio ?? "",
        videoUrl: s?.video_url ?? "",
      }}
    />
  );
}
