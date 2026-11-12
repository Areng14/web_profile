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

// A path on this site: one leading slash, then only URL-safe characters. Rules out "//host"
// and "/\host" (which browsers treat as another site), "..", spaces and control characters.
const LOCAL_PATH = /^\/(?![\/\\])[A-Za-z0-9\-._~/%?#=&+]*$/;
const isLocalPath = (v: string) => LOCAL_PATH.test(v) && !v.includes("..");

// Only this site's own Blob store, whose public host is <storeId>.public.blob.vercel-storage.com.
// The store id is BLOB_STORE_ID minus its "store_" prefix (as @vercel/blob normalizes it), or
// the 4th part of a read-write token (vercel_blob_rw_<storeId>_<secret>).
function isOwnBlobUrl(v: string): boolean {
  const storeId = (process.env.BLOB_STORE_ID?.trim().replace(/^store_/, "") || process.env.BLOB_READ_WRITE_TOKEN?.split("_")[3])?.toLowerCase();
  if (!storeId) return false;
  try {
    const url = new URL(v);
    return url.protocol === "https:" && url.hostname === `${storeId}.public.blob.vercel-storage.com` && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Screenshots are either files shipped in /public or uploads in this site's Blob store
const imageSrc = z
  .string()
  .trim()
  .max(500)
  .refine((v) => isLocalPath(v) || isOwnBlobUrl(v), "Images must be uploaded here or live under /public");

const linkPath = text(300).refine(
  (v) => v === "" || isLocalPath(v) || /^https:\/\/[^\s\\]+$/i.test(v),
  "Use a /path on this site or an https:// link",
);

const repo = text(200).refine(
  (v) => v === "" || /^[\w.-]+(\/[\w.-]+)?$/.test(v) || /^https:\/\/[^\s\\]+$/i.test(v),
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
  draft: z.boolean(),
  causeOfDeath: text(300),
  skillIds: z.array(z.string().max(60)).max(20),
  stack: z.array(text(80).min(1)).max(40),
  writeup: z.string().max(50_000),
  images: z.array(z.object({ src: imageSrc, alt: text(300) })).max(40),
});

export type ProjectInput = z.infer<typeof projectInput>;

// SVG icons are only ever drawn as CSS masks, where scripts can't run, but there's no
// reason to store active content at all
export function unsafeSvgReason(svg: string): string | null {
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(svg)) return "Icons must be SVG files";
  if (/<script|<foreignObject|<iframe|<object|<embed|\son[a-z]+\s*=|javascript:|<!ENTITY|<!DOCTYPE/i.test(svg)) {
    return "That SVG contains scripts or embedded content";
  }
  return null;
}

export const MAX_ICON_BYTES = 30 * 1024;
const ICON_DATA_URI = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/]+={0,2})$/;

// Skill icons are tiny SVGs stored inline as base64 data URIs (checked again here, since
// the API can be called without the upload route), or files under /public
const iconSchema = z
  .string()
  .max(Math.ceil((MAX_ICON_BYTES * 4) / 3) + 40)
  .refine((v) => {
    if (v === "") return true;
    if (v.startsWith("/")) return /^\/[\w\-./]+\.svg$/.test(v) && !v.includes("..");
    const match = ICON_DATA_URI.exec(v);
    return Boolean(match && unsafeSvgReason(Buffer.from(match[1], "base64").toString("utf8")) === null);
  }, "Upload an SVG icon");

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
