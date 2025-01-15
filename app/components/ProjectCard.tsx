'use client';

import { Box, Button, Typography, Tooltip } from "@mui/material";
import React from "react";
import Image from 'next/image';

// Technology tags mapping
const techLogos: { [key: string]: string } = {
    // Languages
    "Python": "/misc/skills/monochrome/python.svg",
    "JavaScript": "/misc/skills/monochrome/js.svg",
    "JS": "/misc/skills/monochrome/js.svg",
    "TypeScript": "/misc/skills/monochrome/ts.svg",
    "TS": "/misc/skills/monochrome/ts.svg",
    "Java": "/misc/skills/monochrome/java.svg",
    "Swift": "/misc/skills/monochrome/swift.svg",
    
    // Frameworks
    "React": "/misc/skills/monochrome/react.svg",
    "Electron": "/misc/skills/monochrome/electron.svg",
    "Node.js": "/misc/skills/monochrome/nodejs.svg",
    "NodeJS": "/misc/skills/monochrome/nodejs.svg",
    "Node": "/misc/skills/monochrome/nodejs.svg",
    "Next.js": "/misc/skills/monochrome/nextjs.svg",
    "NextJS": "/misc/skills/monochrome/nextjs.svg",
    "Next": "/misc/skills/monochrome/nextjs.svg",
};

interface ProjectCardProps {
    name: string;
    description: string;
    image?: string;
    gitRepo?: string;
    gradientColors?: string[];
    gradientAngle?: number;
    technologies?: string[]; // Now just accepts technology names
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
    name, 
    description, 
    image, 
    gitRepo,
    gradientColors,
    gradientAngle = 45,
    technologies = []
}) => {
    const goToGitRepo = () => {
        if (gitRepo) {
            window.location.href = `https://github.com/areng14/${gitRepo}`;
        }
    }

    const backgroundStyle = gradientColors ? {
        background: `linear-gradient(${gradientAngle}deg, ${gradientColors.join(', ')})`
    } : {};

    return (
        <Box
            sx={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 4,
                width: "100%", 
                maxWidth: "100%",
                backgroundColor: "rgb(40, 46, 55)",
                height: {
                    xs: "896px",
                    sm: "576px"
                },
                display: "flex",
                flexDirection: "column"
            }}
        >
            {/* Image/Gradient Container - Top 50% */}
            <Box
                sx={{
                    position: "relative",
                    width: "100%",
                    height: "50%",
                    overflow: "hidden",
                    ...backgroundStyle
                }}
            >
                {!gradientColors && image && (
                    <Image
                        src={image}
                        alt={name}
                        fill
                        style={{
                            objectFit: "cover",
                        }}
                    />
                )}
                {/* Tags Container */}
                {technologies.length > 0 && (
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: 16,
                            right: 16,
                            display: "flex",
                            gap: 2,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                            maxWidth: "70%"
                        }}
                    >
                        {technologies.map((tech, index) => (
                            techLogos[tech] && (
                                <Tooltip 
                                    key={index}
                                    title={tech}
                                    placement="top"
                                    arrow
                                >
                                    <Box
                                        sx={{
                                            position: "relative",
                                            width: 40,
                                            height: 40,
                                            borderRadius: "50%",
                                            overflow: "hidden",
                                            backgroundColor: "rgb(220, 222, 231)",
                                            padding: "6px",
                                            transition: "transform 0.2s ease-in-out",
                                            "&:hover": {
                                                transform: "scale(1.1)",
                                                cursor: "pointer"
                                            }
                                        }}
                                    >
                                        <Image
                                            src={techLogos[tech]}
                                            alt={tech}
                                            fill
                                            style={{
                                                objectFit: "contain",
                                                padding: "6px"
                                            }}
                                        />
                                    </Box>
                                </Tooltip>
                            )
                        ))}
                    </Box>
                )}
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