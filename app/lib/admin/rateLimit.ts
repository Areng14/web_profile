import { sql } from "drizzle-orm";
import { getDb } from "../db/client";

// Fixed-window rate limiting backed by Postgres, so the count is shared by every
// serverless instance. One atomic upsert per request.

export const LIMITS = {
  // Finishing a GitHub sign-in, per IP
  login: { limit: 10, windowSeconds: 15 * 60 },
  read: { limit: 120, windowSeconds: 60 },
  write: { limit: 30, windowSeconds: 60 },
  upload: { limit: 30, windowSeconds: 10 * 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export async function rateLimit(name: LimitName, subject: string): Promise<RateLimitResult> {
  const { limit, windowSeconds } = LIMITS[name];
  const key = `${name}:${subject}`;
  try {
    const db = getDb();
    const rows = await db.execute<{ count: number; reset_at: Date }>(sql`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at <= now()
          THEN now() + make_interval(secs => ${windowSeconds}) ELSE rate_limits.reset_at END
      RETURNING count, reset_at
    `);
    // Now and then, clear out windows that ended, so rows from one-off visitors don't pile up
    if (Math.random() < 0.05) {
      await db.execute(sql`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'`);
    }
    const row = rows[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
    return { ok: row.count <= limit, retryAfterSeconds };
  } catch (err) {
    // Fail closed: if the limiter can't count, don't let requests through uncounted
    console.error("rate limit check failed", err);
    return { ok: false, retryAfterSeconds: 60 };
  }
}

// Vercel sets x-real-ip to the connecting client's address; it can't be spoofed by the
// caller. IPv6 addresses are bucketed by /64, since one client usually controls a whole /64.
export function clientIp(headers: Headers): string {
  const ip = headers.get("x-real-ip")?.trim();
  if (!ip) return "unknown";
  if (!ip.includes(":")) return ip;
  // Expand "::" so every spelling of an address gives the same first four groups
  const [head, tail = ""] = ip.split("%")[0].split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  const prefix = groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16));
  return `${prefix.join(":")}::/64`;
}
