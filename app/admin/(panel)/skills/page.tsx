import { listProjects, listSkills } from "../../../lib/admin/store";
import type { SkillType } from "../../../lib/types";
import SkillsManager from "../../_components/SkillsManager";

export const dynamic = "force-dynamic";

export default async function AdminSkillsPage() {
  const [skills, projects] = await Promise.all([listSkills(), listProjects()]);

  const counts: Record<string, { live: number; retired: number }> = {};
  for (const p of projects.filter((p) => !p.deletedAt)) {
    for (const id of p.skillIds) {
      counts[id] ??= { live: 0, retired: 0 };
      counts[id][p.graveyard ? "retired" : "live"] += 1;
    }
  }

  const live = skills.filter((s) => !s.deletedAt);
  return (
    <SkillsManager
      key={live.map((s) => `${s.id}:${s.position}:${s.updatedAt.getTime()}`).join()}
      skills={live.map(({ id, name, description, color, icon, type }) => ({ id, name, description, color, icon, type: type as SkillType }))}
      counts={counts}
    />
  );
}
