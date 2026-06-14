import { projects, skills } from "./content";
import { apiProjectToProject } from "./types";
import type { ApiProject, ApiSkill, Project } from "./types";

// Serverless data access: content is read from local static data (./content),
// so the site runs without any external backend.

export async function fetchPublicSkills(): Promise<ApiSkill[]> {
  return skills;
}

export async function fetchProjects(): Promise<ApiProject[]> {
  return projects;
}

export async function fetchProjectsForDisplay(): Promise<Project[]> {
  const [apiProjects, apiSkills] = await Promise.all([
    fetchProjects(),
    fetchPublicSkills(),
  ]);
  const skillIdToName: Record<string, string> = {};
  apiSkills.forEach((s) => {
    skillIdToName[s.id] = s.skillName;
  });
  return apiProjects.map((p) => apiProjectToProject(p, skillIdToName));
}
