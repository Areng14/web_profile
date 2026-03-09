"use client";

import { AuthProvider, useAuth } from "../context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { token, isReady, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (!isReady) return;
    if (!token && !isLogin) {
      router.replace("/admin/login");
      return;
    }
  }, [isReady, token, isLogin, router]);

  const handleLogout = () => {
    logout();
    router.push("/admin/login");
  };

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  if (!token && isLogin) {
    return <>{children}</>;
  }

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#101214] text-slate-50">
      <header className="border-b border-slate-800 bg-[#0c0d0f] px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/admin" className="text-lg font-semibold">
            Admin
          </Link>
          <nav className="flex gap-4">
            <Link
              href="/admin/projects"
              className="rounded px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Projects
            </Link>
            <Link
              href="/admin/skills"
              className="rounded px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Skills
            </Link>
            <Link
              href="/"
              className="rounded px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Site
            </Link>
            <Link
              href="/admin/login"
              className="rounded px-3 py-2 text-slate-400 hover:bg-slate-800"
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
            >
              Logout
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AuthProvider>
  );
}
