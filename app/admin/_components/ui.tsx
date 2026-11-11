"use client";

import type { ReactNode } from "react";

// Shared bits of the admin panel's look

export const inputClass =
  "h-11 w-full rounded-[10px] border border-white/[0.08] bg-[#0d0e10] px-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-white/25 focus:outline-none";
export const textareaClass =
  "w-full rounded-[10px] border border-white/[0.08] bg-[#0d0e10] px-3 py-2.5 text-sm leading-relaxed text-slate-200 placeholder:text-slate-500 focus:border-white/25 focus:outline-none";
export const cardClass = "rounded-[14px] border border-white/[0.06] bg-card-bg p-6";
export const primaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-accent px-[18px] text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
export const ghostButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-white/[0.08] px-3.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
export const dangerButton =
  "inline-flex h-10 items-center justify-center rounded-[10px] border border-red-400/35 px-3.5 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 basis-56 flex-col gap-2">
      <span className="flex justify-between gap-2 text-[13px] font-medium text-slate-300">
        {label}
        {hint && <span className="font-normal text-slate-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="text-[13px] text-slate-400">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`flex h-[26px] w-11 shrink-0 rounded-full p-[3px] transition-colors ${
          checked ? "justify-end bg-accent" : "justify-start bg-[#2a2f36]"
        }`}
      >
        <span className={`h-5 w-5 rounded-full ${checked ? "bg-white" : "bg-slate-400"}`} />
      </button>
    </div>
  );
}

export function UnsavedBar({
  message,
  saving,
  onDiscard,
  onSave,
}: {
  message: string;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-[#1c1910] py-3 pl-[18px] pr-3"
    >
      <span className="inline-flex items-center gap-2.5 text-sm text-amber-200">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        {message}
      </span>
      <span className="flex gap-2">
        <button type="button" onClick={onDiscard} disabled={saving} className={ghostButton}>
          Discard
        </button>
        <button type="button" onClick={onSave} disabled={saving} className={primaryButton}>
          {saving ? "Saving…" : "Save"}
        </button>
      </span>
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[10px] border border-red-400/25 bg-[#22131a] px-3.5 py-2.5 text-sm text-red-200">
      {message}
    </p>
  );
}

export function DragHandle(props: { label: string; onKeyDown?: React.KeyboardEventHandler }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      onKeyDown={props.onKeyDown}
      className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-500 hover:text-slate-300 active:cursor-grabbing"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </button>
  );
}

// Move an item within a list (drag and drop, or arrow keys on the handle)
export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
