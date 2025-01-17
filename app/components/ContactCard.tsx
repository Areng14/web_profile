'use client';

import { Box, Button, Typography } from "@mui/material";
import React, { ReactElement } from "react";
import Image from "next/image";

interface ContactCardProps {
  name: string;
  description: string;
  icon?: ReactElement;
  iconImage?: string;
  href: string;
  gradientColors?: string[];
  gradientAngle?: number;
}

const ContactCard: React.FC<ContactCardProps> = ({
  name,
  description,
  icon,
  iconImage,
  href,
  gradientColors = ["#1d2025", "#292d33"],
  gradientAngle = 45,
}) => {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        maxWidth: "100%",
        height: {
          xs: "auto",
          sm: "300px", // Reduced from 576px
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
          height: "80px", // Reduced from 96px
          background: `linear-gradient(${gradientAngle}deg, ${gradientColors.join(', ')})`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        {/* Icon Section */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: 16,
            width: 56,  // Slightly reduced from 64
            height: 56, // Slightly reduced from 64
            borderRadius: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          {icon ? (
            icon
          ) : iconImage ? (
            <Image
              src={iconImage}
              alt={name}
              width={48}
              height={48}
            />
          ) : (
            <Typography sx={{ color: "rgb(150, 150, 150)" }}>No Icon</Typography>
          )}
        </Box>
      </Box>

      {/* Content Container */}
      <Box
        sx={{
          padding: 2.5, // Reduced from 3
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1.5, // Reduced from 2
          backgroundColor: "rgb(29, 32, 37)",
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
        }}
      >
        <Typography
          variant="h6" // Changed from h5 to h6
          sx={{
            color: "white",
            fontWeight: 550,
          }}
        >
          {name.toUpperCase()}
        </Typography>
        <Typography 
          sx={{ 
            color: "white", 
            flex: 1,
            overflow: "auto",
            fontSize: "0.9rem", // Slightly smaller font
            marginBottom: 1
          }}
        >
          {description}
        </Typography>
        <Button
          variant="contained"
          size="small" // Changed from default to small
          sx={{
            fontSize: "0.9rem",
            padding: "8px 16px", // Reduced padding
            borderRadius: 3,
            backgroundColor: "rgb(12, 13, 15)",
            color: "rgb(227, 238, 255)",
            "&:hover": {
              backgroundColor: "rgb(31, 33, 38)",
              color: "rgb(162, 169, 180)",
            },
            alignSelf: "start",
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