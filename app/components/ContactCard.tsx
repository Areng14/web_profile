'use client';

import { Box, Button, Typography } from "@mui/material";
import React from "react";
import Image from "next/image";

interface ContactCardProps {
  name: string;
  description: string;
  icon: string;
  href: string;
  gradientColors?: string[];
  gradientAngle?: number;
}

const ContactCard: React.FC<ContactCardProps> = ({
  name,
  description,
  icon,
  href,
  gradientColors = ["#1d2025", "#292d33"], // Default fallback gradient
  gradientAngle = 45,
}) => {
  const backgroundStyle = {
    background: `linear-gradient(${gradientAngle}deg, ${gradientColors.join(', ')})`,
  };

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 4,
        width: "100%",
        maxWidth: "100%",
        backgroundColor: "rgb(29, 32, 37)",
        height: {
          xs: "auto", // Adjust height for better responsiveness
          sm: "576px",
        },
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Image/Gradient Container */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "50%",
          ...backgroundStyle,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Icon Section */}
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgb(220, 222, 231)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Image src={icon} alt={name} width={80} height={80} />
        </Box>
      </Box>

      {/* Content Container */}
      <Box
        sx={{
          padding: 3,
          height: "50%",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            color: "white",
            fontWeight: 550,
          }}
        >
          {name.toUpperCase()}
        </Typography>
        <Typography sx={{ color: "white", flex: 1 }}>{description}</Typography>
        <Button
          variant="contained"
          sx={{
            fontSize: "1rem",
            padding: "10px 20px",
            borderRadius: 3,
            backgroundColor: "rgb(12, 13, 15)",
            color: "rgb(227, 238, 255)",
            "&:hover": {
              backgroundColor: "rgb(31, 33, 38)",
              color: "rgb(162, 169, 180)",
            },
            alignSelf: "start", // Proper alignment for the button
          }}
          href={href}
        >
          Contact
        </Button>
      </Box>
    </Box>
  );
};

export default ContactCard;
