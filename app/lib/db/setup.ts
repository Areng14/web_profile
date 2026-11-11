import postgres from "postgres";
import { seedProjectRecords, seedSkillRecords } from "../seed";

// Creates the tables if they don't exist and fills them with the launch content once.
// Safe to run on every deploy: it never touches existing rows, and a "seeded" marker
// means deleting everything in the panel doesn't bring the launch content back.

const DDL = `
CREATE TABLE IF NOT EXISTS skills (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL,
  icon text NOT NULL DEFAULT '',
  type text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  repo text NOT NULL DEFAULT '',
  play_url text NOT NULL DEFAULT '',
  has_users boolean NOT NULL DEFAULT false,
  prototype boolean NOT NULL DEFAULT false,
  graveyard boolean NOT NULL DEFAULT false,
  cause_of_death text NOT NULL DEFAULT '',
  skill_ids text[] NOT NULL DEFAULT '{}',
  stack text[] NOT NULL DEFAULT '{}',
  writeup text NOT NULL DEFAULT '',
  images jsonb NOT NULL DEFAULT '[]',
  position integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);
`;

export async function setupDatabase(url: string, log: (msg: string) => void = console.log) {
  // Unpooled connection: DDL and a multi-statement script don't belong on PgBouncer
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(DDL);

    const [seeded] = await sql`SELECT 1 FROM admin_settings WHERE key = 'seeded'`;
    if (!seeded) {
      const [{ count: skillCount }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM skills`;
      if (skillCount === 0) {
        const rows = seedSkillRecords();
        await sql`INSERT INTO skills ${sql(rows, "id", "name", "description", "color", "icon", "type", "position")}`;
        log(`Seeded ${rows.length} skills`);
      }

      const [{ count: projectCount }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM projects`;
      if (projectCount === 0) {
        for (const p of seedProjectRecords()) {
          await sql`
            INSERT INTO projects (id, slug, name, kind, platform, description, repo, play_url, has_users,
              prototype, graveyard, cause_of_death, skill_ids, stack, writeup, images, position)
            VALUES (${p.id}, ${p.slug}, ${p.name}, ${p.kind}, ${p.platform}, ${p.description}, ${p.repo},
              ${p.playUrl}, ${p.hasUsers}, ${p.prototype}, ${p.graveyard}, ${p.causeOfDeath},
              ${sql.array(p.skillIds)}, ${sql.array(p.stack)}, ${p.writeup},
              ${sql.json(p.images as unknown as postgres.JSONValue)}, ${p.position})`;
        }
        log("Seeded projects");
      }

      await sql`INSERT INTO admin_settings (key, value) VALUES ('seeded', now()::text) ON CONFLICT (key) DO NOTHING`;
    }
  } finally {
    await sql.end();
  }
}
