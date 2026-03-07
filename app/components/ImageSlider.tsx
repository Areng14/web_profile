"use client";

import { useState, useEffect, useCallback } from "react";

interface ImageSliderProps {
  imgs: string[];
  autoFadeInterval?: number;
}

export default function ImageSlider({ imgs, autoFadeInterval = 5000 }: ImageSliderProps) {
  const safeImgs = imgs?.length ? imgs : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const getPublicPath = (path: string) => (path?.startsWith("/") ? path : `/${path || ""}`);

  const transition = useCallback(() => {
    setFade(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev === safeImgs.length - 1 ? 0 : prev + 1));
      setFade(true);
    }, 300);
  }, [safeImgs.length]);

  const goTo = (index: number) => {
    setIsAutoPlaying(false);
    setFade(false);
    setTimeout(() => {
      setCurrentIndex(index);
      setFade(true);
    }, 300);
  };

  const handlePrev = () => goTo(currentIndex === 0 ? safeImgs.length - 1 : currentIndex - 1);
  const handleNext = () => goTo(currentIndex === safeImgs.length - 1 ? 0 : currentIndex + 1);

  useEffect(() => {
    if (!isAutoPlaying || safeImgs.length === 0) return;
    const id = setInterval(transition, autoFadeInterval);
    return () => clearInterval(id);
  }, [isAutoPlaying, transition, autoFadeInterval, safeImgs.length]);

  useEffect(() => {
    if (!isAutoPlaying) {
      const t = setTimeout(() => setIsAutoPlaying(true), 10000);
      return () => clearTimeout(t);
    }
  }, [isAutoPlaying]);

  if (safeImgs.length === 0) {
    return <div className="absolute inset-0 z-0 bg-slate-900" aria-hidden />;
  }

  const publicPath = getPublicPath(safeImgs[currentIndex]);

  return (
    <>
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
        {publicPath && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={publicPath}
            alt=""
            fetchPriority="high"
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${
              fade ? "opacity-100" : "opacity-0"
            }`}
            onError={(e) => console.error("Slider image failed to load:", publicPath, e)}
          />
        )}
        {/* Gradient overlay for readability: light at top, dark at bottom */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/75"
          aria-hidden
        />
      </div>

      {/* Slide dots */}
      {safeImgs.length > 1 && (
        <div className="absolute bottom-36 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-40">
          {safeImgs.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-8 bg-amber-500"
                  : "w-2 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}

      {/* Nav arrows - above hero content so they're clickable */}
      {safeImgs.length > 1 && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <button
            type="button"
            onClick={handlePrev}
            className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/60 md:left-6"
            aria-label="Previous slide"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/60 md:right-6"
            aria-label="Next slide"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Scroll cue */}
      <button
        type="button"
        className="absolute bottom-14 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-4 px-8 py-6 text-white/80 transition hover:text-white sm:bottom-16 sm:gap-5 sm:px-10 sm:py-7"
        onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
        aria-label="Scroll to content"
      >
        <span className="text-sm font-medium uppercase tracking-widest sm:text-base">Explore</span>
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/5 backdrop-blur-sm sm:h-14 sm:w-14">
          <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </span>
      </button>
    </>
  );
}
