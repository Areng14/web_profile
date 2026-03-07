import { apiFetch } from "./api";
import type { ApiProject, ApiSkill, Project } from "./types";

export async function fetchPublicSkills(): Promise<ApiSkill[]> {
  const data = await apiFetch<ApiSkill[]>("public/skills");
  return Array.isArray(data) ? data : [];
}

export async function fetchProjects(): Promise<ApiProject[]> {
  const data = await apiFetch<ApiProject[]>("projects");
  return Array.isArray(data) ? data : [];
}

export async function fetchProjectsForDisplay(): Promise<Project[]> {
  const [apiProjects, skills] = await Promise.all([
    fetchProjects(),
    fetchPublicSkills(),
  ]);
  const skillIdToName: Record<string, string> = {};
  skills.forEach((s) => {
    skillIdToName[s.id] = s.skillName;
  });
  const { apiProjectToProject } = await import("./types");
  return apiProjects.map((p) => apiProjectToProject(p, skillIdToName));
}
