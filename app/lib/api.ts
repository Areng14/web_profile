// Must be absolute for server-side fetch (e.g. in Server Components)
const baseUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000";

export function getApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}/api${p}`;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...init } = options ?? {};
  const url = getApiUrl(path);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  return data as T;
}
