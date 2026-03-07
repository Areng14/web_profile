import ImageSlider from "./components/ImageSlider";
import SkillCard from "./components/SkillCard";
import { fetchPublicSkills } from "./lib/data";
import { SkillType } from "./lib/types";
import Link from "next/link";

export default async function Home() {
  const images = [
    "/misc/mainslide/img1.png",
    "/misc/mainslide/img2.png",
    "/misc/mainslide/img3.png",
    "/misc/mainslide/img4.png",
  ];

  let skillsByType: { type: SkillType; title: string; skills: Awaited<ReturnType<typeof fetchPublicSkills>> }[] = [];
  try {
    const allSkills = await fetchPublicSkills();
    const order = [SkillType.Lang, SkillType.Framework, SkillType.DesignTools];
    const titles: Record<SkillType, string> = {
      [SkillType.Lang]: "Languages",
      [SkillType.Framework]: "Frameworks",
      [SkillType.DesignTools]: "Design Tools",
    };
    skillsByType = order.map((type) => ({
      type,
      title: titles[type],
      skills: allSkills.filter((s) => s.skillType === type),
    }));
  } catch {
    // Fallback
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative flex h-screen min-h-[500px] w-full flex-col justify-end">
        <ImageSlider imgs={images} />
        {/* pointer-events-none so slider buttons receive clicks; restore on content */}
        <div className="relative z-10 mx-auto w-full max-w-[1600px] px-8 pb-40 pt-28 sm:px-12 sm:pb-44 sm:pt-32 lg:px-20 lg:pb-52 lg:pt-40 pointer-events-none">
          <div className="max-w-2xl pointer-events-auto">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-amber-400/90 sm:text-base">
              Software Developer
            </p>
            <h1 className="mb-4 text-4xl font-bold leading-tight text-white drop-shadow-lg sm:text-5xl md:text-6xl lg:text-7xl">
              Areng
              <br />
              <span className="text-slate-200">Teanpakdeeprasat</span>
            </h1>
            <p className="mb-8 max-w-lg text-base leading-relaxed text-slate-300 drop-shadow sm:text-lg">
              I build tools and apps in my free time—from the small and quirky to the genuinely useful.
              Clean code and readable projects matter to me.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/projects"
                className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#0a0b0c]"
              >
                View Projects
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center rounded-xl border border-slate-500/60 bg-white/5 px-6 py-3 text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:border-slate-400 hover:bg-white/10"
              >
                About Me
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="relative border-t border-slate-800/80 bg-slate-950/50 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center sm:mb-16">
            <h2 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">
              Skills & tools
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              Languages, frameworks, and design tools I use to ship projects.
            </p>
          </div>

          {skillsByType.map(({ type, title, skills }) => (
            <div key={type} className="mb-12 last:mb-0 lg:mb-16">
              <h3 className="mb-6 text-xl font-semibold text-slate-300 sm:text-2xl">
                {title}
              </h3>
              {skills.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {skills.map((s, index) => (
                    <SkillCard
                      key={s.id ?? index}
                      skill={s.skillName}
                      colors={s.gradientColor ?? []}
                      angle={`${s.gradientAngle ?? 45}deg`}
                      icon={s.icon}
                      iconangle={45}
                      endpoint={`/projects?search=${encodeURIComponent(s.skillName)}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-600/80 bg-slate-800/30 py-12">
                  <p className="text-slate-500">Coming soon</p>
                </div>
              )}
            </div>
          ))}

          <div className="mt-12 text-center">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/80"
            >
              See all projects
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
