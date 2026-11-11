import { NextResponse, type NextRequest } from "next/server";
import { isSessionCurrent } from "./owner";
import { rateLimit, type LimitName } from "./rateLimit";
import { readSession, SESSION_COOKIE, type AdminSession } from "./session";

// Every admin API handler starts with adminGuard: it checks the session, blocks
// cross-site requests and applies the rate limit. Middleware also checks the session;
// this is the second lock on the same door.

export function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

// A write must come from a page on this site. SameSite=Lax already keeps the cookie off
// cross-site POSTs; this also covers same-site subdomains and old browsers.
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// The panel only ever calls its API from its own pages. Browsers label requests made
// from other sites (including links and <img> tags), so those are turned away even on GET.
export function crossSite(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

export async function adminGuard(
  req: NextRequest,
  bucket: LimitName,
): Promise<{ session: AdminSession } | { response: NextResponse }> {
  if (crossSite(req)) return { response: jsonError("Cross-site request blocked", 403) };
  if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) {
    return { response: jsonError("Cross-site request blocked", 403) };
  }

  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || !(await isSessionCurrent(session))) return { response: jsonError("Not signed in", 401) };

  const limit = await rateLimit(bucket, String(session.githubId));
  if (!limit.ok) {
    return {
      response: jsonError("Too many requests. Slow down a bit.", 429, {
        "Retry-After": String(limit.retryAfterSeconds),
      }),
    };
  }
  return { session };
}
