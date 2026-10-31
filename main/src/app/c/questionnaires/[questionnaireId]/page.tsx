import { notFound } from "next/navigation";
import Link from "@/components/app-link";
import { Badge } from "@/components/ui";
import { requireCoachWorkspace } from "@/lib/auth";
import { listCampaigns } from "@/lib/campaign-actions";
import { getCoachCollege } from "@/lib/coach-college";
import { getQuestionnaire, listSubmissions } from "@/lib/questionnaire-actions";
import { QuestionnaireSubmissionsTable } from "./questionnaire-submissions-table";

export default async function QuestionnaireSubmissionsPage({
  params,
}: {
  params: Promise<{ questionnaireId: string }>;
}) {
  const { questionnaireId } = await params;
  const questionnaire = await getQuestionnaire(questionnaireId);
  if (!questionnaire) notFound();

  const { membership } = await requireCoachWorkspace();
  const [submissions, campaigns, college] = await Promise.all([
    listSubmissions(questionnaire.id),
    questionnaire.collegeId ? listCampaigns(questionnaire.collegeId) : Promise.resolve([]),
    questionnaire.collegeId ? getCoachCollege(membership, questionnaire.collegeId) : Promise.resolve(null),
  ]);
  const newCount = submissions.filter((submission) => submission.status === "new").length;
  const backHref = questionnaire.collegeId
    ? `/c/questionnaires?college=${questionnaire.collegeId}`
    : "/c/questionnaires";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={backHref} className="text-xs text-ink-3 underline underline-offset-2">
            ← All questionnaires
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="truncate">{questionnaire.title}</h1>
            <Badge tone={questionnaire.status === "active" ? "good" : "neutral"}>
              {questionnaire.status === "active" ? "Active" : "Closed"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {[
              college?.name,
              `${submissions.length} ${submissions.length === 1 ? "submission" : "submissions"}`,
              newCount > 0 ? `${newCount} new` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Link
          href={`/r/${questionnaire.shareToken}`}
          target="_blank"
          className="wr-btn wr-btn--neutral wr-btn--small"
        >
          Preview form ↗
        </Link>
      </div>

      <QuestionnaireSubmissionsTable
        questionnaireId={questionnaire.id}
        submissions={submissions}
        fields={questionnaire.extraFields}
        campaigns={campaigns
          .filter((campaign) => campaign.status === "active")
          .map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            classYear: campaign.classYear,
            gender: campaign.gender,
          }))}
        collegeId={questionnaire.collegeId}
      />
    </div>
  );
}
