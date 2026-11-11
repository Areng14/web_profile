import { projects as seedProjects, skills as seedSkills } from "./content";
import { projectDetails, type ProjectSection } from "./details";
import { projectSlug, type ProjectRecord, type SkillRecord } from "./types";

// Turns the launch content (content.ts + details.ts) into database rows.

// Old writeups were lists of sections; the admin panel edits Markdown
export function sectionsToMarkdown(sections: ProjectSection[] = []): string {
  return sections
    .map((section) => {
      const blocks = section.body.map((block) =>
        typeof block === "string" ? block : block.map((item) => `- ${item}`).join("\n"),
      );
      return [section.title ? `## ${section.title}` : null, ...blocks].filter(Boolean).join("\n\n");
    })
    .join("\n\n");
}

export function seedSkillRecords(): SkillRecord[] {
  return seedSkills.map((s, i) => ({
    id: s.id,
    name: s.skillName,
    description: s.description ?? "",
    color: s.color ?? s.gradientColor?.[0] ?? "#94a3b8",
    icon: s.icon ?? "",
    type: s.skillType,
    position: i,
  }));
}

export function seedProjectRecords(): ProjectRecord[] {
  return seedProjects.map((p, i) => {
    const details = projectDetails[p.id];
    return {
      id: p.id,
      slug: projectSlug(p.name),
      name: p.name,
      kind: p.kind ?? "",
      platform: p.platform ?? "",
      description: p.description,
      repo: p.gitRepo ?? "",
      playUrl: p.playUrl ?? "",
      hasUsers: Boolean(p.hasUsers),
      prototype: Boolean(p.prototype),
      graveyard: Boolean(p.graveyard),
      causeOfDeath: p.causeOfDeath ?? "",
      skillIds: p.skillId ?? [],
      stack: details?.tech ?? [],
      writeup: sectionsToMarkdown(details?.sections),
      images: details?.images ?? [],
      position: i,
    };
  });
}
