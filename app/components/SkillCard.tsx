'use client';

import { Box, Button, Typography } from "@mui/material";
import React from "react";

interface SkillCardProps {
    skill: string;
    icon: string;
    iconangle?: number;
    colors: string[];
    angle?: string;
    endpoint?: string;
}

const SkillCard: React.FC<SkillCardProps> = ({ skill = "None", icon, colors, angle = "45deg", iconangle=0, endpoint}) => {
    
    const goToEndpoint = (endpoint: string) => {
        window.location.href = endpoint;
    }

    return (
        <Box
        sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 4,
          }}>
            <Box
                sx={{
                    position: "absolute",
                    bottom: "8px",
                    right: "8px",
                    width: "75%",
                    height: "75%",
                    transition: "transform 0.3s ease",
                    transform: `rotate(${iconangle}deg)`, // Fixed rotation
                    zIndex: 1
                }}
            >
                <img
                src={icon}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
            </Box>
            <Box sx={{
                background: `linear-gradient(${angle}, ${colors.join(", ")})`,
                padding: 5,
                borderRadius: 4,
                height: "576px",
                position: "relative",
                display: "flex",
                flexDirection: "column"
            }}>
                <Typography variant="h2" sx={{
                    color: "white",
                    display: "block",
                    fontWeight: 550,
                }}>
                    {skill.toUpperCase()}
                </Typography>
                <Button 
                    variant="contained" 
                    sx={{ 
                        backgroundColor: "white", 
                        color: "black",
                        position: "absolute",
                        bottom: "32px",
                        "&:hover": {
                            backgroundColor: "#f5f5f5"
                        },
                        zIndex: 1
                    }}
                    onClick={() => goToEndpoint(endpoint)}
                >
                    Learn More
                </Button>
            </Box>
        </Box>
    )
}

export default SkillCard;