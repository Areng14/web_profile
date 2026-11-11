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

export async function uploadFile(file: File, kind: "image" | "icon"): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  const { url } = await api<{ url: string }>("/api/admin/upload", { method: "POST", body: form });
  return url;
}
