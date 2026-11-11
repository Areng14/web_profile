import { NextResponse, type NextRequest } from "next/server";
import { adminGuard, jsonError } from "../../../../lib/admin/guard";
import { deleteSkillForever, publish, setSkillTrashed, updateSkill } from "../../../../lib/admin/store";
import { firstIssue, skillInput } from "../../../../lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;

  const parsed = skillInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);

  const skill = await updateSkill((await params).id, parsed.data);
  if (!skill) return jsonError("Not found", 404);
  publish();
  return NextResponse.json(skill);
}

// Restore from the trash
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;
  const row = await setSkillTrashed((await params).id, false);
  if (!row) return jsonError("Not found", 404);
  publish();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;
  const { id } = await params;
  const permanent = req.nextUrl.searchParams.get("permanent") === "1";
  const row = permanent ? await deleteSkillForever(id) : await setSkillTrashed(id, true);
  if (!row) return jsonError(permanent ? "Only trashed skills can be deleted" : "Not found", 404);
  publish();
  return NextResponse.json({ ok: true });
}
