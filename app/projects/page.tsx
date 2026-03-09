import { Metadata } from "next";
import { Suspense } from "react";
import ImageSlider from "../components/ImageSlider";
import ProjectSearch from "../components/ProjectSearch";
import { fetchProjectsForDisplay } from "../lib/data";

const images: string[] = [
  "/misc/mainslide/img5.png",
  "/misc/mainslide/img6.png",
  "/misc/mainslide/img7.png",
  "/misc/mainslide/img8.png",
];

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: "Projects",
    description: "A collection of software projects",
  };
};

interface ProjectsPageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function Projects({ searchParams }: ProjectsPageProps) {
  const { search } = await searchParams;
  let initialProjects: Awaited<ReturnType<typeof fetchProjectsForDisplay>> = [];
  try {
    initialProjects = await fetchProjectsForDisplay();
  } catch {
    // Fallback
  }
  const filtered = search
    ? initialProjects.filter((project) => {
        const searchLower = search.toLowerCase();
        return (
          project.name.toLowerCase().includes(searchLower) ||
          project.description.toLowerCase().includes(searchLower) ||
          project.technologies.some((tech) =>
            tech.toLowerCase().includes(searchLower),
          )
        );
      })
    : initialProjects;

  return (
    <div className="min-h-screen">
      {/* Hero with slider - same padding as home */}
      <section className="relative flex h-screen min-h-[500px] w-full flex-col justify-end">
        <ImageSlider imgs={images} />
        <div className="relative z-10 mx-auto w-full max-w-[1600px] px-8 pb-40 pt-28 sm:px-12 sm:pb-44 sm:pt-32 lg:px-20 lg:pb-52 lg:pt-40 pointer-events-none">
          <div className="max-w-2xl pointer-events-auto">
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent/90">
              Portfolio
            </p>
            <h1 className="mb-3 text-4xl font-bold leading-tight text-white drop-shadow-lg sm:text-5xl md:text-6xl">
              Projects
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-slate-300 drop-shadow sm:text-lg">
              A collection of programs and scripts that use a variety of
              languages and libraries. Each project is different and showcases
              my skills in software.
            </p>
          </div>
        </div>
      </section>

      {/* Project list */}
      <section className="border-t border-slate-800/80 bg-slate-950/50 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-8 lg:px-10">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              All projects
            </h2>
            <p className="mt-2 text-slate-400">
              Search by name, description, or technology.
            </p>
          </div>

          <Suspense fallback={<div className="py-12 text-slate-400">Loading...</div>}>
            <ProjectSearch
              initialProjects={filtered}
              initialSearch={search || ""}
            />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
