const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT;

export const SKILL_ENDPOINT = {
  getAllSkills: `${API_ENDPOINT}/api/skills`,
  getAllProjects: `${API_ENDPOINT}/api/projects`,
};
