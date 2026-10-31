import Link from "@/components/app-link";
import { notFound } from "next/navigation";
import { requireCoachWorkspace } from "@/lib/auth";
import { getCoachCollege } from "@/lib/coach-college";
import { getCampaign, listRuledOutRecruits } from "@/lib/campaign-actions";
import { listLedger } from "@/lib/ledger-actions";
import { listRoster } from "@/lib/coach-roster";
import { analyzeRoster } from "@/lib/coach-roster-analysis";
import { conferenceMeetCoverage } from "@/lib/conference-place";
import type { ConferenceMeetCoverage } from "@/lib/conference-place-defs";
import type { EventCode } from "@/lib/types";
import { RecruitSearch } from "./recruit-search";
import { CampaignLedger } from "./campaign-ledger";
import { CampaignDeleteButton } from "../campaign-delete-button";

export default async function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const { membership } = await requireCoachWorkspace();

  const [campaign, ledgerRows, ruledOut] = await Promise.all([
    getCampaign(campaignId),
    listLedger(campaignId, "ledger"),
    listRuledOutRecruits(campaignId),
  ]);
  if (!campaign) notFound();
  const college = await getCoachCollege(membership, campaign.collegeId ?? undefined);
  const roster = college ? await listRoster(college.id) : [];
  const rosterAnalysis = analyzeRoster(roster);
  const rosterMedians = Object.fromEntries(
    rosterAnalysis.events
      .filter((event) => event.medianScore != null)
      .map((event) => [event.event, event.medianScore]),
  ) as Partial<Record<EventCode, number>>;

  const hasDistance = college?.latitude != null && college.longitude != null;

  const conferenceMeet: ConferenceMeetCoverage | null = college
    ? await conferenceMeetCoverage({
        athleticProgramId: college.athleticProgramId,
        gender: campaign.gender,
      }).catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={college ? `/c/campaigns?college=${college.id}` : "/c/campaigns"} className="text-xs text-ink-3 underline underline-offset-2">← All campaigns</Link>
          <h1 className="mt-1">{campaign.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {[college?.name, `Class of ${campaign.classYear}`, campaign.gender === "F" ? "Women" : "Men", `${ledgerRows.length} in ledger`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={college ? `/c/outreach?college=${college.id}` : "/c/outreach"} className="wr-btn wr-btn--neutral wr-btn--small">Email recruits</Link>
          <Link href={college ? `/c/questionnaires?college=${college.id}` : "/c/questionnaires"} className="wr-btn wr-btn--neutral wr-btn--small">Questionnaire</Link>
          <CampaignDeleteButton
            campaignId={campaign.id}
            name={campaign.name}
            recruitCount={ledgerRows.length}
            returnHref={college ? `/c/campaigns?college=${college.id}` : "/c/campaigns"}
          />
        </div>
      </div>

      <RecruitSearch
        campaignId={campaign.id}
        classYear={campaign.classYear}
        gender={campaign.gender}
        hasDistance={hasDistance}
        collegeId={college?.id ?? null}
        rosterMedians={rosterMedians}
        rosterScoredCount={rosterAnalysis.scoredCount}
        conferenceMeet={conferenceMeet}
        initialRuledOut={ruledOut}
      />

      <CampaignLedger campaignId={campaign.id} classYear={campaign.classYear} gender={campaign.gender} rows={ledgerRows} />
    </div>
  );
}
