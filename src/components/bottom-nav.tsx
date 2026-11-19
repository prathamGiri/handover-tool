"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDashboard, IconFolder, IconPlus, IconUser } from "./icons";

const tabs = [
  { href: "/", label: "Dashboard", Icon: IconDashboard },
  { href: "/projects", label: "Projects", Icon: IconFolder },
  { href: "/log", label: "Log", Icon: IconPlus, primary: true },
  { href: "/profile", label: "Profile", Icon: IconUser },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map(({ href, label, Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                {primary ? (
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-ink shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                ) : (
                  <Icon className="h-6 w-6" />
                )}
                <span className={primary ? "sr-only" : ""}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
