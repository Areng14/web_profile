import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "../../../lib/admin/guard";
import { listProjects, listSkills } from "../../../lib/admin/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A full backup of the content (trash included) as a JSON download
export async function GET(req: NextRequest) {
  const guard = await adminGuard(req, "read");
  if ("response" in guard) return guard.response;

  const [projects, skills] = await Promise.all([listProjects(), listSkills()]);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), skills, projects }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="arengdev-backup-${date}.json"`,
    },
  });
}
