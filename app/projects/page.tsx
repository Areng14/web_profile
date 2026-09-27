import { redirect } from "next/navigation";

// Projects now live on the home page; keep old links (and their filters) working
interface ProjectsPageProps {
  searchParams: Promise<{ tech?: string; search?: string }>;
}

export default async function Projects({ searchParams }: ProjectsPageProps) {
  const { tech, search } = await searchParams;
  const params = new URLSearchParams();
  if (tech) params.set("tech", tech);
  if (search) params.set("search", search);
  const qs = params.toString();
  redirect(`/${qs ? `?${qs}` : ""}#projects`);
}
