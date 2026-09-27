"use client";

import React from "react";
import Link from "next/link";

interface SkillCardProps {
  skill: string;
  icon: string;
  color: string;
  projectCount?: number;
  endpoint?: string;
}

const SkillCard: React.FC<SkillCardProps> = ({
  skill = "None",
  icon,
  color,
  projectCount,
  endpoint,
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
      className="group relative flex h-[168px] flex-col justify-between overflow-hidden rounded-xl border border-white/[0.06] bg-card-bg p-5 transition-colors duration-200 hover:border-[var(--skill)]"
      style={{ ["--skill" as string]: color }}
    >
      {/* Solid accent bar, grows on hover */}
      <span
        className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-[0.12] transition-transform duration-300 group-hover:scale-x-100"
        style={{ backgroundColor: color }}
        aria-hidden
      />

      {/* Icon rendered as a flat silhouette in the brand color */}
      {imageSrc ? (
        <span
          className="block h-10 w-10"
          style={{
            backgroundColor: color,
            WebkitMask: `url("${imageSrc}") center / contain no-repeat`,
            mask: `url("${imageSrc}") center / contain no-repeat`,
          }}
          aria-hidden
        />
      ) : (
        <span className="block h-10 w-10 rounded-md" style={{ backgroundColor: color }} aria-hidden />
      )}

      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{skill}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{countLabel}</p>
        </div>
        <svg
          className="h-5 w-5 shrink-0 -translate-x-1 text-slate-600 transition-all duration-200 group-hover:translate-x-0 group-hover:text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6l6 6-6 6" />
        </svg>
      </div>
    </div>
  );

  if (endpoint) {
    return (
      <Link
        href={endpoint}
        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {content}
      </Link>
    );
  }

  return content;
};

export default SkillCard;
