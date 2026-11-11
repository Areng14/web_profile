"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { dangerButton, ErrorNote, ghostButton } from "./ui";

export interface TrashItem {
  id: string;
  name: string;
  kind: "project" | "skill";
  deletedAt: string;
}

export default function TrashList({ items }: { items: TrashItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (item: TrashItem, action: "restore" | "delete") => {
    if (action === "delete" && !confirm(`Delete ${item.name} for good? This can't be undone.`)) return;
    setBusy(item.id);
    setError(null);
    try {
      const base = `/api/admin/${item.kind === "project" ? "projects" : "skills"}/${item.id}`;
      await api(action === "restore" ? base : `${base}?permanent=1`, { method: action === "restore" ? "PATCH" : "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold text-white">Trash</h1>
        <p className="text-slate-400">Trashed things are hidden from the site. Restore them, or delete them for good.</p>
      </div>
      <ErrorNote message={error} />
      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-card-bg">
        {items.length === 0 && <p className="px-5 py-10 text-center text-slate-500">The trash is empty.</p>}
        {items.map((item, i) => (
          <div key={`${item.kind}:${item.id}`} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${i ? "border-t border-white/[0.05]" : ""}`}>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-white">{item.name}</span>
              <span className="text-[13px] text-slate-400">
                {item.kind === "project" ? "Project" : "Skill"} · trashed {new Date(item.deletedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy === item.id} onClick={() => run(item, "restore")} className={ghostButton}>
                Restore
              </button>
              <button type="button" disabled={busy === item.id} onClick={() => run(item, "delete")} className={dangerButton}>
                Delete for good
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
