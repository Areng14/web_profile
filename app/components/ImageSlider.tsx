"use client";

import { useState } from "react";
import { Box, IconButton } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

interface ImageSliderProps {
  imgs: string[];
}

export default function ImageSlider({ imgs }: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  const handlePrev = () => {
    setFade(false);
    setTimeout(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? imgs.length - 1 : prevIndex - 1
      );
      setFade(true);
    }, 300);
  };

  const handleNext = () => {
    setFade(false);
    setTimeout(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === imgs.length - 1 ? 0 : prevIndex + 1
      );
      setFade(true);
    }, 300);
  };

  return (
    <>
      {/* Background layers in negative z-index */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          zIndex: -2,
        }}
      >
        {/* Current Image */}
        <Box
          component="div"
          sx={{
            width: "100vw",
            height: "100vh",
            backgroundImage: `url(${imgs[currentIndex]})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            transition: "opacity 0.3s ease-in-out",
            opacity: fade ? 1 : 0,
          }}
        />
        
        {/* Overlay */}
        <Box
          component="div"
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        />
      </Box>

      {/* Navigation Buttons in positive z-index */}
      {/* Navigation Buttons in positive z-index */}
    <Box
    sx={{
        position: "absolute", // Changed from fixed to absolute
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: "none",
    }}
    >
    <IconButton
        onClick={handlePrev}
        sx={{
        position: "absolute",
        left: "10px",
        top: "50%",
        transform: "translateY(-50%)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        color: "white",
        "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.7)" },
        pointerEvents: "auto",
        }}
    >
        <ArrowBackIosNewIcon />
    </IconButton>
    <IconButton
        onClick={handleNext}
        sx={{
        position: "absolute",
        right: "10px",
        top: "50%",
        transform: "translateY(-50%)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        color: "white",
        "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.7)" },
        pointerEvents: "auto",
        }}
    >
        <ArrowForwardIosIcon />
    </IconButton>
    </Box>
    </>
  );
}