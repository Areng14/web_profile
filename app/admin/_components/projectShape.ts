import type { ProjectImage } from "../../lib/types";

// The editable fields of a project, shared by the editor (client) and its page (server)

export interface EditableProject {
  name: string;
  slug: string;
  kind: string;
  platform: string;
  description: string;
  repo: string;
  playUrl: string;
  hasUsers: boolean;
  prototype: boolean;
  graveyard: boolean;
  causeOfDeath: string;
  skillIds: string[];
  stack: string[];
  writeup: string;
  images: ProjectImage[];
}

export const emptyProject: EditableProject = {
  name: "",
  slug: "",
  kind: "",
  platform: "",
  description: "",
  repo: "",
  playUrl: "",
  hasUsers: false,
  prototype: false,
  graveyard: false,
  causeOfDeath: "",
  skillIds: [],
  stack: [],
  writeup: "",
  images: [],
};

// Just the editable fields, in a stable key order so edits can be compared as JSON
export function pickEditable(p: object): EditableProject {
  return Object.fromEntries(Object.keys(emptyProject).map((k) => [k, (p as Record<string, unknown>)[k]])) as unknown as EditableProject;
}
