import { notFound } from "next/navigation";
import { getProject, listSkills } from "../../../../lib/admin/store";
import ProjectEditor from "../../../_components/ProjectEditor";
import { emptyProject, pickEditable } from "../../../_components/projectShape";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const [project, skills] = await Promise.all([isNew ? null : getProject(id), listSkills()]);
  if (!isNew && (!project || project.deletedAt)) notFound();

  const initial = project ? pickEditable(project) : emptyProject;

  return (
    <ProjectEditor
      key={id}
      id={isNew ? null : id}
      initial={initial}
      skills={skills.filter((s) => !s.deletedAt).map(({ id, name, color }) => ({ id, name, color }))}
    />
  );
}
