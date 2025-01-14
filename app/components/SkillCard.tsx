import { Box, Button, Typography } from "@mui/material";
import React from "react";

interface SkillCardProps {
    skill: string;
    icon: string;
    colors: string[];
    angle?: string;
}

const SkillCard: React.FC<SkillCardProps> = ({ skill = "None", icon, colors, angle = "45deg" }) => {
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
                bottom: 0,
                right: 0,
                width: "50%",
                height: "50%",

                transition: "transform 0.3s ease",
                zIndex: 1  // Add this
                }}
                
            >
                <img
                src={"/misc/mainslide/img1.png"}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
            </Box>
            <Box sx={{
                background: `linear-gradient(${angle}, ${colors.join(", ")})`,
                padding: 5,
                borderRadius: 4,
                height: "512px",
                position: "relative",
                display: "flex",
                flexDirection: "column"
            }}>
                <Typography variant="h2" sx={{
                    color: "white",
                    display: "block",
                    fontWeight: 100,
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
                        }
                    }}
                >
                    Learn More
                </Button>
            </Box>
        </Box>
    )
}

export default SkillCard;