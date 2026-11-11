import { z } from "zod";
import { SkillType } from "../types";

// Everything the admin API accepts is parsed here first; nothing unvalidated reaches the DB.

const text = (max: number) => z.string().trim().max(max);

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

// Screenshots are either files shipped in /public or uploads in this site's Blob store
const imageSrc = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      (v.startsWith("/") && !v.startsWith("//") && !v.includes("..")) ||
      /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(v),
    "Images must be uploaded here or live under /public",
  );

const linkPath = text(300).refine(
  (v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\//i.test(v),
  "Use a /path on this site or an https:// link",
);

const repo = text(200).refine(
  (v) => v === "" || /^[\w.-]+(\/[\w.-]+)?$/.test(v) || /^https:\/\//i.test(v),
  "Use owner/repo or an https:// link",
);

export const projectInput = z.object({
  name: text(100).min(1, "Name is required"),
  slug: slugSchema,
  kind: text(60),
  platform: text(60),
  description: text(500),
  repo,
  playUrl: linkPath,
  hasUsers: z.boolean(),
  prototype: z.boolean(),
  graveyard: z.boolean(),
  causeOfDeath: text(300),
  skillIds: z.array(z.string().max(60)).max(20),
  stack: z.array(text(80).min(1)).max(40),
  writeup: z.string().max(50_000),
  images: z.array(z.object({ src: imageSrc, alt: text(300) })).max(40),
});

export type ProjectInput = z.infer<typeof projectInput>;

// Skill icons are tiny SVGs stored inline as data URIs, or files under /public
const iconSchema = z
  .string()
  .max(140_000)
  .refine(
    (v) => v === "" || (v.startsWith("/") && !v.startsWith("//") && !v.includes("..")) || v.startsWith("data:image/svg+xml;base64,"),
    "Upload an SVG icon",
  );

export const skillInput = z.object({
  name: text(60).min(1, "Name is required"),
  description: text(400),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #4B8BBE"),
  icon: iconSchema,
  type: z.nativeEnum(SkillType),
});

export const newSkillInput = skillInput.extend({ id: slugSchema });

export type SkillInput = z.infer<typeof skillInput>;

export const orderInput = z.object({ ids: z.array(z.string().max(80)).max(500) });

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}
