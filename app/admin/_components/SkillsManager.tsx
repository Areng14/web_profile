"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { projectSlug, SkillType } from "../../lib/types";
import { api, uploadFile } from "./api";
import { dangerButton, DragHandle, ErrorNote, Field, ghostButton, inputClass, move, primaryButton, textareaClass, UnsavedBar } from "./ui";

export interface EditableSkill {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  type: SkillType;
}

const SECTIONS: { type: SkillType; title: string }[] = [
  { type: SkillType.Lang, title: "Languages" },
  { type: SkillType.Framework, title: "Frameworks" },
  { type: SkillType.Tools, title: "Tools" },
  { type: SkillType.DesignTools, title: "Design tools" },
];

const blank: EditableSkill = { id: "", name: "", description: "", color: "#94a3b8", icon: "", type: SkillType.Lang };

interface Props {
  skills: EditableSkill[];
  counts: Record<string, { live: number; retired: number }>;
}

function countLabel(c?: { live: number; retired: number }) {
  if (!c || (!c.live && !c.retired)) return "No projects yet";
  if (!c.live) return `${c.retired} retired`;
  return `${c.live} project${c.live === 1 ? "" : "s"}${c.retired ? ` · ${c.retired} retired` : ""}`;
}

export default function SkillsManager({ skills, counts }: Props) {
  const router = useRouter();
  const byId = useMemo(() => Object.fromEntries(skills.map((s) => [s.id, s])), [skills]);
  const initialOrder = useMemo(() => skills.map((s) => s.id), [skills]);
  const [order, setOrder] = useState(initialOrder);
  const [orderSaving, setOrderSaving] = useState(false);
  const dragId = useRef<string | null>(null);

  // The skill being edited: an existing id, "new", or nothing
  const [selected, setSelected] = useState<string | null>(skills[0]?.id ?? null);
  const original = selected === "new" ? blank : selected ? byId[selected] : null;
  const [form, setForm] = useState<EditableSkill | null>(original);
  const [idEdited, setIdEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iconInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(original);
    setIdEdited(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, skills]);

  const dirty = Boolean(form && original && JSON.stringify(form) !== JSON.stringify(original));
  const orderDirty = order.join() !== initialOrder.join();

  const choose = (id: string | null) => {
    if (dirty && !confirm("Discard your unsaved changes to this skill?")) return;
    setSelected(id);
  };

  const set = <K extends keyof EditableSkill>(key: K, value: EditableSkill[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const { id, ...rest } = form;
      if (selected === "new") {
        await api("/api/admin/skills", { method: "POST", json: form });
        setSelected(id);
      } else {
        await api(`/api/admin/skills/${selected}`, { method: "PUT", json: rest });
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const trash = async () => {
    if (!selected || selected === "new" || !confirm(`Move ${form?.name} to the trash? Its tags disappear from projects until restored.`)) return;
    try {
      await api(`/api/admin/skills/${selected}`, { method: "DELETE" });
      setSelected(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveOrder = async () => {
    setOrderSaving(true);
    setError(null);
    try {
      await api("/api/admin/order", { method: "PUT", json: { table: "skills", ids: order } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOrderSaving(false);
    }
  };

  const uploadIcon = async (file: File) => {
    setError(null);
    try {
      set("icon", await uploadFile(file, "icon"));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-wrap items-start gap-7">
      {/* List */}
      <div className="flex min-w-0 flex-[1.4_1_480px] flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-bold text-white">Skills</h1>
            <p className="text-slate-400">Project counts update on their own from the tags. Drag to reorder.</p>
          </div>
          <button type="button" onClick={() => choose("new")} className={`${primaryButton} h-11`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            New skill
          </button>
        </div>

        {orderDirty && (
          <UnsavedBar
            message="Order changed. Nothing is live until you save."
            saving={orderSaving}
            onDiscard={() => setOrder(initialOrder)}
            onSave={saveOrder}
          />
        )}

        {SECTIONS.map(({ type, title }) => {
          const ids = order.filter((id) => byId[id]?.type === type);
          return (
            <section key={type} className="flex flex-col gap-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</h2>
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-card-bg">
                {ids.length === 0 && <p className="px-4 py-4 text-slate-500">None yet</p>}
                {ids.map((id, i) => {
                  const s = byId[id];
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={() => (dragId.current = id)}
                      onDragOver={(e) => {
                        const from = dragId.current;
                        if (!from || from === id || byId[from]?.type !== type) return;
                        e.preventDefault();
                        setOrder((o) => move(o, o.indexOf(from), o.indexOf(id)));
                      }}
                      onDragEnd={() => (dragId.current = null)}
                      className={`flex items-center gap-2 pl-2 pr-4 ${i ? "border-t border-white/[0.05]" : ""} ${selected === id ? "bg-white/[0.05]" : ""}`}
                    >
                      <DragHandle
                        label={`Reorder ${s.name} (arrow keys)`}
                        onKeyDown={(e) => {
                          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                          e.preventDefault();
                          const target = ids[i + (e.key === "ArrowUp" ? -1 : 1)];
                          if (target) setOrder((o) => move(o, o.indexOf(id), o.indexOf(target)));
                        }}
                      />
                      <button type="button" onClick={() => choose(id)} className="flex h-[52px] min-w-0 flex-1 items-center gap-3.5 text-left">
                        <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: s.color }} />
                        <span className="flex-1 truncate font-semibold text-white">{s.name}</span>
                        <span className="text-[13px] text-slate-400">{countLabel(counts[id])}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Edit panel */}
      {form && (
        <aside aria-labelledby="edit-skill" className="flex min-w-0 flex-[1_1_380px] flex-col gap-[18px] rounded-[14px] border border-white/[0.06] bg-card-bg p-6 md:sticky md:top-8">
          <div className="flex items-center justify-between gap-3">
            <h2 id="edit-skill" className="truncate text-base font-semibold text-white">
              {selected === "new" ? "New skill" : `Edit ${original?.name}`}
            </h2>
            <span className="flex gap-2">
              <button type="button" onClick={() => setForm(original)} disabled={!dirty || saving} className={ghostButton}>
                Discard
              </button>
              <button type="button" onClick={save} disabled={!dirty || saving} className={primaryButton}>
                {saving ? "Saving…" : "Save"}
              </button>
            </span>
          </div>
          <ErrorNote message={error} />

          <div className="flex flex-wrap gap-3.5">
            <Field label="Name">
              <input
                className={inputClass}
                value={form.name}
                maxLength={60}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => (f ? { ...f, name, id: selected === "new" && !idEdited ? projectSlug(name) : f.id } : f));
                }}
              />
            </Field>
            <Field label="Section">
              <select className={inputClass} value={form.type} onChange={(e) => set("type", e.target.value as SkillType)}>
                {SECTIONS.map((s) => (
                  <option key={s.type} value={s.type}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {selected === "new" && (
            <Field label="ID" hint="used in filter links, can't change later">
              <input
                className={inputClass}
                value={form.id}
                maxLength={80}
                onChange={(e) => {
                  setIdEdited(true);
                  set("id", e.target.value.toLowerCase());
                }}
              />
            </Field>
          )}

          <div className="flex flex-wrap gap-3.5">
            <Field label="Brand color">
              <span className="flex h-11 items-center gap-2.5 rounded-[10px] border border-white/[0.08] bg-[#0d0e10] px-3 focus-within:border-white/25">
                <input
                  type="color"
                  aria-label="Pick color"
                  value={/^#[0-9a-f]{6}$/i.test(form.color) ? form.color : "#94a3b8"}
                  onChange={(e) => set("color", e.target.value.toUpperCase())}
                  className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <input
                  value={form.color}
                  maxLength={7}
                  onChange={(e) => set("color", e.target.value)}
                  className="h-full min-w-0 flex-1 bg-transparent font-mono text-[13px] text-slate-200 focus:outline-none"
                />
              </span>
            </Field>
            <div className="flex min-w-0 flex-1 basis-40 flex-col gap-2">
              <span className="text-[13px] font-medium text-slate-300">Icon (SVG)</span>
              <button
                type="button"
                onClick={() => iconInput.current?.click()}
                className="flex h-11 items-center gap-2.5 rounded-[10px] border border-dashed border-white/15 bg-[#0d0e10] px-3 text-sm text-slate-300 hover:border-white/30"
              >
                {form.icon ? (
                  <span
                    className="h-5 w-5 shrink-0"
                    style={{ backgroundColor: form.color, WebkitMask: `url("${form.icon}") center / contain no-repeat`, mask: `url("${form.icon}") center / contain no-repeat` }}
                    aria-hidden
                  />
                ) : null}
                {form.icon ? "Replace icon" : "Upload SVG"}
              </button>
              <input
                ref={iconInput}
                type="file"
                accept=".svg,image/svg+xml"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadIcon(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <Field label="Description">
            <textarea className={textareaClass} rows={4} maxLength={400} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Preview</span>
            <div className="relative flex flex-col overflow-hidden rounded-xl border bg-card-bg p-5" style={{ borderColor: form.color }}>
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: form.color }} />
              {form.icon ? (
                <span
                  className="h-10 w-10"
                  style={{ backgroundColor: form.color, WebkitMask: `url("${form.icon}") center / contain no-repeat`, mask: `url("${form.icon}") center / contain no-repeat` }}
                  aria-hidden
                />
              ) : (
                <span className="h-10 w-10 rounded-md" style={{ background: form.color }} aria-hidden />
              )}
              <span className="mt-4 text-lg font-semibold text-white">{form.name || "Skill name"}</span>
              <span className="mt-1.5 text-sm leading-relaxed text-slate-400">{form.description}</span>
              <span className="mt-5 text-sm text-slate-500">{countLabel(counts[form.id])}</span>
            </div>
          </div>

          {selected !== "new" && (
            <div>
              <button type="button" onClick={trash} className={dangerButton}>
                Move to trash
              </button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
