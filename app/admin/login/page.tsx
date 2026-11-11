import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSessionCurrent } from "../../lib/admin/owner";
import { readSession, SESSION_COOKIE } from "../../lib/admin/session";
import { hasDatabase } from "../../lib/db/client";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  rate_limited: "Too many attempts. Try again in {retry} min.",
  denied: "That GitHub account doesn't have access.",
  expired: "Sign-in expired. Try again.",
  github: "GitHub didn't respond. Try again.",
  not_configured: "Sign-in isn't set up yet (missing GitHub OAuth keys).",
};

interface LoginProps {
  searchParams: Promise<{ error?: string; retry?: string }>;
}

export default async function AdminLogin({ searchParams }: LoginProps) {
  // Already signed in: straight to the panel. A signed-out (revoked) cookie stays here.
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session && hasDatabase() && (await isSessionCurrent(session))) redirect("/admin");

  const { error, retry } = await searchParams;
  const message = error && ERRORS[error] ? ERRORS[error].replace("{retry}", /^\d{1,3}$/.test(retry ?? "") ? retry! : "15") : null;
  const blocked = error === "rate_limited";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 py-12">
      <div className="flex w-full max-w-[360px] flex-col gap-6 rounded-2xl border border-white/[0.06] bg-card-bg p-8">
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-semibold tracking-[0.3em] text-slate-400">ARENG</span>
          <h1 className="text-2xl font-bold text-white">Admin sign in</h1>
        </div>

        {message && (
          <div
            role="alert"
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${
              blocked
                ? "border-orange-400/30 bg-[#221811] text-orange-200"
                : "border-red-400/25 bg-[#22131a] text-red-200"
            }`}
          >
            <svg className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" d={blocked ? "M12 7v5l3 2" : "M12 8v5m0 3h.01"} />
            </svg>
            {message}
          </div>
        )}

        {blocked ? (
          <span className="flex h-12 cursor-not-allowed items-center justify-center gap-2.5 rounded-xl bg-[#1f2328] text-[15px] font-semibold text-slate-500">
            <GitHubMark />
            Continue with GitHub
          </span>
        ) : (
          // A plain link: the sign-in route redirects to GitHub
          <a
            href="/api/admin/auth/login"
            className="flex h-12 items-center justify-center gap-2.5 rounded-xl bg-white text-[15px] font-semibold text-background transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg"
          >
            <GitHubMark />
            Continue with GitHub
          </a>
        )}
      </div>

      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Back to home
      </Link>
    </div>
  );
}

function GitHubMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
