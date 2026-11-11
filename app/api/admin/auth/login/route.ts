import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit } from "../../../../lib/admin/rateLimit";
import { cookieOptions, STATE_COOKIE } from "../../../../lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Step 1 of sign-in: send the browser to GitHub with a one-time state value

export async function GET(req: NextRequest) {
  const loginPage = new URL("/admin/login", req.url);

  const limit = await rateLimit("login", clientIp(req.headers));
  if (!limit.ok) {
    loginPage.searchParams.set("error", "rate_limited");
    loginPage.searchParams.set("retry", String(Math.ceil(limit.retryAfterSeconds / 60)));
    return NextResponse.redirect(loginPage);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
    loginPage.searchParams.set("error", "not_configured");
    return NextResponse.redirect(loginPage);
  }

  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", new URL("/api/admin/auth/callback", req.url).toString());
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");
  // No scopes: the public profile is enough to read the account id

  const res = NextResponse.redirect(authorize);
  res.cookies.set(STATE_COOKIE, state, { ...cookieOptions, maxAge: 10 * 60 });
  return res;
}
