'use client';

import { Box, Button, Typography } from "@mui/material";
import React from "react";
import Image from 'next/image';

interface ProjectCardProps {
    name: string;
    description: string;
    image: string;
    gitRepo?: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ name, description, image, gitRepo }) => {
    const goToGitRepo = () => {
        if (gitRepo) {
            window.location.href = `https://github.com/areng14/${gitRepo}`;
        }
    }

    return (
        <Box
            sx={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 4,
                backgroundColor: "rgb(40, 46, 55)",
                height: "576px",
                display: "flex",
                flexDirection: "column"
            }}
        >
            {/* Image Container - Top 25% */}
            <Box
                sx={{
                    position: "relative",
                    width: "100%",
                    height: "50%",
                    overflow: "hidden"
                }}
            >
                <Image
                    src={image}
                    alt={name}
                    fill
                    style={{
                        objectFit: "cover",
                    }}
                />
            </Box>
            
            {/* Content Container - Bottom 75% */}
            <Box
                sx={{
                    padding: 5,
                    height: "75%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2
                }}
            >
                <Typography 
                    variant="h2" 
                    sx={{
                        color: "white",
                        fontWeight: 550,
                    }}
                >
                    {name.toUpperCase()}
                </Typography>
                <Typography sx={{ color: "white" }}>
                    {description}
                </Typography>
                {gitRepo && (
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
                        onClick={goToGitRepo}
                    >
                        View Repository
                    </Button>
                )}
            </Box>
        </Box>
    );
}

export default ProjectCard;