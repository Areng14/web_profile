import { jwtVerify, SignJWT } from "jose";

// Admin sessions: a signed JWT in an httpOnly cookie. Runs in middleware (edge) and in
// route handlers (node), so it only uses Web Crypto. Revocation (sign out ends every
// session) needs the database, so it's checked in owner.ts, not here.

// Only this GitHub account can sign in (Areng14)
export const ADMIN_GITHUB_ID = 97821562;

export const SESSION_HOURS = 8;

const secure = process.env.NODE_ENV === "production";
// __Host- cookies must be Secure, path=/ and have no Domain, so they can't be set or
// overwritten by a subdomain
export const SESSION_COOKIE = secure ? "__Host-admin_session" : "admin_session";
export const STATE_COOKIE = secure ? "__Host-admin_oauth_state" : "admin_oauth_state";

export const cookieOptions = {
  httpOnly: true,
  secure,
  // Lax, not Strict: Strict cookies set during the GitHub redirect wouldn't be sent on
  // the first page load after it. Cross-site writes are blocked by the Origin check.
  sameSite: "lax" as const,
  path: "/",
};

const ISSUER = "arengdev-admin";

// SESSION_SECRET if set, otherwise derived from the OAuth client secret, so there's
// one less secret to manage. Rotating either one signs everyone out.
async function signingKey(): Promise<Uint8Array | null> {
  const base =
    process.env.SESSION_SECRET ||
    (process.env.GITHUB_CLIENT_SECRET ? `admin-session:${process.env.GITHUB_CLIENT_SECRET}` : null);
  if (!base) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  return new Uint8Array(digest);
}

export interface AdminSession {
  githubId: number;
  login: string;
  issuedAt: number; // seconds
  expiresAt: number; // ms
}

export async function createSessionToken(githubId: number, login: string): Promise<string> {
  const key = await signingKey();
  if (!key) throw new Error("No session signing key configured");
  return new SignJWT({ login })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(githubId))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key);
}

export async function readSession(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  const key = await signingKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
    if (payload.sub !== String(ADMIN_GITHUB_ID) || !payload.exp || !payload.iat) return null;
    return {
      githubId: ADMIN_GITHUB_ID,
      login: typeof payload.login === "string" ? payload.login : "",
      issuedAt: payload.iat,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}
