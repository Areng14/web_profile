"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: { id: string; email: string; name: string } }>("login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      login(data.token, data.user);
      router.push("/admin/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-700 bg-[#0c0d0f] p-6">
      <h1 className="mb-6 text-2xl font-bold">Admin Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sky-600 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        No account? <Link href="/admin/register" className="text-sky-400 hover:underline">Register</Link>
      </p>
    </div>
  );
}
