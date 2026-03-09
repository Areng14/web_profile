"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

interface SkillCardProps {
  skill: string;
  icon: string;
  iconangle?: number;
  colors: string[];
  angle?: string;
  endpoint?: string;
}

const SkillCard: React.FC<SkillCardProps> = ({
  skill = "None",
  icon,
  colors,
  angle = "45deg",
  iconangle = 0,
  endpoint,
}) => {
  const imageSrc = !icon
    ? null
    : icon.startsWith("http")
      ? icon
      : icon.startsWith("/")
        ? icon
        : `/${icon.replace(/^\//, "")}`;

  const content = (
    <div
      className="group relative flex h-[280px] flex-col overflow-hidden rounded-2xl border border-white/5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:h-[320px]"
      style={{
        background: `linear-gradient(${angle}, ${colors.join(", ")})`,
      }}
    >
      <div
        className="absolute bottom-2 right-2 h-2/3 w-2/3 opacity-90 transition-transform duration-300 group-hover:scale-105"
        style={{ transform: `rotate(${iconangle}deg)` }}
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            width={400}
            height={400}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="h-full w-full rounded bg-white/10" aria-hidden />
        )}
      </div>
      <div className="relative flex flex-1 flex-col p-5">
        <h3 className="text-xl font-semibold text-white drop-shadow sm:text-2xl">
          {skill}
        </h3>
        <div className="mt-auto pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/30 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition group-hover:bg-black/40">
            Find projects
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );

  if (endpoint) {
    return (
      <Link href={endpoint} className="block focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
};

export default SkillCard;
