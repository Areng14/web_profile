import { asc, isNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb, hasDatabase } from "./db/client";
import { projects as projectsTable, skills as skillsTable } from "./db/schema";
import { seedProjectRecords, seedSkillRecords } from "./seed";
import { apiProjectToProject } from "./types";
import type { ApiProject, ApiSkill, Project, ProjectRecord, SkillRecord } from "./types";

// Public pages read content from Postgres through Next's data cache, so visitors never
// wait on the database: saving in the admin panel revalidates the CONTENT_TAG.
// Without DATABASE_URL (local dev) the seed content is served instead.

export const CONTENT_TAG = "content";

interface SiteContent {
  skills: SkillRecord[];
  projects: ProjectRecord[];
}

const loadContent = unstable_cache(
  async (): Promise<SiteContent> => {
    if (!hasDatabase()) {
      return { skills: seedSkillRecords(), projects: seedProjectRecords() };
    }
    const db = getDb();
    const [skills, projects] = await Promise.all([
      db
        .select({
          id: skillsTable.id,
          name: skillsTable.name,
          description: skillsTable.description,
          color: skillsTable.color,
          icon: skillsTable.icon,
          type: skillsTable.type,
          position: skillsTable.position,
        })
        .from(skillsTable)
        .where(isNull(skillsTable.deletedAt))
        .orderBy(asc(skillsTable.position)),
      db
        .select({
          id: projectsTable.id,
          slug: projectsTable.slug,
          name: projectsTable.name,
          kind: projectsTable.kind,
          platform: projectsTable.platform,
          description: projectsTable.description,
          repo: projectsTable.repo,
          playUrl: projectsTable.playUrl,
          hasUsers: projectsTable.hasUsers,
          prototype: projectsTable.prototype,
          graveyard: projectsTable.graveyard,
          causeOfDeath: projectsTable.causeOfDeath,
          skillIds: projectsTable.skillIds,
          stack: projectsTable.stack,
          writeup: projectsTable.writeup,
          images: projectsTable.images,
          position: projectsTable.position,
        })
        .from(projectsTable)
        .where(isNull(projectsTable.deletedAt))
        .orderBy(asc(projectsTable.position)),
    ]);
    return { skills: skills as SkillRecord[], projects };
  },
  ["site-content"],
  { tags: [CONTENT_TAG] },
);

export const getSiteContent = loadContent;

// Card-sized skill info for client components (icons and colors for tags and chips)
export interface SkillStyle {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export async function fetchSkillStyles(): Promise<SkillStyle[]> {
  const { skills } = await loadContent();
  return skills.map(({ id, name, icon, color }) => ({ id, name, icon, color }));
}

export async function fetchPublicSkills(): Promise<ApiSkill[]> {
  const { skills } = await loadContent();
  return skills.map((s) => ({
    id: s.id,
    skillName: s.name,
    description: s.description,
    color: s.color,
    gradientColor: [s.color],
    gradientAngle: 45,
    icon: s.icon,
    skillType: s.type,
  }));
}

export async function fetchProjects(): Promise<ApiProject[]> {
  const { projects } = await loadContent();
  return projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    gradientColor: [],
    gradientAngle: 45,
    gitRepo: p.repo,
    skillId: p.skillIds,
    kind: p.kind || undefined,
    platform: p.platform || undefined,
    hasUsers: p.hasUsers,
    playUrl: p.playUrl || undefined,
    graveyard: p.graveyard,
    causeOfDeath: p.causeOfDeath || undefined,
    prototype: p.prototype,
  }));
}

export async function fetchProjectsForDisplay(): Promise<Project[]> {
  const [apiProjects, apiSkills] = await Promise.all([fetchProjects(), fetchPublicSkills()]);
  const skillIdToName: Record<string, string> = {};
  apiSkills.forEach((s) => {
    skillIdToName[s.id] = s.skillName;
  });
  return apiProjects
    .map((p) => apiProjectToProject(p, skillIdToName))
    // A tag pointing at a trashed skill would render as a bare id
    .map((p) => ({ ...p, technologies: p.technologies.filter((t) => apiSkills.some((s) => s.skillName === t)) }));
}

export async function fetchProjectRecord(slug: string): Promise<ProjectRecord | undefined> {
  const { projects } = await loadContent();
  return projects.find((p) => p.slug === slug);
}
