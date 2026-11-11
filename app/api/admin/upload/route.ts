import { put } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { adminGuard, jsonError } from "../../../lib/admin/guard";
import { MAX_ICON_BYTES, unsafeSvgReason } from "../../../lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Screenshots: re-encoded to WebP (max 1600px wide) and stored in Vercel Blob. Re-encoding
// drops all metadata, including the GPS location phones put in photos.
// Skill icons: SVGs returned as a data URI and stored inline with the skill.

// Vercel rejects request bodies over 4.5 MB; the panel shrinks images in the browser
// before uploading, so they fit
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const guard = await adminGuard(req, "upload");
  if ("response" in guard) return guard.response;

  // Refuse oversized bodies before reading them
  const length = Number(req.headers.get("content-length"));
  if (!length || length > MAX_BODY_BYTES) return jsonError("Images must be under 4 MB", 413);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind") === "icon" ? "icon" : "image";
  if (!(file instanceof File)) return jsonError('Expected a file in the "file" field', 400);

  if (kind === "icon") {
    if (file.size > MAX_ICON_BYTES) return jsonError("Icons must be under 30 KB", 413);
    const svg = await file.text();
    const problem = unsafeSvgReason(svg);
    if (problem) return jsonError(problem, 415);
    return NextResponse.json({ url: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return jsonError("Image storage isn't connected yet (Vercel Blob)", 503);

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

  try {
    // put() retries on its own and doesn't always honor an abort signal, so cap it here
    const blob = await Promise.race([
      put(`projects/${crypto.randomUUID()}.webp`, webp, { access: "public", contentType: "image/webp" }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Blob upload timed out")), 25_000)),
    ]);
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("blob upload failed", err);
    return jsonError("Couldn't store the image. Try again.", 502);
  }
}
