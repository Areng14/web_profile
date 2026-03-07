"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

export default function AdminRegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("register", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      });
      router.push("/admin/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-700 bg-[#0c0d0f] p-6">
      <h1 className="mb-6 text-2xl font-bold">Register</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
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
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        Already have an account? <Link href="/admin/login" className="text-sky-400 hover:underline">Login</Link>
      </p>
    </div>
  );
}
