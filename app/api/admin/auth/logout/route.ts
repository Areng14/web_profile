import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "../../../../lib/admin/guard";
import { endAllSessions } from "../../../../lib/admin/owner";
import { cookieOptions, SESSION_COOKIE } from "../../../../lib/admin/session";

export const runtime = "nodejs";

// Signing out ends every session, not just this browser's, so a copied cookie dies too
export async function POST(req: NextRequest) {
  const guard = await adminGuard(req, "write");
  if ("response" in guard) return guard.response;
  await endAllSessions();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: SESSION_COOKIE, ...cookieOptions });
  return res;
}
