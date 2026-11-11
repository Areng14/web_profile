import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit } from "../../../../lib/admin/rateLimit";
import {
  ADMIN_GITHUB_ID,
  cookieOptions,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_HOURS,
  STATE_COOKIE,
} from "../../../../lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Step 2 of sign-in: GitHub sends the browser back here with a code. Swap it for a
// token, look up who signed in, and only start a session for the site owner.

function sameString(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const fail = (error: string) => {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("error", error);
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: STATE_COOKIE, ...cookieOptions });
    return res;
  };

  const limit = await rateLimit("login", clientIp(req.headers));
  if (!limit.ok) return fail("rate_limited");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || !sameString(state, expectedState)) return fail("expired");

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("not_configured");

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: new URL("/api/admin/auth/callback", req.url).toString(),
      }),
      cache: "no-store",
    });
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
    if (!accessToken) return fail("github");

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "arengdev-admin",
      },
      cache: "no-store",
    });
    const user = (await userRes.json()) as { id?: number; login?: string };

    // The token was only needed for that one lookup; revoke it so it can't be reused
    await fetch(`https://api.github.com/applications/${clientId}/token`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "arengdev-admin",
      },
      body: JSON.stringify({ access_token: accessToken }),
    }).catch(() => {});

    if (user.id !== ADMIN_GITHUB_ID) return fail("denied");

    const res = NextResponse.redirect(new URL("/admin", req.url));
    res.cookies.delete({ name: STATE_COOKIE, ...cookieOptions });
    res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id, user.login ?? ""), {
      ...cookieOptions,
      maxAge: SESSION_HOURS * 60 * 60,
    });
    return res;
  } catch (err) {
    console.error("admin sign-in failed", err);
    return fail("github");
  }
}
