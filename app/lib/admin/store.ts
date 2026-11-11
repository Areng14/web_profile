import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "../db/client";
import { projects, skills } from "../db/schema";
import { CONTENT_TAG } from "../data";
import type { ProjectInput, SkillInput } from "./validation";

// Admin reads and writes. Unlike lib/data.ts these skip the cache and include the trash.

export type AdminProject = typeof projects.$inferSelect;
export type AdminSkill = typeof skills.$inferSelect;

// Rebuild the public pages after any change
export function publish() {
  revalidateTag(CONTENT_TAG);
  revalidatePath("/", "layout");
}

export async function listProjects(): Promise<AdminProject[]> {
  return getDb().select().from(projects).orderBy(asc(projects.position));
}

export async function getProject(id: string): Promise<AdminProject | undefined> {
  const [row] = await getDb().select().from(projects).where(eq(projects.id, id));
  return row;
}

export async function listSkills(): Promise<AdminSkill[]> {
  return getDb().select().from(skills).orderBy(asc(skills.position));
}

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const rows = await getDb().select({ id: projects.id }).from(projects).where(eq(projects.slug, slug));
  return rows.some((r) => r.id !== exceptId);
}

async function nextPosition(table: typeof projects | typeof skills): Promise<number> {
  const [row] = await getDb()
    .select({ max: sql<number>`coalesce(max(${table.position}), -1)` })
    .from(table);
  return Number(row.max) + 1;
}

export async function createProject(input: ProjectInput): Promise<AdminProject> {
  const id = crypto.randomUUID();
  const [row] = await getDb()
    .insert(projects)
    .values({ ...input, id, position: await nextPosition(projects) })
    .returning();
  return row;
}

export async function updateProject(id: string, input: ProjectInput): Promise<AdminProject | undefined> {
  const [row] = await getDb()
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return row;
}

export async function setProjectTrashed(id: string, trashed: boolean) {
  const [row] = await getDb()
    .update(projects)
    .set({ deletedAt: trashed ? new Date() : null, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning({ id: projects.id });
  return row;
}

// Permanent delete only works on something already in the trash
export async function deleteProjectForever(id: string) {
  const [row] = await getDb()
    .delete(projects)
    .where(sql`${projects.id} = ${id} AND ${isNotNull(projects.deletedAt)}`)
    .returning({ id: projects.id });
  return row;
}

export async function createSkill(id: string, input: SkillInput): Promise<AdminSkill> {
  const [row] = await getDb()
    .insert(skills)
    .values({ ...input, id, position: await nextPosition(skills) })
    .returning();
  return row;
}

export async function updateSkill(id: string, input: SkillInput): Promise<AdminSkill | undefined> {
  const [row] = await getDb()
    .update(skills)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(skills.id, id))
    .returning();
  return row;
}

export async function setSkillTrashed(id: string, trashed: boolean) {
  const [row] = await getDb()
    .update(skills)
    .set({ deletedAt: trashed ? new Date() : null, updatedAt: new Date() })
    .where(eq(skills.id, id))
    .returning({ id: skills.id });
  return row;
}

export async function deleteSkillForever(id: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(skills)
      .where(sql`${skills.id} = ${id} AND ${isNotNull(skills.deletedAt)}`)
      .returning({ id: skills.id });
    // Drop the tag from any project that still has it
    if (row) await tx.execute(sql`UPDATE projects SET skill_ids = array_remove(skill_ids, ${id})`);
    return row;
  });
}

// Positions follow the order of `ids`; the panel always sends the full list
export async function reorder(table: "projects" | "skills", ids: string[]) {
  const target = table === "projects" ? projects : skills;
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx.update(target).set({ position: i }).where(eq(target.id, id));
    }
  });
}
