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

interface ProjectCardProps {
    id: string;
    name: string;
    description: string;
    gitRepo?: string;
    technologies?: string[];
    activeTech?: string;
    onTechClick?: (tech: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
    id,
    name,
    description,
    gitRepo,
    technologies = [],
    activeTech,
    onTechClick,
}) => {
    const barColors = technologies.length > 0
        ? technologies.map((tech) => skillByName[tech.toLowerCase()]?.color ?? "#475569")
        : ["#475569"];

    return (
        <div
            className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card-bg p-6 transition-colors duration-200 hover:border-white/20 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent"
            // Unique name lets filter changes animate this card to its new position
            style={{ viewTransitionName: `project-${id}` }}
        >
            {/* GitHub-style language bar: one solid segment per technology, grows on hover */}
            <div
                className="absolute inset-x-0 top-0 flex h-1 origin-left scale-x-[0.25] gap-0.5 transition-transform duration-300 group-hover:scale-x-100"
                aria-hidden
            >
                {barColors.map((c, i) => (
                    <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
            </div>

            <h2 className="text-xl font-semibold text-white">{name}</h2>
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
                {gitRepo ? (
                    <>
                        {/* Stretched link: its ::after covers the whole card */}
                        <a
                            href={`https://github.com/areng14/${gitRepo}`}
                            className="font-medium text-slate-300 transition-colors after:absolute after:inset-0 after:content-[''] focus:outline-none group-hover:text-white"
                        >
                            View repository
                        </a>
                        <svg
                            className="h-5 w-5 -translate-x-1 text-slate-600 transition-all duration-200 group-hover:translate-x-0 group-hover:text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6l6 6-6 6" />
                        </svg>
                    </>
                ) : (
                    <span className="text-slate-600">No public repo</span>
                )}
            </div>
        </div>
    );
}

export default ProjectCard;
