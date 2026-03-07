import { Metadata } from "next";
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
    // Fallback: empty list
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
    <div>
      <section className="relative flex min-h-screen items-center">
        <ImageSlider imgs={images} />
        <div className="z-10 mx-auto flex w-full max-w-[1600px] px-4 py-8">
          <div className="max-w-xl space-y-6">
            <h1 className="break-words text-4xl font-bold md:text-5xl">
              Projects
            </h1>
            <p className="max-w-[60%] text-sm text-slate-200 md:max-w-[50%] md:text-base">
              A collection of programs and scripts that use a variety of
              languages and libraries. Each project is different and showcases
              my skills in software.
            </p>
          </div>
        </div>
      </section>

      {/* Project List */}
      <section className="pt-16">
        <div className="mx-auto max-w-[1600px] px-4">
          <h2 className="pb-4 text-4xl font-bold sm:text-6xl">Projects</h2>

          <ProjectSearch
            initialProjects={filtered}
            initialSearch={search || ""}
          />
        </div>
      </section>
    </div>
  );
}

