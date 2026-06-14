import { NextResponse } from "next/server";

// Serverless route handler (runs as a serverless function on Vercel).
//
// Turns an uploaded SVG/image into a base64 data URI you can paste straight
// into app/lib/content.ts as a skill icon. No backend or storage required —
// the file is encoded in-memory and returned in the response.
//
// Usage:
//   multipart/form-data  ->  field "file" with the image
//   application/json     ->  { "name": "icon.svg", "data": "<base64 or data URI>" }

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED_MIME = new Set([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const EXT_TO_MIME: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
};

function mimeFromName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext ? EXT_TO_MIME[ext] ?? null : null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    let bytes: Buffer;
    let mimeType: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return jsonError('Expected a file in the "file" field.', 400);
      }
      mimeType = file.type || mimeFromName(file.name);
      bytes = Buffer.from(await file.arrayBuffer());
    } else if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        data?: string;
        name?: string;
        mimeType?: string;
      };
      if (!body?.data) {
        return jsonError('Expected JSON with a "data" field.', 400);
      }
      // Accept either a raw base64 string or a full data URI.
      const match = body.data.match(/^data:([^;]+);base64,([\s\S]*)$/);
      if (match) {
        mimeType = match[1];
        bytes = Buffer.from(match[2], "base64");
      } else {
        bytes = Buffer.from(body.data, "base64");
        mimeType = body.mimeType ?? (body.name ? mimeFromName(body.name) : null);
      }
    } else {
      return jsonError(
        "Unsupported content type. Use multipart/form-data or application/json.",
        415,
      );
    }

    if (!mimeType) {
      return jsonError(
        "Could not determine the image type. Provide a filename or mimeType.",
        400,
      );
    }
    if (!ALLOWED_MIME.has(mimeType)) {
      return jsonError(`Unsupported image type: ${mimeType}`, 415);
    }
    if (bytes.length === 0) {
      return jsonError("The uploaded file is empty.", 400);
    }
    if (bytes.length > MAX_BYTES) {
      return jsonError("File too large (max 2 MB).", 413);
    }

    const base64 = bytes.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      mimeType,
      size: bytes.length,
      base64,
      dataUri,
    });
  } catch {
    return jsonError("Failed to process the upload.", 400);
  }
}

export function GET() {
  return NextResponse.json({
    message:
      "POST an SVG/image (multipart field 'file', or JSON {name, data}) to receive a base64 data URI for use as a skill icon.",
    allowed: Array.from(ALLOWED_MIME),
    maxBytes: MAX_BYTES,
  });
}
