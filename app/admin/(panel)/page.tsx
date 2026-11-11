import { requireOwner } from "../../lib/admin/owner";
import { listProjects, listSkills } from "../../lib/admin/store";
import ProjectsList from "../_components/ProjectsList";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  // Each page checks for itself; the layout and middleware are extra locks, not the only one
  await requireOwner();
  const [projects, skills] = await Promise.all([listProjects(), listSkills()]);
  return (
    <ProjectsList
      key={projects.map((p) => `${p.id}:${p.position}`).join()}
      projects={projects
        .filter((p) => !p.deletedAt)
        .map(({ id, slug, name, kind, platform, skillIds, hasUsers, prototype, graveyard, draft }) => ({
          id,
          slug,
          name,
          kind,
          platform,
          skillIds,
          hasUsers,
          prototype,
          graveyard,
          draft,
        }))}
      skills={skills.filter((s) => !s.deletedAt).map(({ id, name, color }) => ({ id, name, color }))}
    />
  );
}
