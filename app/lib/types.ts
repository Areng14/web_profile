// Matches API project type
export interface ApiProject {
  id: string;
  name: string;
  description: string;
  gradientColor: string[];
  gradientAngle: number;
  gitRepo: string;
  skillId: string[];
  // What it is and where it runs, shown as tiles on the project page
  kind?: string;
  platform?: string;
  // Marks a project that real people use; shown as an icon next to the name
  hasUsers?: boolean;
  // Link to a playable/live version hosted on this site, e.g. "/games/td"
  playUrl?: string;
  // Finished, replaced or abandoned; shown in the graveyard instead of the main grid
  graveyard?: boolean;
  // Why a graveyard project ended, shown on its card
  causeOfDeath?: string;
  // A proof of concept (e.g. built for a competition) rather than something in real use
  prototype?: boolean;
}

// Matches API skill type
export enum SkillType {
  Lang = "Language",
  DesignTools = "DesignTool",
  Framework = "Framework",
  Tools = "Tool",
}

export interface ApiSkill {
  id: string;
  skillName: string;
  gradientColor: string[];
  gradientAngle: number;
  icon: string;
  skillType: SkillType;
  // Solid brand color used by the skill card; falls back to gradientColor[0].
  color?: string;
  // What I use this skill for, shown on the skill card
  description?: string;
}

// gitRepo can be a full URL, "owner/repo", or just a repo name under my account
export const repoUrl = (gitRepo: string) =>
  gitRepo.startsWith("http")
    ? gitRepo
    : `https://github.com/${gitRepo.includes("/") ? gitRepo : `areng14/${gitRepo}`}`;

// URL-safe name for a project's page, e.g. "Railway Signalling Sim" -> "railway-signalling-sim"
export const projectSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Display shape used by frontend components
export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string;
  gradientColors: string[];
  gradientAngle: number;
  gitRepo?: string;
  kind?: string;
  platform?: string;
  hasUsers?: boolean;
  playUrl?: string;
  graveyard?: boolean;
  causeOfDeath?: string;
  prototype?: boolean;
  technologies: string[];
}

export function apiProjectToProject(api: ApiProject, skillIdToName: Record<string, string>): Project {
  return {
    id: api.id,
    slug: projectSlug(api.name),
    name: api.name,
    description: api.description,
    gradientColors: api.gradientColor ?? [],
    gradientAngle: api.gradientAngle ?? 45,
    gitRepo: api.gitRepo || undefined,
    kind: api.kind,
    platform: api.platform,
    hasUsers: api.hasUsers,
    playUrl: api.playUrl,
    graveyard: api.graveyard,
    causeOfDeath: api.causeOfDeath,
    prototype: api.prototype,
    technologies: (api.skillId ?? []).map((id) => skillIdToName[id] || id),
  };
}
