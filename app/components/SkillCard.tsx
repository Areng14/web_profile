"use client";

import React from "react";
import { selectProjectTech } from "./ProjectSearch";

interface SkillCardProps {
  skill: string;
  description?: string;
  icon: string;
  color: string;
  projectCount?: number;
  // When set, clicking the card filters the projects section to this skill
  techId?: string;
}

const SkillCard: React.FC<SkillCardProps> = ({
  skill = "None",
  description,
  icon,
  color,
  projectCount,
  techId,
}) => {
  const imageSrc = !icon
    ? null
    : icon.startsWith("http") || icon.startsWith("data:") || icon.startsWith("/")
      ? icon
      : `/${icon}`;

  const countLabel =
    projectCount === undefined
      ? "Find projects"
      : projectCount === 0
        ? "No projects yet"
        : `${projectCount} project${projectCount === 1 ? "" : "s"}`;

  const content = (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card-bg p-4 transition-colors duration-200 ${
        techId ? "group hover:border-[var(--skill)]" : ""
      }`}
      style={{ ["--skill" as string]: color }}
    >
      {/* Solid accent bar, grows on hover */}
      <span
        className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-[0.12] transition-transform duration-300 group-hover:scale-x-100"
        style={{ backgroundColor: color }}
        aria-hidden
      />

      {/* Icon (flat silhouette in the brand color) sits inline with the name */}
      <div className="flex items-center gap-2.5">
        {imageSrc ? (
          <span
            className="block h-6 w-6 shrink-0"
            style={{
              backgroundColor: color,
              WebkitMask: `url("${imageSrc}") center / contain no-repeat`,
              mask: `url("${imageSrc}") center / contain no-repeat`,
            }}
            aria-hidden
          />
        ) : (
          <span className="block h-6 w-6 shrink-0 rounded" style={{ backgroundColor: color }} aria-hidden />
        )}
        <h3 className="text-base font-semibold text-white">{skill}</h3>
      </div>
      {description && (
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{description}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
        <p className="text-xs text-slate-500">{countLabel}</p>
        {techId && (
          <svg
            className="h-4 w-4 shrink-0 -translate-x-1 text-slate-600 transition-all duration-200 group-hover:translate-x-0 group-hover:text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6l6 6-6 6" />
          </svg>
        )}
      </div>
    </div>
  );

  if (techId) {
    return (
      <button
        type="button"
        onClick={() => selectProjectTech(techId)}
        className="block h-full w-full rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {content}
      </button>
    );
  }

  return content;
};

export default SkillCard;
