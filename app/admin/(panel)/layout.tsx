import { hasDatabase } from "../../lib/db/client";
import { requireOwner } from "../../lib/admin/owner";
import { listProjects, listSkills } from "../../lib/admin/store";
import AdminShell from "../_components/AdminShell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!hasDatabase()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-400">
        The database isn&apos;t connected. Add Neon to this Vercel project and redeploy.
      </div>
    );
  }

  const session = await requireOwner();
  const [projects, skills] = await Promise.all([listProjects(), listSkills()]);
  const counts = {
    projects: projects.filter((p) => !p.deletedAt).length,
    skills: skills.filter((s) => !s.deletedAt).length,
    trash: projects.filter((p) => p.deletedAt).length + skills.filter((s) => s.deletedAt).length,
  };

  return (
    <AdminShell login={session.login} expiresAt={session.expiresAt} counts={counts}>
      {children}
    </AdminShell>
  );
}
