"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

interface ShellProps {
  login: string;
  expiresAt: number;
  counts: { projects: number; skills: number; trash: number };
  children: ReactNode;
}

const icons = {
  projects: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  skills: (
    <>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </>
  ),
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function timeLeft(expiresAt: number, now: number) {
  const minutes = Math.max(0, Math.floor((expiresAt - now) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function AdminShell({ login, expiresAt, counts, children }: ShellProps) {
  const pathname = usePathname();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const signOut = async () => {
    await api("/api/admin/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/admin/login";
  };

  const nav = [
    { href: "/admin", label: "Projects", icon: icons.projects, count: counts.projects, active: pathname === "/admin" || pathname.startsWith("/admin/projects") },
    { href: "/admin/skills", label: "Skills", icon: icons.skills, count: counts.skills, active: pathname.startsWith("/admin/skills") },
    { href: "/admin/trash", label: "Trash", icon: icons.trash, count: counts.trash, active: pathname.startsWith("/admin/trash") },
  ];

  return (
    <div className="flex min-h-screen flex-wrap text-sm">
      <nav
        aria-label="Admin"
        className="flex max-w-full flex-[1_1_220px] flex-col gap-7 border-r border-white/[0.06] bg-[#0d0e10] px-4 py-6 md:sticky md:top-0 md:h-screen md:max-w-[260px]"
      >
        <div className="flex items-center gap-3 px-2">
          <span className="text-[15px] font-semibold tracking-[0.3em] text-white">ARENG</span>
          <span className="h-4 w-px bg-white/15" aria-hidden />
          <span className="text-sm font-medium text-slate-400">Admin</span>
        </div>

        <div className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                item.active ? "bg-white/[0.06] font-medium text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon>{item.icon}</Icon>
                {item.label}
              </span>
              <span className="text-xs text-slate-500">{item.count}</span>
            </Link>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-1">
          <a href="/api/admin/export" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-slate-400 transition-colors hover:text-white">
            <Icon>
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </Icon>
            Export backup
          </a>
          <Link href="/" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-slate-400 transition-colors hover:text-white">
            <Icon>
              <path d="M14 4h6v6" />
              <path d="M20 4 10 14" />
              <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
            </Icon>
            View site
          </Link>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-[10px] border border-white/[0.06] bg-card-bg p-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium text-slate-200">{login || "Signed in"}</span>
              <span className="text-xs text-slate-500">Session ends in {timeLeft(expiresAt, now)}</span>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] text-slate-400 transition-colors hover:text-white"
            >
              <Icon>
                <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </Icon>
            </button>
          </div>
        </div>
      </nav>

      <main className="min-w-0 flex-[999_1_560px] px-5 pb-16 pt-8 sm:px-12 sm:pt-10">{children}</main>
    </div>
  );
}
