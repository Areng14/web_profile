import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "../../../../lib/admin/guard";
import { cookieOptions, SESSION_COOKIE } from "../../../../lib/admin/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: SESSION_COOKIE, ...cookieOptions });
  return res;
}
