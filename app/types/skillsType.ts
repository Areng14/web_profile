export enum SkillType {
    Lang = "Language",
    DesignTools = "DesignTool",
    Framework = "Framework",
}

export interface ISkill {
  id: string;
  skillName: string;
  gradientColor: string[];
  gradientAngle: number;
  icon: string;
  skill_type: SkillType;
}

export type CreateSkillDTO = Omit<ISkill, "id">;
export type UpdateSkillDTO = Partial<CreateSkillDTO>;
