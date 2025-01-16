'use client';

import { Box, Button, Typography } from "@mui/material";
import React from "react";
import Image from 'next/image'

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
                    transform: `rotate(${iconangle}deg)`,
                    zIndex: 1
                }}
            >
                <Image
                src={icon}
                alt=""
                width={500} // Replace 500 with your desired width
                height={500} // Replace 500 with your desired height
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                }}
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
                        position: "absolute",
                        bottom: "36px",
                        fontSize: "1.25rem",
                        padding: "12px 24px",
                        borderRadius: 3,
                        "&:hover": {
                            backgroundColor: "rgb(31, 33, 38)",
                            color: "rgb(162, 169, 180)",
                        },
                        backgroundColor: "rgb(12, 13, 15)",
                        color: "rgb(227, 238, 255)",
                        zIndex: 1
                    }}
                    href={endpoint}
                >
                    Find Projects
                </Button>
            </Box>
        </Box>
    )
}

export default SkillCard;