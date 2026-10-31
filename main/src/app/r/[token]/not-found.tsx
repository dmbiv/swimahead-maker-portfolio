export default function QuestionnaireNotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="wr-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Questionnaire unavailable</p>
        <h1 className="mt-2 text-xl font-semibold">This questionnaire link is not available.</h1>
        <p className="mt-2 text-sm text-ink-2">
          Check that the full link was copied correctly, or ask the coaching staff for their current questionnaire.
        </p>
      </div>
    </main>
  );
}
