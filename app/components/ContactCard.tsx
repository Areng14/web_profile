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
        height: "382px", // Fixed height for all breakpoints
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgb(29, 32, 37)",
        borderRadius: 4,
      }}
    >
      {/* Image/Gradient Container */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "96px",
          background: `linear-gradient(${gradientAngle}deg, ${gradientColors.join(', ')})`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          borderTopLeftRadius: 'inherit',
          borderTopRightRadius: 'inherit',
          flexShrink: 0,
        }}
      >
        {/* Icon Section */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: 16,
            width: 56,
            height: 56,
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
              style={{ objectFit: "contain" }}
            />
          ) : (
            <Typography sx={{ color: "rgb(150, 150, 150)" }}>No Icon</Typography>
          )}
        </Box>
      </Box>

      {/* Content Container */}
      <Box
        sx={{
          padding: 3,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "inherit",
          borderBottomLeftRadius: 'inherit',
          borderBottomRightRadius: 'inherit',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            color: "white",
            fontWeight: 550,
            mb: 2,
          }}
        >
          {name.toUpperCase()}
        </Typography>
        <Typography 
          sx={{ 
            color: "white", 
            flex: 1,
            fontSize: "0.9rem",
            overflow: "hidden",
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 4, // Limit to 4 lines
            textOverflow: 'ellipsis',
          }}
        >
          {description}
        </Typography>
        <Button
          variant="contained"
          size="small"
          sx={{
            fontSize: "0.9rem",
            padding: "8px 16px",
            borderRadius: 3,
            backgroundColor: "rgb(12, 13, 15)",
            color: "rgb(227, 238, 255)",
            marginTop: 2,
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