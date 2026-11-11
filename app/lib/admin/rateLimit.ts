import { sql } from "drizzle-orm";
import { getDb } from "../db/client";

// Fixed-window rate limiting backed by Postgres, so the count is shared by every
// serverless instance. One atomic upsert per request.

export const LIMITS = {
  // Starting a sign-in and finishing it both count
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
    const rows = await getDb().execute<{ count: number; reset_at: Date }>(sql`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at <= now()
          THEN now() + make_interval(secs => ${windowSeconds}) ELSE rate_limits.reset_at END
      RETURNING count, reset_at
    `);
    const row = rows[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
    return { ok: row.count <= limit, retryAfterSeconds };
  } catch (err) {
    // Fail closed: if the limiter can't count, don't let requests through uncounted
    console.error("rate limit check failed", err);
    return { ok: false, retryAfterSeconds: 60 };
  }
}

// Vercel sets x-real-ip to the connecting client's address; it can't be spoofed by the caller
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
