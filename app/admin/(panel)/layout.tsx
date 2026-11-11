import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasDatabase } from "../../lib/db/client";
import { listProjects, listSkills } from "../../lib/admin/store";
import { readSession, SESSION_COOKIE } from "../../lib/admin/session";
import AdminShell from "../_components/AdminShell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  if (!hasDatabase()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-400">
        The database isn&apos;t connected. Add Neon to this Vercel project and redeploy.
      </div>
    );
  }

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
