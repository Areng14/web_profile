"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { api } from "./api";
import { DragHandle, ErrorNote, move, primaryButton, UnsavedBar } from "./ui";

export interface ListProject {
  id: string;
  slug: string;
  name: string;
  kind: string;
  platform: string;
  skillIds: string[];
  hasUsers: boolean;
  prototype: boolean;
  graveyard: boolean;
  draft: boolean;
}

export interface ListSkill {
  id: string;
  name: string;
  color: string;
}

const statusOf = (p: ListProject) =>
  p.draft
    ? { label: "Draft", className: "bg-violet-400/10 text-violet-300" }
    : p.graveyard
    ? { label: "Retired", className: "bg-slate-400/10 text-slate-400" }
    : p.prototype
      ? { label: "Prototype", className: "bg-amber-400/10 text-amber-400" }
      : p.hasUsers
        ? { label: "In use", className: "bg-emerald-400/10 text-emerald-400" }
        : { label: "Active", className: "bg-blue-400/10 text-blue-400" };

type Tab = "live" | "drafts" | "floor";

// Drafts get their own tab whether or not they're headed for the cutting room floor
const tabOf = (p: ListProject | undefined): Tab | null => (!p ? null : p.draft ? "drafts" : p.graveyard ? "floor" : "live");

export default function ProjectsList({ projects, skills }: { projects: ListProject[]; skills: ListSkill[] }) {
  const router = useRouter();
  const byId = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const skillById = useMemo(() => Object.fromEntries(skills.map((s) => [s.id, s])), [skills]);

  const initialOrder = useMemo(() => projects.map((p) => p.id), [projects]);
  const [order, setOrder] = useState(initialOrder);
  const [tab, setTab] = useState<Tab>("live");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const dirty = order.join() !== initialOrder.join();
  const inTab = (id: string) => tabOf(byId[id]) === tab;
  const q = query.trim().toLowerCase();
  const visible = order.filter(
    (id) => byId[id] && inTab(id) && (!q || byId[id].name.toLowerCase().includes(q) || byId[id].kind.toLowerCase().includes(q)),
  );
  const canReorder = !q;
  const countOf = (t: Tab) => projects.filter((p) => tabOf(p) === t).length;

  // Moving within a tab: swap places in the full list, leaving the other tab's order alone
  const moveTo = (id: string, targetId: string) => {
    setOrder((current) => move(current, current.indexOf(id), current.indexOf(targetId)));
  };
  const step = (id: string, by: number) => {
    const target = visible[visible.indexOf(id) + by];
    if (target) moveTo(id, target);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api("/api/admin/order", { method: "PUT", json: { table: "projects", ids: order } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold text-white">Projects</h1>
          <p className="text-slate-400">{canReorder ? "Drag to reorder." : "Clear the search to reorder."}</p>
        </div>
        <Link href="/admin/projects/new" className={`${primaryButton} h-11`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          New project
        </Link>
      </div>

      {dirty && (
        <UnsavedBar
          message="Order changed. Nothing is live until you save."
          saving={saving}
          onDiscard={() => setOrder(initialOrder)}
          onSave={save}
        />
      )}
      <ErrorNote message={error} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Project list" className="flex gap-1 rounded-[10px] border border-white/[0.06] bg-card-bg p-1">
          {(
            [
              ["live", "Live"],
              ["drafts", "Drafts"],
              ["floor", "Cutting room floor"],
            ] as const
          ).map(([key, label]) => [key, label, countOf(key)] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`h-9 rounded-[7px] px-3.5 font-medium transition-colors ${
                tab === key ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label} <span className="text-slate-500">{count}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="Search projects"
          placeholder="Search projects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 min-w-[200px] flex-[0_1_320px] rounded-[10px] border border-white/[0.06] bg-card-bg px-3 text-slate-200 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-card-bg">
        <div className="md:min-w-[760px]">
          <div className="grid grid-cols-[32px_minmax(0,1fr)_auto_36px] md:grid-cols-[40px_minmax(0,1.5fr)_minmax(0,2fr)_110px_40px] items-center gap-3 border-b border-white/[0.06] px-3 py-3 text-xs md:gap-4 md:px-5 font-semibold uppercase tracking-[0.08em] text-slate-500">
            <span />
            <span>Project</span>
            <span className="hidden md:block">Built with</span>
            <span>Status</span>
            <span />
          </div>
          {visible.length === 0 && <p className="px-5 py-10 text-center text-slate-500">No projects here.</p>}
          {visible.map((id) => {
            const p = byId[id];
            const status = statusOf(p);
            return (
              <div
                key={id}
                draggable={canReorder}
                onDragStart={(e) => {
                  dragId.current = id;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!dragId.current || dragId.current === id) return;
                  e.preventDefault();
                  moveTo(dragId.current, id);
                }}
                onDragEnd={() => (dragId.current = null)}
                className="grid grid-cols-[32px_minmax(0,1fr)_auto_36px] md:grid-cols-[40px_minmax(0,1.5fr)_minmax(0,2fr)_110px_40px] items-center gap-3 border-b border-white/[0.04] px-3 py-3.5 last:border-0 md:gap-4 md:px-5"
              >
                {canReorder ? (
                  <DragHandle
                    label={`Reorder ${p.name} (arrow keys)`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        step(id, e.key === "ArrowUp" ? -1 : 1);
                      }
                    }}
                  />
                ) : (
                  <span />
                )}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link href={`/admin/projects/${id}`} className="truncate text-[15px] font-semibold text-white hover:underline">
                    {p.name}
                  </Link>
                  <span className="truncate text-[13px] text-slate-400">{[p.kind, p.platform].filter(Boolean).join(" · ")}</span>
                </div>
                {/* Phones skip the tags so a row fits without scrolling sideways */}
                <div className="hidden flex-wrap gap-1.5 md:flex">
                  {p.skillIds.map((sid) => {
                    const skill = skillById[sid];
                    if (!skill) return null;
                    return (
                      <span key={sid} className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1 text-xs font-medium text-slate-300">
                        <span className="h-2 w-2 rounded-sm" style={{ background: skill.color }} />
                        {skill.name}
                      </span>
                    );
                  })}
                </div>
                <span className={`justify-self-start rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                <Link
                  href={`/admin/projects/${id}`}
                  aria-label={`Edit ${p.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                    <path d="m13.5 6.5 4 4" />
                  </svg>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
