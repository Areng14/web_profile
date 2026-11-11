import { NextResponse, type NextRequest } from "next/server";
import { adminGuard, jsonError } from "../../../lib/admin/guard";
import { createProject, listProjects, publish, slugTaken } from "../../../lib/admin/store";
import { firstIssue, projectInput } from "../../../lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await adminGuard(req, "read");
  if ("response" in guard) return guard.response;
  return NextResponse.json(await listProjects());
}

export async function POST(req: NextRequest) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;

  const parsed = projectInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  if (await slugTaken(parsed.data.slug)) return jsonError("Another project already uses that page URL", 409);

  const project = await createProject(parsed.data);
  publish();
  return NextResponse.json(project, { status: 201 });
}
