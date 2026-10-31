"use server";

import { redirect } from "next/navigation";
import { disconnectEmailSender } from "@/lib/email/connections";

export async function disconnectMailboxAction(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  if (workspaceId.length > 100 || connectionId.length > 100 || !workspaceId || !connectionId) {
    redirect("/c/settings?mailbox=request_invalid");
  }

  try {
    await disconnectEmailSender(workspaceId, connectionId);
  } catch {
    redirect("/c/settings?mailbox=disconnect_failed");
  }
  redirect("/c/settings?mailbox=disconnected");
}
