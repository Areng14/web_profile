import { Metadata } from "next";
import Link from "next/link";
import ProjectCard from "../components/ProjectCard";
import { fetchProjectsForDisplay } from "../lib/data";

export const metadata: Metadata = {
  title: "Graveyard",
  description: "Older projects that were finished, replaced or left behind",
};

export default async function Graveyard() {
  const projects = (await fetchProjectsForDisplay()).filter((p) => p.graveyard);

  return (
    <div className="min-h-screen">
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-8 lg:px-10">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5m6 6-6-6 6-6" />
            </svg>
            Back to projects
          </Link>

          <div className="mb-12 mt-8 sm:mb-16">
            <h1 className="text-4xl font-bold text-white sm:text-5xl">Graveyard</h1>
            <p className="mt-3 max-w-xl text-slate-400">
              Older projects that were finished, replaced or left behind. Kept here for the record.
            </p>
          </div>

          {/* Faded and greyed out until hovered */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="opacity-60 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 focus-within:opacity-100 focus-within:grayscale-0"
              >
                <ProjectCard
                  id={project.id}
                  name={project.name}
                  description={project.description}
                  gitRepo={project.gitRepo}
                  hasUsers={project.hasUsers}
                  playUrl={project.playUrl}
                  technologies={project.technologies}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
