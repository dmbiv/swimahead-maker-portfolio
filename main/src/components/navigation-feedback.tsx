"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Skel, WorkspaceLoadingSurface } from "./skeleton";

const NAVIGATION_START_EVENT = "swimahead:navigation-start";
const CHUNK_RELOAD_KEY = "swimahead:chunk-reload";
const NAVIGATION_SAFETY_TIMEOUT_MS = 15_000;

type NavigationStartDetail = { destination?: string };

function looksLikeChunkLoadFailure(value: unknown): boolean {
  const message = value instanceof Error
    ? `${value.name} ${value.message}`
    : typeof value === "string"
      ? value
      : "";
  return /ChunkLoadError|Failed to load chunk|\/_next\/static\/chunks\//i.test(message);
}

export function announceNavigationStart(destination?: string) {
  if (typeof window === "undefined") return;
  if (destination) {
    try {
      const next = new URL(destination, window.location.href);
      const currentRoute = `${window.location.pathname}${window.location.search}`;
      if (next.origin === window.location.origin && `${next.pathname}${next.search}` === currentRoute) return;
    } catch {
      return;
    }
  }
  window.dispatchEvent(new CustomEvent<NavigationStartDetail>(NAVIGATION_START_EVENT, {
    detail: { destination },
  }));
}

function destinationPath(destination?: string): string | null {
  if (!destination || typeof window === "undefined") return null;
  try {
    const url = new URL(destination, window.location.href);
    return url.origin === window.location.origin ? url.pathname : null;
  } catch {
    return null;
  }
}

export function useOptimisticPathname(): string {
  const pathname = usePathname();
  const [optimisticNavigation, setOptimisticNavigation] = useState<{
    fromPath: string;
    destinationPath: string;
  } | null>(null);

  useEffect(() => {
    const begin = (event: Event) => {
      const destination = (event as CustomEvent<NavigationStartDetail>).detail?.destination;
      const nextPath = destinationPath(destination);
      setOptimisticNavigation(nextPath ? { fromPath: pathname, destinationPath: nextPath } : null);
    };
    window.addEventListener(NAVIGATION_START_EVENT, begin);
    return () => window.removeEventListener(NAVIGATION_START_EVENT, begin);
  }, [pathname]);

  useEffect(() => {
    if (!optimisticNavigation) return;
    const safetyTimer = window.setTimeout(() => setOptimisticNavigation(null), NAVIGATION_SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(safetyTimer);
  }, [optimisticNavigation]);

  return optimisticNavigation?.fromPath === pathname
    ? optimisticNavigation.destinationPath
    : pathname;
}

export function ImmediateNavigationSkeleton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const previousRoute = useRef(routeKey);
  const pendingDestination = useRef<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (previousRoute.current === routeKey) return;
    previousRoute.current = routeKey;
    pendingDestination.current = undefined;
    setPending(false);
  }, [routeKey]);

  useEffect(() => {
    const begin = (event: Event) => {
      pendingDestination.current = (event as CustomEvent<NavigationStartDetail>).detail?.destination;
      setPending(true);
    };
    window.addEventListener(NAVIGATION_START_EVENT, begin);
    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, begin);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const recover = (value: unknown) => {
      if (!looksLikeChunkLoadFailure(value)) return;
      const now = Date.now();
      const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
      if (Number.isFinite(lastReload) && now - lastReload < 30_000) return;
      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
      window.location.reload();
    };
    const handleRejection = (event: PromiseRejectionEvent) => recover(event.reason);
    const handleError = (event: ErrorEvent) => recover(event.error ?? `${event.message} ${event.filename}`);
    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const safetyTimer = window.setTimeout(() => {
      const destination = pendingDestination.current;
      if (destination) {
        try {
          const next = new URL(destination, window.location.href);
          if (next.origin === window.location.origin) {
            window.location.assign(next.href);
            return;
          }
        } catch {
        }
      }
      pendingDestination.current = undefined;
      setPending(false);
    }, NAVIGATION_SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(safetyTimer);
  }, [pending]);

  if (!pending) return null;
  return (
    <WorkspaceLoadingSurface label="Loading page" immediate>
      <div className="space-y-5">
        <div className="space-y-2">
          <Skel w="min(260px, 62%)" h={25} />
          <Skel w="min(440px, 86%)" h={12} />
        </div>
        <div className="wr-card space-y-3 p-4">
          <Skel w="32%" h={13} />
          <Skel w="100%" h={38} radius="var(--radius)" />
        </div>
        <div className="wr-card overflow-hidden p-0">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1 space-y-2">
                <Skel w={`${46 + (index % 3) * 12}%`} h={13} />
                <Skel w={`${30 + (index % 2) * 16}%`} h={10} />
              </div>
              <Skel w={68} h={26} radius="var(--radius)" />
            </div>
          ))}
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
