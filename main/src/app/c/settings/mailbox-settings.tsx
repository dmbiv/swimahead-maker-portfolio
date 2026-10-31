import * as FormControl from "@/components/form-control";
import { Badge, Card, SectionTitle } from "@/components/ui";
import {
  listEmailSenderConnections,
  type EmailSenderConnection,
} from "@/lib/email/connections";
import { getEmailOAuthConfig, type EmailOAuthProvider } from "@/lib/email/oauth";
import { disconnectMailboxAction } from "./mailbox-actions";

const providerLabels: Record<EmailOAuthProvider, string> = {
  google: "Google Workspace or Gmail",
  microsoft: "Microsoft 365 or Outlook",
};

const statusMessages: Record<string, { tone: "good" | "warn" | "bad"; text: string }> = {
  connected: { tone: "good", text: "Mailbox connected." },
  disconnected: { tone: "good", text: "Mailbox disconnected and stored credentials removed." },
  cancelled: { tone: "warn", text: "Mailbox connection was cancelled." },
  scope_missing: { tone: "bad", text: "The provider did not grant email sending access." },
  start_failed: { tone: "bad", text: "The connection could not be started. Try again." },
  callback_failed: { tone: "bad", text: "The provider connection could not be completed. Try again." },
  disconnect_failed: { tone: "bad", text: "The mailbox could not be disconnected. Try again." },
  request_invalid: { tone: "bad", text: "The mailbox request was invalid." },
  provider_invalid: { tone: "bad", text: "That mailbox provider is not supported." },
};

function formatTimestamp(value: string | null): string {
  if (!value) return "Not used yet";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Unknown"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ConnectionRow(input: {
  workspaceId: string;
  connection: EmailSenderConnection;
}) {
  const { connection } = input;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{connection.senderEmail}</span>
          <Badge tone={connection.status === "connected" ? "good" : "bad"}>
            {connection.status}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-ink-3">
          {providerLabels[connection.provider]} · Last sent: {formatTimestamp(connection.lastUsedAt)}
        </p>
        {connection.lastErrorCode ? (
          <p className="mt-1 text-xs text-bad">Connection error: {connection.lastErrorCode}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <form method="post" action={`/api/email/oauth/${connection.provider}/start`}>
          <FormControl.Input type="hidden" name="workspaceId" value={input.workspaceId} />
          <FormControl.Input type="hidden" name="redirectPath" value="/c/settings" />
          <button type="submit" className="wr-btn wr-btn--neutral wr-btn--small">Reconnect</button>
        </form>
        <form action={disconnectMailboxAction}>
          <FormControl.Input type="hidden" name="workspaceId" value={input.workspaceId} />
          <FormControl.Input type="hidden" name="connectionId" value={connection.id} />
          <button type="submit" className="wr-btn wr-btn--neutral wr-btn--small">Disconnect</button>
        </form>
      </div>
    </div>
  );
}

export async function MailboxSettingsSection(input: {
  workspaceId: string;
  status?: string | null;
}) {
  let connections: EmailSenderConnection[] = [];
  let loadFailed = false;
  try {
    connections = await listEmailSenderConnections(input.workspaceId);
  } catch {
    loadFailed = true;
  }
  const message = input.status ? statusMessages[input.status] : null;
  const providers = (["google", "microsoft"] as const).map((provider) => ({
    provider,
    configured: getEmailOAuthConfig(provider) !== null,
    connected: connections.some((connection) =>
      connection.provider === provider && connection.status === "connected"),
  }));

  return (
    <Card>
      <SectionTitle>Sending mailbox</SectionTitle>
      <p className="text-sm text-ink-2">
        Send reviewed outreach from your own Google or Microsoft account. SwimAhead requests send-only mail access and does not read your inbox.
      </p>

      {message ? (
        <div className="mt-3">
          <Badge tone={message.tone}>{message.text}</Badge>
        </div>
      ) : null}
      {loadFailed ? (
        <p className="mt-3 text-sm text-bad">Mailbox connections are temporarily unavailable. Please try again later.</p>
      ) : null}

      {connections.length > 0 ? (
        <div className="mt-4">
          {connections.map((connection) => (
            <ConnectionRow
              key={connection.id}
              workspaceId={input.workspaceId}
              connection={connection}
            />
          ))}
        </div>
      ) : null}

      {providers.every((provider) => !provider.configured) ? (
        <div className="mt-4 rounded-[var(--radius)] border border-line bg-[var(--sunken)] p-3">
          <p className="text-sm font-medium text-ink">Direct sending isn’t set up on this deployment yet.</p>
          <p className="mt-1 text-xs text-ink-2">
            Connecting a Google or Microsoft mailbox needs OAuth credentials configured in the app’s environment
            (<code className="text-[11px]">GOOGLE_EMAIL_CLIENT_ID</code>/<code className="text-[11px]">…_SECRET</code> or the Microsoft equivalents).
            Until then, outreach still works through the one-click Gmail/Outlook/Mail compose links. SwimAhead opens your email app with the message filled in.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {providers.map(({ provider, configured, connected }) => (
            <form key={provider} method="post" action={`/api/email/oauth/${provider}/start`}>
              <FormControl.Input type="hidden" name="workspaceId" value={input.workspaceId} />
              <FormControl.Input type="hidden" name="redirectPath" value="/c/settings" />
              <button
                type="submit"
                className="wr-btn wr-btn--neutral"
                disabled={!configured || connected}
                title={!configured ? "This provider isn’t configured on this deployment." : undefined}
              >
                {connected ? `${providerLabels[provider]} connected` : `Connect ${providerLabels[provider]}`}
              </button>
            </form>
          ))}
        </div>
      )}
    </Card>
  );
}
