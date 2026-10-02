"use client";

import React from "react";
import Link from "next/link";
import { selectProjectTech } from "./ProjectSearch";

interface SkillCardProps {
  skill: string;
  description?: string;
  icon: string;
  color: string;
  projectCount?: number;
  graveyardCount?: number;
  // When set, clicking the card filters the projects section to this skill
  techId?: string;
  // Otherwise, a page to link to (the graveyard, for skills with only retired projects)
  href?: string;
}

// Grayscale version of a hex color, using the same weights as CSS grayscale()
const toGray = (hex: string) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  if ([r, g, b].some(Number.isNaN)) return "#64748b";
  const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b).toString(16).padStart(2, "0");
  return `#${y}${y}${y}`;
};

const SkillCard: React.FC<SkillCardProps> = ({
  skill = "None",
  description,
  icon,
  color,
  projectCount,
  graveyardCount = 0,
  techId,
  href,
}) => {
  const clickable = Boolean(techId || href);
  // Only retired projects use this skill: on hover the icon and accent drain to grayscale
  const retired = projectCount === 0 && graveyardCount > 0;
  const imageSrc = !icon
    ? null
    : icon.startsWith("http") || icon.startsWith("data:") || icon.startsWith("/")
      ? icon
      : `/${icon}`;

  const plural = (n: number) => `${n} project${n === 1 ? "" : "s"}`;
  const countLabel =
    projectCount === undefined
      ? "Find projects"
      : projectCount > 0
        ? plural(projectCount) + (graveyardCount ? ` · ${graveyardCount} retired` : "")
        : graveyardCount > 0
          ? `${graveyardCount} retired project${graveyardCount === 1 ? "" : "s"}`
          : "No projects yet";

  const content = (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card-bg p-5 transition-colors duration-200 ${
        clickable ? `group ${retired ? "hover:border-[var(--skill-gray)]" : "hover:border-[var(--skill)]"}` : ""
      }`}
      style={{ ["--skill" as string]: color, ["--skill-gray" as string]: toGray(color) }}
    >
      {/* Accent bar drawn as a top border so it curves with the card's corners; revealed on hover */}
      <span
        className={`pointer-events-none absolute inset-0 rounded-[11px] border-t-[3px] border-t-[var(--skill)] transition-[clip-path,border-color] duration-300 [clip-path:inset(0_88%_0_0)] group-hover:[clip-path:inset(0)] ${
          retired ? "group-hover:border-t-[var(--skill-gray)]" : ""
        }`}
        aria-hidden
      />

      {/* Icon rendered as a flat silhouette in the brand color */}
      {imageSrc ? (
        <span
          className={`block h-10 w-10 bg-[var(--skill)] transition-colors duration-300 ${
            retired ? "group-hover:bg-[var(--skill-gray)]" : ""
          }`}
          style={{
            WebkitMask: `url("${imageSrc}") center / contain no-repeat`,
            mask: `url("${imageSrc}") center / contain no-repeat`,
          }}
          aria-hidden
        />
      ) : (
        <span className="block h-10 w-10 rounded-md" style={{ backgroundColor: color }} aria-hidden />
      )}

      <h3 className="mt-4 text-lg font-semibold text-white">{skill}</h3>
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{description}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <p className="text-sm text-slate-500">{countLabel}</p>
        {clickable && (
          <svg
            className="h-5 w-5 shrink-0 -translate-x-1 text-slate-600 transition-all duration-200 group-hover:translate-x-0 group-hover:text-white"
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

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {content}
      </Link>
    );
  }

  return content;
};

export default SkillCard;
