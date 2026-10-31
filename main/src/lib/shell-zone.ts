export type ShellZone = "swimmer" | "coach" | "bare";

export function shellZoneForPath(path: string): ShellZone {
  const pathname = path.replace(/[?#].*$/, "");
  if (pathname === "/c" || pathname.startsWith("/c/")) return "coach";
  if (pathname === "/" || pathname === "/s" || pathname.startsWith("/s/")) return "swimmer";
  return "bare";
}

export function crossesShellBoundary(fromPath: string, toPath: string): boolean {
  return shellZoneForPath(fromPath) !== shellZoneForPath(toPath);
}
