import { listProjects, listSkills } from "../../../lib/admin/store";
import TrashList, { type TrashItem } from "../../_components/TrashList";

export const dynamic = "force-dynamic";

export default async function AdminTrashPage() {
  const [projects, skills] = await Promise.all([listProjects(), listSkills()]);
  const items: TrashItem[] = [
    ...projects.filter((p) => p.deletedAt).map((p) => ({ id: p.id, name: p.name, kind: "project" as const, deletedAt: p.deletedAt!.toISOString() })),
    ...skills.filter((s) => s.deletedAt).map((s) => ({ id: s.id, name: s.name, kind: "skill" as const, deletedAt: s.deletedAt!.toISOString() })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return <TrashList items={items} />;
}
