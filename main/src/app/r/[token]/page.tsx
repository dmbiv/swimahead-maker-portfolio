import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicQuestionnaire } from "@/lib/questionnaire-actions";
import { SubmissionForm } from "./submission-form";
import { LegalLinks } from "@/components/legal";

export const metadata: Metadata = { title: "Recruiting questionnaire" };

export default async function PublicQuestionnairePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const questionnaire = await getPublicQuestionnaire(token);
  if (!questionnaire) notFound();

  if (questionnaire.status === "closed") {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Recruiting questionnaire</p>
          <h1 className="mt-1 text-xl font-semibold">{questionnaire.title}</h1>
        </div>
        <div className="wr-card p-6">
          <span className="wr-badge border-line bg-sunken/70 text-ink-2">Closed</span>
          <h2 className="mt-4 text-base font-semibold">This questionnaire is no longer accepting responses.</h2>
          <p className="mt-2 text-sm text-ink-2">
            This form was closed by {questionnaire.coachingStaffName}. If they asked you to complete a questionnaire, contact them for an updated link.
          </p>
        </div>
        <LegalLinks className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-5" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{questionnaire.title}</h1>
        {questionnaire.intro ? <p className="mt-2 text-sm text-ink-2">{questionnaire.intro}</p> : null}
      </div>
      <SubmissionForm
        token={token}
        coachingStaffName={questionnaire.coachingStaffName}
        fields={questionnaire.extraFields}
      />
      <LegalLinks className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-5" />
    </main>
  );
}
