
export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const p = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${p.toString()}`;
}

export function outlookComposeUrl(to: string, subject: string, body: string): string {
  const p = new URLSearchParams({ path: "/mail/action/compose", to, subject, body });
  return `https://outlook.office.com/mail/deeplink/compose?${p.toString()}`;
}

export function mailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function gmailSearchThreadUrl(query: { email?: string | null; name?: string | null }): string {
  const term = query.email?.trim() || query.name?.trim() || "";
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(term)}`;
}
