"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import type { ApiSkill } from "../../lib/types";
import { SkillType } from "../../lib/types";

export default function AdminSkillsPage() {
  const { token } = useAuth();
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    skillName: "",
    gradientColor: ["#333", "#666"],
    gradientAngle: 45,
    icon: "",
    skillType: SkillType.Lang,
  });

  async function load() {
    try {
      const res = await apiFetch<ApiSkill[]>("public/skills");
      setSkills(Array.isArray(res) ? res : []);
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
      skillName: "",
      gradientColor: ["#333", "#666"],
      gradientAngle: 45,
      icon: "",
      skillType: SkillType.Lang,
    });
    setShowForm(true);
  }

  function openEdit(s: ApiSkill) {
    setEditingId(s.id);
    setForm({
      skillName: s.skillName,
      gradientColor: Array.isArray(s.gradientColor) && s.gradientColor.length >= 2 ? s.gradientColor : ["#333", "#666"],
      gradientAngle: s.gradientAngle ?? 45,
      icon: s.icon ?? "",
      skillType: (s.skillType as SkillType) ?? SkillType.Lang,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    try {
      if (editingId) {
        await apiFetch(`skills/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
          token,
        });
      } else {
        await apiFetch("skills", {
          method: "POST",
          body: JSON.stringify(form),
          token,
        });
      }
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }

  if (loading) return <p className="text-slate-400">Loading skills...</p>;

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Skills</h1>
      {error && <p className="mb-4 text-red-400">{error}</p>}

      <button
        type="button"
        onClick={openAdd}
        className="mb-4 rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700"
      >
        Add skill
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-slate-700 bg-[#0c0d0f] p-6">
          <h2 className="mb-4 text-xl font-semibold">{editingId ? "Edit skill" : "New skill"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Skill name</label>
              <input
                value={form.skillName}
                onChange={(e) => setForm((f) => ({ ...f, skillName: e.target.value }))}
                required
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Type</label>
              <select
                value={form.skillType}
                onChange={(e) => setForm((f) => ({ ...f, skillType: e.target.value as SkillType }))}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              >
                <option value={SkillType.Lang}>Language</option>
                <option value={SkillType.Framework}>Framework</option>
                <option value={SkillType.DesignTools}>Design Tool</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Icon URL or path</label>
              <input
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="/misc/skills/python.svg"
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
              <th className="border border-slate-700 px-4 py-2 text-left">Type</th>
              <th className="border border-slate-700 px-4 py-2 text-left">Icon</th>
              <th className="border border-slate-700 px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s, index) => (
              <tr key={s.id ?? index} className="border-b border-slate-700">
                <td className="border border-slate-700 px-4 py-2">{s.skillName}</td>
                <td className="border border-slate-700 px-4 py-2">{s.skillType}</td>
                <td className="border border-slate-700 px-4 py-2">{s.icon}</td>
                <td className="border border-slate-700 px-4 py-2">
                  <button type="button" onClick={() => openEdit(s)} className="text-sky-400 hover:underline">
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
