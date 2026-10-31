import "server-only";

import { revalidatePath } from "next/cache";

export function revalidateSwimmerViews(paths: string[] = []) {
  for (const path of new Set(["/s", "/s/board", "/s/explore", "/s/outreach", ...paths])) {
    revalidatePath(path);
  }
}
