import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, jsonError } from "../../../lib/admin/guard";
import { publish, reorder } from "../../../lib/admin/store";
import { firstIssue, orderInput } from "../../../lib/admin/validation";

export const runtime = "nodejs";

const body = orderInput.extend({ table: z.enum(["projects", "skills"]) });

export async function PUT(req: NextRequest) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);

  await reorder(parsed.data.table, parsed.data.ids);
  publish();
  return NextResponse.json({ ok: true });
}
