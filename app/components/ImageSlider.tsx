"use client";

import { useState, useEffect, useCallback } from "react";

interface ImageSliderProps {
  imgs: string[];
  autoFadeInterval?: number; // Time in milliseconds between transitions
}

export default function ImageSlider({ imgs, autoFadeInterval = 5000 }: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const transition = useCallback(() => {
    setFade(false);
    setTimeout(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === imgs.length - 1 ? 0 : prevIndex + 1
      );
      setFade(true);
    }, 300);
  }, [imgs.length]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setFade(false);
    setTimeout(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? imgs.length - 1 : prevIndex - 1
      );
      setFade(true);
    }, 300);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    transition();
  };

  // Auto-fade effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isAutoPlaying) {
      intervalId = setInterval(() => {
        transition();
      }, autoFadeInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoPlaying, transition, autoFadeInterval]);

  // Reset auto-play after user inactivity
  useEffect(() => {
    if (!isAutoPlaying) {
      const timeoutId = setTimeout(() => {
        setIsAutoPlaying(true);
      }, 10000); // Resume auto-play after 10 seconds of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [isAutoPlaying]);

  return (
    <>
      {/* Background layers in negative z-index */}
      <div className="absolute inset-0 -z-10 h-screen w-screen overflow-hidden">
        <div
          className={`h-screen w-screen bg-cover bg-center transition-opacity duration-300 ${
            fade ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${imgs[currentIndex]})` }}
        />
        <div className="absolute inset-0 h-screen w-screen bg-black/50" />
      </div>

      {/* Navigation Buttons in positive z-index */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <button
          type="button"
          onClick={handlePrev}
          className="pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          aria-label="Previous slide"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          aria-label="Next slide"
        >
          ›
        </button>
      </div>

      {/* Scroll Down Indicator */}
      <button
        type="button"
        className="absolute bottom-5 left-1/2 z-0 flex -translate-x-1/2 flex-col items-center animate-bounce cursor-pointer"
        onClick={() =>
          window.scrollTo({ top: window.innerHeight, behavior: "smooth" })
        }
      >
        <span className="mb-2 text-xs uppercase tracking-[0.2em] text-white">
          Scroll Down
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
          ↓
        </span>
      </button>
    </>
  );
}