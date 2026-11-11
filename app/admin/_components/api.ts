"use client";

// Small fetch wrapper for the admin API: JSON in, JSON out, readable errors

export class ApiError extends Error {}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  if (res.status === 401) {
    window.location.href = "/admin/login?error=expired";
    throw new ApiError("Signed out");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const retry = res.headers.get("Retry-After");
    throw new ApiError(
      (data as { error?: string }).error ?? `Request failed (${res.status})` + (retry ? `, retry in ${retry}s` : ""),
    );
  }
  return data as T;
}

// Vercel caps request bodies at 4.5 MB, and screenshots and phone photos are often bigger.
// Shrink them in the browser first; the server still re-encodes whatever arrives.
const MAX_UPLOAD_BYTES = 3.8 * 1024 * 1024;

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // applies EXIF rotation
  const scale = Math.min(1, 2400 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.92, 0.8, 0.65]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
  }
  throw new ApiError("That image is too big, even after shrinking it");
}

export async function uploadFile(file: File, kind: "image" | "icon"): Promise<string> {
  const form = new FormData();
  form.set("file", kind === "image" ? await shrinkImage(file) : file, kind === "image" ? "image.webp" : file.name);
  form.set("kind", kind);
  const { url } = await api<{ url: string }>("/api/admin/upload", { method: "POST", body: form });
  return url;
}
