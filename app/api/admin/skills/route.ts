import { NextResponse, type NextRequest } from "next/server";
import { adminGuard, jsonError } from "../../../lib/admin/guard";
import { createSkill, listSkills, publish } from "../../../lib/admin/store";
import { firstIssue, newSkillInput } from "../../../lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await adminGuard(req, "read");
  if ("response" in guard) return guard.response;
  return NextResponse.json(await listSkills());
}

export async function POST(req: NextRequest) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;

  const parsed = newSkillInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const { id, ...input } = parsed.data;
  if ((await listSkills()).some((s) => s.id === id)) return jsonError("A skill with that id already exists", 409);

  const skill = await createSkill(id, input);
  publish();
  return NextResponse.json(skill, { status: 201 });
}
