import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "./app/lib/admin/session";

// First lock on the admin panel: no valid session, no admin pages or API.
// Route handlers check again (app/lib/admin/guard.ts).

const PUBLIC_PATHS = ["/admin/login", "/api/admin/auth/login", "/api/admin/auth/callback"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  let res: NextResponse;
  if (PUBLIC_PATHS.includes(pathname)) {
    res = NextResponse.next();
  } else if (await readSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    res = NextResponse.next();
  } else if (isApi) {
    res = NextResponse.json({ error: "Not signed in" }, { status: 401 });
  } else {
    res = NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // Keep the panel out of search engines and shared caches
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
