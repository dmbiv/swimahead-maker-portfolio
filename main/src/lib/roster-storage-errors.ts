type StorageError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

function errorText(error: StorageError | null | undefined): string {
  return [error?.message, error?.details].filter(Boolean).join(" ").toLocaleLowerCase();
}

export function isMissingRosterClassStanding(error: StorageError | null | undefined): boolean {
  const text = errorText(error);
  return (error?.code === "42703" || error?.code === "PGRST204")
    && text.includes("class_standing");
}

export async function retryWithoutRosterClassStanding<
  TWithColumn extends { error?: StorageError | null },
  TWithoutColumn extends { error?: StorageError | null },
>(
  withClassStanding: () => PromiseLike<TWithColumn>,
  withoutClassStanding: () => PromiseLike<TWithoutColumn>,
): Promise<TWithColumn | TWithoutColumn> {
  const result = await withClassStanding();
  return isMissingRosterClassStanding(result.error) ? await withoutClassStanding() : result;
}

export function rosterInsertErrorMessage(
  error: StorageError | null | undefined,
  swimmerName: string,
): string {
  if (error?.code === "23505") return `${swimmerName} is already on this program's roster.`;
  if (error?.code === "42501") return "You do not have permission to change this roster.";
  if (error?.code === "23503") return "The selected program is no longer available. Refresh the page and try again.";

  const text = errorText(error);
  if (text.includes("schema cache") || text.includes("does not exist") || error?.code === "PGRST204") {
    return "Roster updates are temporarily unavailable. Please try again later.";
  }
  return `Could not add ${swimmerName}. Try again.`;
}
