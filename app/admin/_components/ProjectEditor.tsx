"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "../../components/Markdown";
import { projectSlug, type ProjectImage } from "../../lib/types";
import { pickEditable, type EditableProject } from "./projectShape";
import { api, uploadFile } from "./api";
import {
  cardClass,
  dangerButton,
  DragHandle,
  ErrorNote,
  Field,
  ghostButton,
  inputClass,
  move,
  primaryButton,
  textareaClass,
  Toggle,
} from "./ui";
import type { ListSkill } from "./ProjectsList";

interface EditorProps {
  id: string | null; // null while creating
  initial: EditableProject;
  skills: ListSkill[];
}

export default function ProjectEditor({ id, initial, skills }: EditorProps) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(initial);
  const [form, setForm] = useState(initial);
  // Stack is edited as text; kept separately so typing a trailing newline isn't eaten
  const [stackText, setStackText] = useState(initial.stack.join("\n"));
  const [slugEdited, setSlugEdited] = useState(Boolean(id));
  const [view, setView] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const dragIndex = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const current = { ...form, stack: stackText.split("\n").map((s) => s.trim()).filter(Boolean) };
  const dirty = JSON.stringify(current) !== JSON.stringify(baseline);

  // Don't lose edits to an accidental tab close
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof EditableProject>(key: K, value: EditableProject[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const skillById = useMemo(() => Object.fromEntries(skills.map((s) => [s.id, s])), [skills]);
  const addable = skills.filter((s) => !form.skillIds.includes(s.id));

  // Publishing is a save that also takes the project out of drafts
  const save = async (overrides: Partial<EditableProject> = {}) => {
    setSaving(true);
    setError(null);
    const payload = { ...current, ...overrides };
    try {
      if (id) {
        const saved = await api<EditableProject>(`/api/admin/projects/${id}`, { method: "PUT", json: payload });
        setBaseline(pickEditable(saved));
        setForm(pickEditable(saved));
        router.refresh();
      } else {
        const created = await api<{ id: string }>("/api/admin/projects", { method: "POST", json: payload });
        setBaseline(payload); // so the unsaved-changes guard doesn't fire on the redirect
        router.replace(`/admin/projects/${created.id}`);
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setForm(baseline);
    setStackText(baseline.stack.join("\n"));
    setError(null);
  };

  const trash = async () => {
    if (!id || !confirm(`Move ${form.name || "this project"} to the trash? It disappears from the site until restored.`)) return;
    try {
      await api(`/api/admin/projects/${id}`, { method: "DELETE" });
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setError(null);
    for (const [i, file] of list.entries()) {
      setUploading(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const url = await uploadFile(file, "image");
        setForm((f) => ({ ...f, images: [...f.images, { src: url, alt: "" }] }));
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
        break;
      }
    }
    setUploading(null);
  };

  const setImage = (index: number, patch: Partial<ProjectImage>) =>
    set(
      "images",
      form.images.map((img, i) => (i === index ? { ...img, ...patch } : img)),
    );

  return (
    <div className="flex flex-col gap-7">
      {/* Top bar: saving lives up here */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="text-slate-400 hover:text-white">
            Projects
          </Link>
          <span className="text-slate-600" aria-hidden>
            /
          </span>
          <span className="font-semibold text-white">{form.name || "New project"}</span>
          {baseline.draft && id && (
            <span className="rounded-full bg-violet-400/10 px-2.5 py-0.5 text-xs font-semibold text-violet-300">Draft</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dirty && (
            <span className="inline-flex items-center gap-2 text-[13px] text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Unsaved changes
            </span>
          )}
          {id && !dirty && !baseline.draft && (
            <a href={`/projects/${baseline.slug}`} target="_blank" rel="noopener noreferrer" className={ghostButton}>
              View live
            </a>
          )}
          <button type="button" onClick={discard} disabled={!dirty || saving} className={ghostButton}>
            Discard
          </button>
          {form.draft ? (
            <>
              <button type="button" onClick={() => save()} disabled={(!dirty && Boolean(id)) || saving || Boolean(uploading)} className={ghostButton}>
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button type="button" onClick={() => save({ draft: false })} disabled={saving || Boolean(uploading)} className={primaryButton}>
                Publish
              </button>
            </>
          ) : (
            <button type="button" onClick={() => save()} disabled={!dirty || saving || Boolean(uploading)} className={primaryButton}>
              {saving ? "Saving…" : id ? "Save" : "Create and publish"}
            </button>
          )}
        </div>
      </div>
      <ErrorNote message={error} />

      <div className="flex flex-wrap items-start gap-7">
        {/* Left: text */}
        <div className="flex min-w-0 flex-[1.15_1_520px] flex-col gap-5">
          <section aria-labelledby="basics" className={`${cardClass} flex flex-col gap-[18px]`}>
            <h2 id="basics" className="text-base font-semibold text-white">
              Basics
            </h2>
            <div className="flex flex-wrap gap-4">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={form.name}
                  maxLength={100}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: slugEdited ? f.slug : projectSlug(name) }));
                  }}
                />
              </Field>
              <Field label="Page URL">
                <span className="flex h-11 items-center overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#0d0e10] focus-within:border-white/25">
                  <span className="pl-3 pr-1 text-slate-500">/projects/</span>
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm text-slate-200 focus:outline-none"
                    value={form.slug}
                    maxLength={80}
                    onChange={(e) => {
                      setSlugEdited(true);
                      set("slug", e.target.value.toLowerCase());
                    }}
                  />
                </span>
              </Field>
            </div>
            <div className="flex flex-wrap gap-4">
              <Field label="Type">
                <input className={inputClass} value={form.kind} maxLength={60} placeholder="Desktop app" onChange={(e) => set("kind", e.target.value)} />
              </Field>
              <Field label="Platform">
                <input className={inputClass} value={form.platform} maxLength={60} placeholder="Windows · Linux" onChange={(e) => set("platform", e.target.value)} />
              </Field>
            </div>
            <Field label="Card description" hint={`${form.description.length} / 500`}>
              <textarea className={textareaClass} rows={3} maxLength={500} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </section>

          <section aria-labelledby="status" className={`${cardClass} flex flex-col gap-[18px]`}>
            <h2 id="status" className="text-base font-semibold text-white">
              Status and links
            </h2>
            <div className="divide-y divide-white/[0.06] rounded-[10px] border border-white/[0.06]">
              <Toggle label="Draft" description="Hidden from the site until you publish it" checked={form.draft} onChange={(v) => set("draft", v)} />
              <Toggle label="Used by real people" description="Shows the people icon next to the name" checked={form.hasUsers} onChange={(v) => set("hasUsers", v)} />
              <Toggle label="Prototype" description="A proof of concept, like a competition build" checked={form.prototype} onChange={(v) => set("prototype", v)} />
              <Toggle label="On the cutting room floor" description="Moves it off the home page" checked={form.graveyard} onChange={(v) => set("graveyard", v)} />
            </div>
            {form.graveyard && (
              <Field label="Cause of death">
                <input className={inputClass} value={form.causeOfDeath} maxLength={300} onChange={(e) => set("causeOfDeath", e.target.value)} />
              </Field>
            )}
            <div className="flex flex-wrap gap-4">
              <Field label="GitHub repo">
                <input className={inputClass} value={form.repo} maxLength={200} placeholder="owner/repo" onChange={(e) => set("repo", e.target.value)} />
              </Field>
              <Field label="Play link">
                <input className={inputClass} value={form.playUrl} maxLength={300} placeholder="/games/… (games only)" onChange={(e) => set("playUrl", e.target.value)} />
              </Field>
            </div>
          </section>

          <section aria-labelledby="built" className={`${cardClass} flex flex-col gap-[18px]`}>
            <h2 id="built" className="text-base font-semibold text-white">
              Built with
            </h2>
            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] font-medium text-slate-300">
                Skill tags <span className="font-normal text-slate-400">· filter chips and the language bar</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {form.skillIds.map((sid) => {
                  const skill = skillById[sid];
                  return (
                    <span key={sid} className="inline-flex h-[34px] items-center gap-2 rounded-lg bg-white/[0.05] pl-2.5 pr-1.5 font-medium text-slate-200">
                      <span className="h-2 w-2 rounded-sm" style={{ background: skill?.color ?? "#475569" }} />
                      {skill?.name ?? sid}
                      <button
                        type="button"
                        aria-label={`Remove ${skill?.name ?? sid}`}
                        onClick={() => set("skillIds", form.skillIds.filter((x) => x !== sid))}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-white"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                          <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </span>
                  );
                })}
                {addable.length > 0 && (
                  <select
                    aria-label="Add skill"
                    value={adding}
                    onChange={(e) => {
                      if (e.target.value) set("skillIds", [...form.skillIds, e.target.value]);
                      setAdding("");
                    }}
                    className="h-[34px] rounded-lg border border-dashed border-white/15 bg-transparent px-2.5 text-sm font-medium text-slate-400 focus:outline-none"
                  >
                    <option value="">+ Add skill</option>
                    {addable.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <Field label="Full stack" hint="one per line, shown on the project page">
              <textarea className={`${textareaClass} font-mono text-[13px]`} rows={5} value={stackText} onChange={(e) => setStackText(e.target.value)} />
            </Field>
          </section>

          <section aria-labelledby="writeup" className={`${cardClass} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="writeup" className="text-base font-semibold text-white">
                Writeup
              </h2>
              <div role="tablist" aria-label="Writeup view" className="flex gap-1 rounded-[10px] border border-white/[0.06] bg-[#0d0e10] p-1">
                {(["write", "preview"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={`h-8 rounded-[7px] px-3 text-[13px] font-medium capitalize ${view === v ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0e10]">
              {view === "write" ? (
                <textarea
                  aria-label="Writeup (Markdown)"
                  rows={24}
                  value={form.writeup}
                  onChange={(e) => set("writeup", e.target.value)}
                  className="block w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-[1.75] text-slate-200 focus:outline-none"
                />
              ) : (
                <div className="min-h-[200px] p-5">
                  {form.writeup.trim() ? <Markdown>{form.writeup}</Markdown> : <p className="text-slate-500">Nothing written yet.</p>}
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-2 border-t border-white/[0.06] px-4 py-2.5 text-xs text-slate-400">
                <span>Markdown: ## headings, - lists, **bold**, [links](url)</span>
                <span>{(form.writeup.match(/^## /gm) ?? []).length} sections</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right: screenshots */}
        <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-5">
          <section aria-labelledby="shots" className={`${cardClass} flex flex-col gap-4`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="shots" className="text-base font-semibold text-white">
                Screenshots
              </h2>
              <span className="text-[13px] text-slate-400">{form.images.length} · first one is the cover</span>
            </div>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
              }}
              disabled={Boolean(uploading)}
              className="flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-white/15 bg-[#0d0e10] px-4 py-6 text-slate-300 transition-colors hover:border-white/30"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden>
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M4 20h16" />
              </svg>
              <span className="font-semibold">{uploading ?? "Drop images or click to upload"}</span>
              <span className="text-[13px] text-slate-400">Converted to WebP and resized. Location data is stripped.</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) upload(e.target.files);
                e.target.value = "";
              }}
            />

            {form.images.length > 0 && (
              <ol className="grid grid-cols-2 gap-3">
                {form.images.map((img, i) => (
                  <li
                    key={`${img.src}-${i}`}
                    draggable
                    onDragStart={() => (dragIndex.current = i)}
                    onDragOver={(e) => {
                      if (dragIndex.current === null || dragIndex.current === i) return;
                      e.preventDefault();
                      set("images", move(form.images, dragIndex.current, i));
                      dragIndex.current = i;
                    }}
                    onDragEnd={() => (dragIndex.current = null)}
                    className={`flex flex-col gap-2 ${i === 0 ? "col-span-2" : ""}`}
                  >
                    <div className={`relative overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#0d0e10] ${i === 0 ? "" : "aspect-[16/10]"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt={img.alt} className={i === 0 ? "block h-auto w-full" : "h-full w-full object-cover object-left-top"} />
                      {i === 0 && <span className="absolute left-2.5 top-2.5 rounded-md bg-background/85 px-2 py-0.5 text-xs font-semibold text-white">Cover</span>}
                      <div className="absolute right-1.5 top-1.5 flex gap-1 rounded-md bg-background/85">
                        <DragHandle
                          label="Reorder screenshot (arrow keys)"
                          onKeyDown={(e) => {
                            const by = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
                            if (by) {
                              e.preventDefault();
                              set("images", move(form.images, i, i + by));
                            }
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Remove screenshot"
                          onClick={() => set("images", form.images.filter((_, j) => j !== i))}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:text-white"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                            <path d="M6 6l12 12M18 6 6 18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <input
                      aria-label={`Caption for screenshot ${i + 1}`}
                      placeholder="Caption"
                      value={img.alt}
                      maxLength={300}
                      onChange={(e) => setImage(i, { alt: e.target.value })}
                      className={`${inputClass} h-9 text-xs`}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>

          {id && (
            <section aria-labelledby="danger" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-red-400/20 bg-card-bg px-6 py-5">
              <div className="flex flex-col gap-1">
                <h2 id="danger" className="text-[15px] font-semibold text-white">
                  Move to trash
                </h2>
                <span className="text-[13px] text-slate-400">Hidden from the site. Restore it from Trash any time.</span>
              </div>
              <button type="button" onClick={trash} className={dangerButton}>
                Move to trash
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
