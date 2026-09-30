import { Metadata } from "next";
import Link from "next/link";
import ProjectSearch from "../components/ProjectSearch";
import TombstoneIcon from "../components/TombstoneIcon";
import { fetchProjectsForDisplay } from "../lib/data";

export const metadata: Metadata = {
  title: "Cutting Room Floor",
  description: "Older projects that were finished, replaced or left behind",
};

interface CuttingRoomFloorProps {
  searchParams: Promise<{ tech?: string; search?: string }>;
}

export default async function CuttingRoomFloor({ searchParams }: CuttingRoomFloorProps) {
  const { tech, search } = await searchParams;
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

          {/* Centered like the home page's section headers */}
          <div className="mb-12 mt-6 text-center sm:mb-16">
            <TombstoneIcon className="mx-auto h-10 w-10 text-slate-500" />
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl md:text-5xl">Cutting Room Floor</h1>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              Older projects that were finished, replaced or left behind. Kept here for the record.
            </p>
          </div>

          {/* Same search and filter chips as the home page, with the cards faded until hovered */}
          <ProjectSearch
            projects={projects}
            initialTech={tech ?? null}
            initialSearch={search ?? ""}
            faded
          />
        </div>
      </section>
    </div>
  );
}
