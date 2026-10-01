"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectImage } from "../lib/details";

// Project screenshots: the first large, the rest two-up underneath. Clicking one
// opens a full-screen viewer (a modal <dialog>) with arrow keys, Esc and a counter.
export default function ImageGallery({ images }: { images: ProjectImage[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };
  const close = useCallback(() => dialogRef.current?.close(), []);
  const step = useCallback(
    (by: number) => setIndex((i) => (i === null ? i : (i + by + images.length) % images.length)),
    [images.length],
  );

  // Arrow keys move between images while the viewer is open (Esc is the dialog's own)
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  // Keep the page behind from scrolling while the viewer is open
  useEffect(() => {
    document.documentElement.style.overflow = index === null ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [index]);

  const current = index === null ? null : images[index];
  const navButton =
    "absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => open(i)}
            title="View larger"
            className={`group/img relative block cursor-zoom-in overflow-hidden rounded-xl border border-white/[0.06] bg-card-bg transition-colors hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              i === 0 ? "col-span-2" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.alt}
              loading={i === 0 ? "eager" : "lazy"}
              className={`w-full transition-transform duration-300 group-hover/img:scale-[1.02] ${
                i === 0 ? "h-auto" : "aspect-[16/10] object-cover"
              }`}
            />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setIndex(null)}
        // A click on the backdrop (the dialog itself, not its contents) closes it
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/85 backdrop:backdrop-blur-sm"
        aria-label="Screenshot viewer"
      >
        {current && (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-4 p-4 sm:p-10"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.src}
              src={current.src}
              alt={current.alt}
              className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <div className="flex max-w-3xl items-center gap-3 text-center text-sm text-slate-300">
              {images.length > 1 && (
                <span className="shrink-0 tabular-nums text-slate-500">
                  {(index ?? 0) + 1} / {images.length}
                </span>
              )}
              <span>{current.alt}</span>
            </div>

            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>

            {images.length > 1 && (
              <>
                <button type="button" onClick={() => step(-1)} aria-label="Previous screenshot" className={`${navButton} left-4`}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Next screenshot" className={`${navButton} right-4`}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
