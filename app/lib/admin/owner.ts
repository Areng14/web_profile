import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db/client";
import { adminSettings } from "../db/schema";
import { readSession, SESSION_COOKIE, type AdminSession } from "./session";

// Server-side session checks that need the database. Every admin page calls
// requireOwner() itself; middleware and layouts aren't an auth boundary on their own.

const VALID_AFTER = "sessions_valid_after";

// Sessions issued at or before this second were ended by signing out
async function sessionsValidAfter(): Promise<number> {
  const [row] = await getDb().select({ value: adminSettings.value }).from(adminSettings).where(eq(adminSettings.key, VALID_AFTER));
  return row ? Number(row.value) || 0 : 0;
}

export async function isSessionCurrent(session: AdminSession): Promise<boolean> {
  return session.issuedAt > (await sessionsValidAfter());
}

// Signing out ends every session, including a copied cookie
export async function endAllSessions() {
  const now = String(Math.floor(Date.now() / 1000));
  await getDb().execute(sql`
    INSERT INTO admin_settings (key, value) VALUES (${VALID_AFTER}, ${now})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value
  `);
}

export async function requireOwner(): Promise<AdminSession> {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || !(await isSessionCurrent(session))) redirect("/admin/login");
  return session;
}
