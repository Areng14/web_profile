'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ProjectCard from "../components/ProjectCard";
import { skills } from "../lib/content";
import type { Project } from "../lib/types";

interface ProjectSearchProps {
  projects: Project[];
  initialTech: string | null;
  initialSearch: string;
}

const skillColor = (s: (typeof skills)[number]) => s.color ?? s.gradientColor?.[0] ?? "#94a3b8";

// Animate a filter change with the View Transitions API so cards slide to their
// new spots and fade in/out. Falls back to an instant update where unsupported.
const withTransition = (update: () => void) => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduceMotion) {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
};

// Smooth-scroll an element to the top of the viewport, then run a callback.
// Filtering waits for the scroll so the animation isn't fighting it.
const scrollThen = (el: HTMLElement | null, callback: () => void) => {
  if (!el) return callback();
  const offset = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  if (Math.abs(el.getBoundingClientRect().top - offset) < 8) return callback();

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener("scrollend", finish);
    callback();
  };
  window.addEventListener("scrollend", finish);
  setTimeout(finish, 900); // fallback for browsers without scrollend
  el.scrollIntoView({ behavior: "smooth", block: "start" });
};

const SELECT_TECH_EVENT = "projects:select-tech";

// Lets other parts of the page (e.g. skill cards) filter the project grid
export const selectProjectTech = (id: string) =>
  window.dispatchEvent(new CustomEvent<string>(SELECT_TECH_EVENT, { detail: id }));

export default function ProjectSearch({
  projects,
  initialTech,
  initialSearch,
}: ProjectSearchProps) {
  const [tech, setTech] = useState<string | null>(initialTech);
  // searchTerm drives the input; query is the debounced value used for filtering
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
  const [query, setQuery] = useState<string>(initialSearch);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Chips: every skill that at least one project uses, with its project count
  const chips = useMemo(
    () =>
      skills
        .map((s) => ({
          id: s.id,
          name: s.skillName,
          icon: s.icon,
          color: skillColor(s),
          count: projects.filter((p) => p.technologies.includes(s.skillName)).length,
        }))
        .filter((c) => c.count > 0),
    [projects],
  );

  const activeChip = chips.find((c) => c.id === tech) ?? null;

  // Arriving with a filter in the URL: bring the filters into view
  useEffect(() => {
    if (initialTech || initialSearch) {
      filtersRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skill cards elsewhere on the page ask to show a technology's projects
  useEffect(() => {
    const onSelect = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      scrollThen(filtersRef.current, () => withTransition(() => setTech(id)));
    };
    window.addEventListener(SELECT_TECH_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_TECH_EVENT, onSelect);
  }, []);

  // Apply typed searches after a short pause so every keystroke doesn't restart the animation
  useEffect(() => {
    if (searchTerm === query) return;
    const timeout = setTimeout(() => withTransition(() => setQuery(searchTerm)), 150);
    return () => clearTimeout(timeout);
  }, [searchTerm, query]);

  // Keep the URL shareable without stacking history entries
  useEffect(() => {
    const params = new URLSearchParams();
    if (tech) params.set("tech", tech);
    if (query) params.set("search", query);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [tech, query]);

  const filteredProjects = useMemo(() => {
    const searchLower = query.toLowerCase();
    return projects.filter((project) => {
      if (activeChip && !project.technologies.includes(activeChip.name)) return false;
      if (!searchLower) return true;
      return (
        project.name.toLowerCase().includes(searchLower) ||
        project.description.toLowerCase().includes(searchLower) ||
        project.technologies.some((t) => t.toLowerCase().includes(searchLower))
      );
    });
  }, [projects, activeChip, query]);

  const selectTech = (id: string | null) =>
    withTransition(() => setTech((current) => (current === id ? null : id)));

  // Clicking a tag on a card switches the filter and jumps back up to it
  const handleTagClick = (techName: string) => {
    const chip = chips.find((c) => c.name === techName);
    if (!chip) return;
    scrollThen(filtersRef.current, () => withTransition(() => setTech(chip.id)));
  };

  const clearFilters = () =>
    withTransition(() => {
      setTech(null);
      setSearchTerm("");
      setQuery("");
    });

  const chipClass = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-[var(--chip)] bg-white/[0.06] text-white"
        : "border-white/[0.06] bg-card-bg text-slate-400 hover:border-white/20 hover:text-slate-200"
    }`;

  return (
    <>
      <div ref={filtersRef} className="mb-6 flex scroll-mt-24 flex-col gap-4">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m0 0A7 7 0 1010.3 17.3a7 7 0 006.35-6.65z"
              />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-white/[0.06] bg-card-bg py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by technology">
          <button
            type="button"
            onClick={() => selectTech(null)}
            aria-pressed={!activeChip}
            className={chipClass(!activeChip)}
            style={{ ["--chip" as string]: "rgba(255,255,255,0.35)" }}
          >
            All
            <span className="text-xs text-slate-500">{projects.length}</span>
          </button>
          {chips.map((chip) => {
            const active = activeChip?.id === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => selectTech(chip.id)}
                aria-pressed={active}
                className={chipClass(active)}
                style={{ ["--chip" as string]: chip.color }}
              >
                <span
                  className="block h-3.5 w-3.5"
                  style={{
                    backgroundColor: chip.color,
                    WebkitMask: `url("${chip.icon}") center / contain no-repeat`,
                    mask: `url("${chip.icon}") center / contain no-repeat`,
                  }}
                  aria-hidden
                />
                {chip.name}
                <span className="text-xs text-slate-500">{chip.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              description={project.description}
              gitRepo={project.gitRepo}
              hasUsers={project.hasUsers}
              replacedBy={project.replacedBy}
              technologies={project.technologies}
              activeTech={activeChip?.name}
              onTechClick={handleTagClick}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10"
          style={{ viewTransitionName: "projects-empty" }}
        >
          <p className="text-slate-500">No projects found</p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
