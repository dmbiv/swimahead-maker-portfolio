"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { announceNavigationStart } from "./navigation-feedback";
import { crossesShellBoundary } from "@/lib/shell-zone";

type AppLinkProps = ComponentProps<typeof NextLink>;

function navigationDestination(href: AppLinkProps["href"]): string | undefined {
  if (typeof href === "string") return href;
  return typeof href.pathname === "string" ? href.pathname : undefined;
}

function internalPathname(href: AppLinkProps["href"]): string | undefined {
  const destination = navigationDestination(href);
  if (!destination || !destination.startsWith("/") || destination.startsWith("//")) return undefined;
  return destination.replace(/[?#].*$/, "");
}

export default function AppLink({ href, onNavigate, onClick, ...props }: AppLinkProps) {
  const pathname = usePathname();

  return (
    <NextLink
      {...props}
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (props.target && props.target !== "_self")
        ) {
          return;
        }
        const toPath = internalPathname(href);
        if (toPath && crossesShellBoundary(pathname, toPath)) {
          event.preventDefault();
          const destination = navigationDestination(href) ?? toPath;
          announceNavigationStart(destination);
          window.location.assign(destination);
        }
      }}
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault: () => {
            prevented = true;
            event.preventDefault();
          },
        });
        if (!prevented) announceNavigationStart(navigationDestination(href));
      }}
    />
  );
}
