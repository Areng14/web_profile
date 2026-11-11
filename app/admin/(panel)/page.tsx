import { listProjects, listSkills } from "../../lib/admin/store";
import ProjectsList from "../_components/ProjectsList";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const [projects, skills] = await Promise.all([listProjects(), listSkills()]);
  return (
    <ProjectsList
      key={projects.map((p) => `${p.id}:${p.position}`).join()}
      projects={projects
        .filter((p) => !p.deletedAt)
        .map(({ id, slug, name, kind, platform, skillIds, hasUsers, prototype, graveyard }) => ({
          id,
          slug,
          name,
          kind,
          platform,
          skillIds,
          hasUsers,
          prototype,
          graveyard,
        }))}
      skills={skills.filter((s) => !s.deletedAt).map(({ id, name, color }) => ({ id, name, color }))}
    />
  );
}
