'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from "react";
import { getProjects, type Project } from '../projects/getProjects';
import ProjectCard from "../components/ProjectCard";

const temp_projects = getProjects();

interface ProjectSearchProps {
  initialProjects: Project[];
  initialSearch: string;
}

export default function ProjectSearch({ 
  initialProjects,
  initialSearch 
}: ProjectSearchProps): JSX.Element {
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(initialProjects);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If there's a search query in the URL, scroll the search box into view
    if (searchParams.get('search')) {
      searchBoxRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchParams]);

  const filterProjects = (term: string): void => {
    if (!term) {
      setFilteredProjects(temp_projects);
      return;
    }

    const searchLower = term.toLowerCase();
    const filtered = temp_projects.filter(project => 
      project.name.toLowerCase().includes(searchLower) ||
      project.description.toLowerCase().includes(searchLower) ||
      project.technologies.some(tech => 
        tech.toLowerCase().includes(searchLower)
      )
    );
    setFilteredProjects(filtered);
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setSearchTerm(value);
    filterProjects(value);
  };

  return (
    <>
      <div ref={searchBoxRef} className="mb-4 w-full">
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
            placeholder="Search projects by name, description, or technology..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full rounded-md border border-slate-700 bg-[#0c0d0f] py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="grid gap-4 pt-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <div key={project.id}>
              <ProjectCard
                name={project.name}
                description={project.description}
                gradientColors={project.gradientColors}
                gradientAngle={project.gradientAngle}
                {...(project.gitRepo ? { gitRepo: project.gitRepo } : {})}
                technologies={project.technologies}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-xl text-slate-400">
          <h3 className="text-3xl font-bold text-white sm:text-4xl">
            No projects found
          </h3>
        </div>
      )}
    </>
  );
}