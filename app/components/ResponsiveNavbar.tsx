"use client";

import * as React from "react";
import Link from "next/link";

const pages = [
  {
    id: 1,
    name: "About",
    url: "/about",
  },
  {
    id: 2,
    name: "Projects",
    url: "/projects",
  },
  {
    id: 3,
    name: "Contact",
    url: "/contact",
  },
];

function ResponsiveAppBar() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101214]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <img
            src="/icon.png"
            alt="App Logo"
            className="hidden h-8 w-8 md:inline-block"
          />
          <Link
            href="/"
            className="hidden text-lg tracking-[0.3em] text-slate-50 md:inline-block"
          >
            ARENG
          </Link>

          <img
            src="/icon.png"
            alt="App Logo"
            className="inline-block h-8 w-8 md:hidden"
          />
          <Link
            href="/"
            className="inline-block text-lg tracking-[0.3em] text-slate-50 md:hidden"
          >
            ARENG
          </Link>
        </div>

        {/* Desktop links */}
        <div className="hidden items-center gap-4 md:flex">
          {pages.map((page) => (
            <Link
              key={page.id}
              href={page.url}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800/80"
            >
              {page.name}
            </Link>
          ))}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-100 hover:bg-slate-800 md:hidden"
          aria-label="Toggle navigation menu"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
        </button>
      </nav>

      {/* Mobile menu */}
      {isOpen && (
        <div className="border-t border-slate-800 bg-[#101214] md:hidden">
          <div className="space-y-1 px-4 py-3">
            {pages.map((page) => (
              <Link
                key={page.id}
                href={page.url}
                className="block rounded-md px-3 py-2 text-base font-medium text-slate-100 hover:bg-slate-800/80"
                onClick={() => setIsOpen(false)}
              >
                {page.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

export default ResponsiveAppBar;

