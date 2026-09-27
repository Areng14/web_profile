// Matches API project type
export interface ApiProject {
  id: string;
  name: string;
  description: string;
  gradientColor: string[];
  gradientAngle: number;
  gitRepo: string;
  skillId: string[];
  // Marks a project that real people use; shown as an icon next to the name
  hasUsers?: boolean;
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

// Display shape used by frontend components
export interface Project {
  id: string;
  name: string;
  description: string;
  gradientColors: string[];
  gradientAngle: number;
  gitRepo?: string;
  hasUsers?: boolean;
  technologies: string[];
}

export function apiProjectToProject(api: ApiProject, skillIdToName: Record<string, string>): Project {
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    gradientColors: api.gradientColor ?? [],
    gradientAngle: api.gradientAngle ?? 45,
    gitRepo: api.gitRepo || undefined,
    hasUsers: api.hasUsers,
    technologies: (api.skillId ?? []).map((id) => skillIdToName[id] || id),
  };
}
