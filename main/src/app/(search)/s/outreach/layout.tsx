import { Suspense } from "react";
import { loadOutreachStorageReadiness } from "./data";
import { OutreachDatabaseUpdateNotice } from "./unavailable";

export const unstable_instant = { prefetch: "static" };

export default function OutreachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl space-y-4">
      <header className="border-b border-line pb-3">
        <div>
          <p className="text-[11px] font-semibold text-accent-2">Swimmer recruiting</p>
          <h1 className="mt-0.5 !text-xl">Outreach</h1>
        </div>
      </header>
      <Suspense fallback={null}>
        <DatabaseUpdateNotice />
      </Suspense>
      {children}
    </div>
  );
}

async function DatabaseUpdateNotice() {
  const storageReady = await loadOutreachStorageReadiness();
  return storageReady === false ? <OutreachDatabaseUpdateNotice /> : null;
}
