'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import ProjectCard from "../components/ProjectCard";
import { skills } from "../lib/content";
import type { Project } from "../lib/types";

interface ProjectSearchProps {
  projects: Project[];
  initialTech: string | null;
  initialSearch: string;
}

const skillColor = (s: (typeof skills)[number]) => s.color ?? s.gradientColor?.[0] ?? "#94a3b8";

export default function ProjectSearch({
  projects,
  initialTech,
  initialSearch,
}: ProjectSearchProps) {
  const [tech, setTech] = useState<string | null>(initialTech);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
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

  // Arriving from a skill card: bring the filters into view
  useEffect(() => {
    if (initialTech || initialSearch) {
      filtersRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL shareable without stacking history entries
  useEffect(() => {
    const params = new URLSearchParams();
    if (tech) params.set("tech", tech);
    if (searchTerm) params.set("search", searchTerm);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [tech, searchTerm]);

  const filteredProjects = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return projects.filter((project) => {
      if (activeChip && !project.technologies.includes(activeChip.name)) return false;
      if (!searchLower) return true;
      return (
        project.name.toLowerCase().includes(searchLower) ||
        project.description.toLowerCase().includes(searchLower) ||
        project.technologies.some((t) => t.toLowerCase().includes(searchLower))
      );
    });
  }, [projects, activeChip, searchTerm]);

  const selectTech = (id: string | null) => setTech((current) => (current === id ? null : id));

  // Clicking a tag on a card switches the filter and jumps back up to it
  const handleTagClick = (techName: string) => {
    const chip = chips.find((c) => c.name === techName);
    if (!chip) return;
    setTech(chip.id);
    filtersRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const clearFilters = () => {
    setTech(null);
    setSearchTerm("");
  };

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
            onClick={() => setTech(null)}
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
              name={project.name}
              description={project.description}
              gitRepo={project.gitRepo}
              technologies={project.technologies}
              activeTech={activeChip?.name}
              onTechClick={handleTagClick}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10">
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
