export type ProgramStatus = "saved" | "ruled_out";

type ProgramStatusResponse = {
  ok: boolean;
  error?: string | null;
};

export async function updateProgramStatus(
  programId: string,
  status?: ProgramStatus,
  reason = "",
): Promise<ProgramStatusResponse> {
  try {
    const response = await fetch("/api/s/program-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programId, status: status ?? null, reason }),
    });
    const result = await response.json() as ProgramStatusResponse;
    return response.ok && result.ok
      ? { ok: true, error: null }
      : { ok: false, error: result.error ?? "Couldn’t save that change." };
  } catch {
    return { ok: false, error: "Couldn’t save that change." };
  }
}
