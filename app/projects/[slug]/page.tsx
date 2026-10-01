import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { skills } from "../../lib/content";
import { fetchProjectsForDisplay } from "../../lib/data";
import { projectDetails } from "../../lib/details";
import { repoUrl } from "../../lib/types";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

async function findProject(slug: string) {
  return (await fetchProjectsForDisplay()).find((p) => p.slug === slug);
}

// Build every project page at build time
export async function generateStaticParams() {
  return (await fetchProjectsForDisplay()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const project = await findProject((await params).slug);
  return project ? { title: project.name, description: project.description } : {};
}

const skillByName = Object.fromEntries(skills.map((s) => [s.skillName, s]));

export default async function ProjectPage({ params }: ProjectPageProps) {
  const project = await findProject((await params).slug);
  if (!project) notFound();

  const details = projectDetails[project.id];
  const backHref = project.graveyard ? "/cutting-room-floor" : "/#projects";
  const techSkills = project.technologies
    .map((name) => skillByName[name])
    .filter((s): s is (typeof skills)[number] => Boolean(s));
  const colorOf = (s: (typeof skills)[number]) => s.color ?? s.gradientColor?.[0] ?? "#94a3b8";

  return (
    <div className="min-h-screen">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-20">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5m6 6-6-6 6-6" />
          </svg>
          {project.graveyard ? "Back to the cutting room floor" : "Back to projects"}
        </Link>

        <header className="mt-8">
          {/* Same language bar as the project cards, at full width */}
          <div className="mb-6 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {(techSkills.length ? techSkills.map(colorOf) : ["#475569"]).map((c, i) => (
              <span key={i} className="flex-1" style={{ backgroundColor: c }} />
            ))}
          </div>

          {project.graveyard && (
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-slate-500">
              On the cutting room floor
            </p>
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-white sm:text-5xl">{project.name}</h1>
            {project.hasUsers && (
              <span className="text-emerald-400" title="Used by real people">
                <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                  <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
                </svg>
                <span className="sr-only">Used by real people</span>
              </span>
            )}
          </div>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">{project.description}</p>

          {project.causeOfDeath && (
            <p className="mt-4 text-slate-500">
              <span className="font-medium text-slate-400">Cause of death:</span> {project.causeOfDeath}
            </p>
          )}

          {(project.playUrl || project.gitRepo) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {project.playUrl && (
                <a
                  href={project.playUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
                >
                  Play in browser
                </a>
              )}
              {project.gitRepo && (
                <a
                  href={repoUrl(project.gitRepo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-card-bg px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white"
                >
                  View repository
                </a>
              )}
            </div>
          )}

          {techSkills.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {techSkills.map((s) => (
                <li key={s.id}>
                  <Link
                    href={project.graveyard ? `/cutting-room-floor?tech=${s.id}` : `/?tech=${s.id}#projects`}
                    title={`More ${s.skillName} projects`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2.5 py-1 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white"
                  >
                    <span
                      className="block h-4 w-4"
                      style={{
                        backgroundColor: colorOf(s),
                        WebkitMask: `url("${s.icon}") center / contain no-repeat`,
                        mask: `url("${s.icon}") center / contain no-repeat`,
                      }}
                      aria-hidden
                    />
                    {s.skillName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        {details?.stats && (
          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
            {details.stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-card-bg p-4">
                <dt className="text-xs uppercase tracking-wider text-slate-500">{stat.label}</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {details?.sections.map((section, i) => (
          <section key={i} className="mt-10">
            {section.title && <h2 className="mb-3 text-2xl font-bold text-white">{section.title}</h2>}
            <div className="space-y-4 leading-relaxed text-slate-300">
              {section.body.map((block, j) =>
                typeof block === "string" ? (
                  <p key={j}>{block}</p>
                ) : (
                  <ul key={j} className="list-disc space-y-1.5 pl-5 marker:text-slate-600">
                    {block.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}

        {details?.tech && (
          <section className="mt-12 border-t border-white/[0.06] pt-8">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-slate-400">Built with</h2>
            <ul className="flex flex-wrap gap-2">
              {details.tech.map((t) => (
                <li key={t} className="rounded-md border border-white/[0.06] bg-card-bg px-2.5 py-1 text-sm text-slate-300">
                  {t}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}
