import { put } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { adminGuard, jsonError } from "../../../lib/admin/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Screenshots: re-encoded to WebP (max 1600px wide) and stored in Vercel Blob. Re-encoding
// drops all metadata, including the GPS location phones put in photos.
// Skill icons: SVGs returned as a data URI and stored inline with the skill.

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_ICON_BYTES = 100 * 1024;

export async function POST(req: NextRequest) {
  const guard = await adminGuard(req, "upload");
  if ("response" in guard) return guard.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind") === "icon" ? "icon" : "image";
  if (!(file instanceof File)) return jsonError('Expected a file in the "file" field', 400);

  if (kind === "icon") {
    if (file.size > MAX_ICON_BYTES) return jsonError("Icons must be under 100 KB", 413);
    const svg = await file.text();
    if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(svg)) return jsonError("Icons must be SVG files", 415);
    // Icons are only ever drawn as CSS masks, where scripts can't run, but there's no reason
    // to store active content at all
    if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:|<!ENTITY/i.test(svg)) {
      return jsonError("That SVG contains scripts or embedded content", 415);
    }
    return NextResponse.json({ url: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) return jsonError("Image storage isn't connected yet (Vercel Blob)", 503);
  if (file.size > MAX_IMAGE_BYTES) return jsonError("Images must be under 15 MB", 413);

  let webp: Buffer;
  try {
    // sharp checks the actual bytes, so a renamed file of another type is rejected here
    webp = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate() // apply the EXIF orientation before the EXIF data is dropped
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return jsonError("That file isn't an image this can read (try PNG, JPEG or WebP)", 415);
  }

  const blob = await put(`projects/${crypto.randomUUID()}.webp`, webp, {
    access: "public",
    contentType: "image/webp",
  });
  return NextResponse.json({ url: blob.url });
}
