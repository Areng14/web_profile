"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import type { ApiProject, ApiSkill } from "../../lib/types";

export default function AdminProjectsPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    gradientColor: ["#333", "#666"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: [] as string[],
  });

  async function load() {
    try {
      const [projRes, skillRes] = await Promise.all([
        apiFetch<ApiProject[]>("projects"),
        apiFetch<ApiSkill[]>("public/skills"),
      ]);
      setProjects(Array.isArray(projRes) ? projRes : []);
      setSkills(Array.isArray(skillRes) ? skillRes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm({
      name: "",
      description: "",
      gradientColor: ["#333", "#666"],
      gradientAngle: 45,
      gitRepo: "",
      skillId: [],
    });
    setShowForm(true);
  }

  function openEdit(p: ApiProject) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description,
      gradientColor: Array.isArray(p.gradientColor) && p.gradientColor.length >= 2 ? p.gradientColor : ["#333", "#666"],
      gradientAngle: p.gradientAngle ?? 45,
      gitRepo: p.gitRepo ?? "",
      skillId: Array.isArray(p.skillId) ? p.skillId : [],
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await apiFetch(`projects/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
          token: token ?? undefined,
        });
      } else {
        await apiFetch("projects", {
          method: "POST",
          body: JSON.stringify(form),
          token: token ?? undefined,
        });
      }
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }

  if (loading) return <p className="text-slate-400">Loading projects...</p>;

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Projects</h1>
      {error && <p className="mb-4 text-red-400">{error}</p>}

      <button
        type="button"
        onClick={openAdd}
        className="mb-4 rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
      >
        Add project
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-slate-700 bg-[#0c0d0f] p-6">
          <h2 className="mb-4 text-xl font-semibold">{editingId ? "Edit project" : "New project"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Git repo (slug)</label>
              <input
                value={form.gitRepo}
                onChange={(e) => setForm((f) => ({ ...f, gitRepo: e.target.value }))}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate-400">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
                rows={3}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Gradient color 1</label>
              <input
                type="text"
                value={form.gradientColor[0]}
                onChange={(e) => setForm((f) => ({ ...f, gradientColor: [e.target.value, f.gradientColor[1]] }))}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Gradient color 2</label>
              <input
                type="text"
                value={form.gradientColor[1]}
                onChange={(e) => setForm((f) => ({ ...f, gradientColor: [f.gradientColor[0], e.target.value] }))}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Gradient angle</label>
              <input
                type="number"
                value={form.gradientAngle}
                onChange={(e) => setForm((f) => ({ ...f, gradientAngle: Number(e.target.value) }))}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Skills</label>
              <select
                multiple
                value={form.skillId}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                  setForm((f) => ({ ...f, skillId: selected }));
                }}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              >
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>{s.skillName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
              {editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded bg-slate-600 px-4 py-2 hover:bg-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-slate-700">
          <thead>
            <tr className="bg-slate-800">
              <th className="border border-slate-700 px-4 py-2 text-left">Name</th>
              <th className="border border-slate-700 px-4 py-2 text-left">Description</th>
              <th className="border border-slate-700 px-4 py-2 text-left">Repo</th>
              <th className="border border-slate-700 px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-slate-700">
                <td className="border border-slate-700 px-4 py-2">{p.name}</td>
                <td className="max-w-xs border border-slate-700 px-4 py-2 truncate">{p.description}</td>
                <td className="border border-slate-700 px-4 py-2">{p.gitRepo}</td>
                <td className="border border-slate-700 px-4 py-2">
                  <button type="button" onClick={() => openEdit(p)} className="text-sky-400 hover:underline">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
