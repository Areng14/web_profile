'use client';

import React from "react";
import { skills } from "../lib/content";

// Look up a technology's icon + brand color from the skills list
const skillByName: Record<string, { icon: string; color: string }> = {};
skills.forEach((s) => {
    skillByName[s.skillName.toLowerCase()] = {
        icon: s.icon,
        color: s.color ?? s.gradientColor?.[0] ?? "#94a3b8",
    };
});

// gitRepo can be a full URL, "owner/repo", or just a repo name under my account
const repoUrl = (gitRepo: string) =>
    gitRepo.startsWith("http")
        ? gitRepo
        : `https://github.com/${gitRepo.includes("/") ? gitRepo : `areng14/${gitRepo}`}`;

// Hard-stop gradient with one equal segment per color and a 2px gap between them
const languageBarGradient = (colors: string[]) => {
    const n = colors.length;
    const stops = colors.flatMap((c, i) => {
        const start = i === 0 ? "0%" : `calc(${(i / n) * 100}% + 1px)`;
        const end = i === n - 1 ? "100%" : `calc(${((i + 1) / n) * 100}% - 1px)`;
        const seg = [`${c} ${start}`, `${c} ${end}`];
        return i === n - 1 ? seg : [...seg, `transparent ${end}`, `transparent calc(${((i + 1) / n) * 100}% + 1px)`];
    });
    return `linear-gradient(90deg, ${stops.join(", ")})`;
};

interface ProjectCardProps {
    id: string;
    name: string;
    description: string;
    gitRepo?: string;
    hasUsers?: boolean;
    playUrl?: string;
    technologies?: string[];
    activeTech?: string;
    onTechClick?: (tech: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
    id,
    name,
    description,
    gitRepo,
    hasUsers,
    playUrl,
    technologies = [],
    activeTech,
    onTechClick,
}) => {
    // A playable version wins the card's main link; otherwise the repo
    const primaryLink = playUrl
        ? { href: playUrl, label: "Play in browser" }
        : gitRepo
            ? { href: repoUrl(gitRepo), label: "View repository" }
            : null;

    const barColors = technologies.length > 0
        ? technologies.map((tech) => skillByName[tech.toLowerCase()]?.color ?? "#475569")
        : ["#475569"];

    return (
        <div
            className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card-bg p-6 transition-colors duration-200 hover:border-white/20 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent"
            // Unique name lets filter changes animate this card to its new position
            style={{ viewTransitionName: `project-${id}` }}
        >
            {/* GitHub-style language bar, drawn as a curved top border: the border area is
                masked out of a hard-stop gradient so it follows the card's rounded corners.
                At rest the colors are squeezed into the first quarter; hover spreads them out. */}
            <span
                className="pointer-events-none absolute inset-0 rounded-[11px] border-t-4 border-transparent bg-no-repeat transition-[clip-path,background-size] duration-300 [background-size:25%_100%] [clip-path:inset(0_75%_0_0)] group-hover:[background-size:100%_100%] group-hover:[clip-path:inset(0)]"
                style={{
                    backgroundImage: languageBarGradient(barColors),
                    backgroundOrigin: "border-box",
                    WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
                    WebkitMaskComposite: "xor",
                    mask: "linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0)",
                }}
                aria-hidden
            />

            <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">{name}</h2>
                {hasUsers && (
                    <span className="relative z-10 text-emerald-400" title="Used by real people">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                            <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
                        </svg>
                        <span className="sr-only">Used by real people</span>
                    </span>
                )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>

            {technologies.length > 0 && (
                <ul className="mt-auto flex flex-wrap gap-2 pt-5">
                    {technologies.map((tech) => {
                        const skill = skillByName[tech.toLowerCase()];
                        const active = tech === activeTech;
                        return (
                            <li key={tech}>
                                {/* Sits above the card's stretched repo link so it stays clickable */}
                                <button
                                    type="button"
                                    onClick={() => onTechClick?.(tech)}
                                    title={`Show ${tech} projects`}
                                    className={`relative z-10 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                                        active
                                            ? "bg-white/[0.08] text-white ring-[var(--tag)]"
                                            : "bg-white/[0.04] text-slate-300 ring-transparent hover:bg-white/[0.1] hover:text-white"
                                    }`}
                                    style={{ ["--tag" as string]: skill?.color }}
                                >
                                    {skill && (
                                        <span
                                            className="block h-3.5 w-3.5"
                                            style={{
                                                backgroundColor: skill.color,
                                                WebkitMask: `url("${skill.icon}") center / contain no-repeat`,
                                                mask: `url("${skill.icon}") center / contain no-repeat`,
                                            }}
                                            aria-hidden
                                        />
                                    )}
                                    {tech}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className={`${technologies.length > 0 ? "" : "mt-auto "}flex items-center justify-between pt-5 text-sm`}>
                {primaryLink ? (
                    <>
                        {/* Stretched link: its ::after covers the whole card */}
                        <a
                            href={primaryLink.href}
                            className="font-medium text-slate-300 transition-colors after:absolute after:inset-0 after:content-[''] focus:outline-none group-hover:text-white"
                        >
                            {primaryLink.label}
                        </a>
                        <span className="flex items-center gap-3">
                            {playUrl && gitRepo && (
                                // Sits above the stretched link so it stays clickable
                                <a
                                    href={repoUrl(gitRepo)}
                                    className="relative z-10 text-slate-500 transition-colors hover:text-white"
                                >
                                    Repo
                                </a>
                            )}
                            <svg
                                className="h-5 w-5 -translate-x-1 text-slate-600 transition-all duration-200 group-hover:translate-x-0 group-hover:text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6l6 6-6 6" />
                            </svg>
                        </span>
                    </>
                ) : (
                    <span className="text-slate-600">No public repo</span>
                )}
            </div>
        </div>
    );
}

export default ProjectCard;
