import { NextResponse, type NextRequest } from "next/server";
import { adminGuard, jsonError } from "../../../../lib/admin/guard";
import {
  deleteProjectForever,
  getProject,
  publish,
  setProjectTrashed,
  slugTaken,
  updateProject,
} from "../../../../lib/admin/store";
import { firstIssue, projectInput } from "../../../../lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await adminGuard(req, "read");
  if ("response" in guard) return guard.response;
  const project = await getProject((await params).id);
  return project ? NextResponse.json(project) : jsonError("Not found", 404);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const parsed = projectInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  if (await slugTaken(parsed.data.slug, id)) return jsonError("Another project already uses that page URL", 409);

  const project = await updateProject(id, parsed.data);
  if (!project) return jsonError("Not found", 404);
  publish();
  return NextResponse.json(project);
}

// Restore from the trash
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;
  const row = await setProjectTrashed((await params).id, false);
  if (!row) return jsonError("Not found", 404);
  publish();
  return NextResponse.json({ ok: true });
}

// Move to the trash, or with ?permanent=1 delete something already in it
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;
  const { id } = await params;
  const permanent = req.nextUrl.searchParams.get("permanent") === "1";
  const row = permanent ? await deleteProjectForever(id) : await setProjectTrashed(id, true);
  if (!row) return jsonError(permanent ? "Only trashed projects can be deleted" : "Not found", 404);
  publish();
  return NextResponse.json({ ok: true });
}
