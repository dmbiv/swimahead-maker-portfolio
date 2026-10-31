"use client";

import * as FormControl from "@/components/form-control";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type CollegeChoice = {
  id: string;
  name: string;
  squad: "men" | "women" | "coed";
  division: string | null;
};

const SQUAD_LABEL: Record<CollegeChoice["squad"], string> = {
  men: "Men",
  women: "Women",
  coed: "Coed",
};

export function CollegeSwitcher({ colleges, activeId }: { colleges: CollegeChoice[]; activeId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (colleges.length < 2) return null;

  function select(id: string) {
    document.cookie = `wr_coach_college=${encodeURIComponent(id)}; path=/c; max-age=31536000; samesite=lax`;
    const next = new URLSearchParams(params.toString());
    next.set("college", id);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-3">Program</span>
      <FormControl.Select
        className="wr-control"
        value={activeId}
        onChange={(e) => select(e.target.value)}
      >
        {colleges.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({SQUAD_LABEL[c.squad]}{c.division ? `, ${c.division}` : ""})
          </option>
        ))}
      </FormControl.Select>
    </label>
  );
}
