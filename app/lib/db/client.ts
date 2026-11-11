import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// One client per server instance. DATABASE_URL is Neon's pooled (PgBouncer) URL, which
// doesn't support prepared statements, hence prepare: false.
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    db = drizzle(postgres(url, { prepare: false, max: 3 }), { schema });
  }
  return db;
}
