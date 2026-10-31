import Link from "@/components/app-link";
import { LegalLinks } from "@/components/legal";

export function AuthShell({ title, description, children, footer }: {
  title: string;
  description?: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="auth2">
      <section className="auth2-panel">
        <Link href="/" className="auth2-back">← Back to home</Link>
        <div className="auth2-wordmark brand-name">
          <span className="brand-name-a">Swim</span><span className="brand-name-b">Ahead</span>
        </div>
        <h1 className="auth2-title">{title}</h1>
        {description ? <p className="auth2-desc">{description}</p> : null}
        <div className="auth2-body">{children}</div>
        {footer ? <footer className="auth2-foot">{footer}</footer> : null}
        <LegalLinks className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4" />
      </section>
    </main>
  );
}

export const fieldClassName = "auth2-input";
export const labelClassName = "auth2-label";
