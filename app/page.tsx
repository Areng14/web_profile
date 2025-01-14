import { Avatar, Box, Container, Grid2, Typography } from "@mui/material";
import { deepOrange } from "@mui/material/colors";
import ResponsiveAppBar from "./components/ResponsiveNavbar";
import { useState } from "react";
import ImageSlider from "./components/ImageSlider";
import SkillCard from "./components/SkillCard";

export default function Home() {

  const images = [
    "/misc/mainslide/img1.png",
    "/misc/mainslide/img2.png",
    "/misc/mainslide/img3.png",
    "/misc/mainslide/img4.png",
  ];

  return (
    <Box>
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center"}}>
        <ImageSlider imgs={images}/>
        <Container maxWidth={false} sx={{ maxWidth: "1600px", minWidth: {
          xs: "500px",
          md: "1600px",
        }}}>
          <Grid2
            container
            spacing={6}
            sx={{
              py: { xs: 4, md: 8 },
              alignItems: "center",
              px: 4,
            }}
          >
            {/* Text Content Section */}
            <Box>
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: "2rem", sm: "2.5rem", md: "5rem" },
                  mb: 5,
                  wordBreak: "break-word",
                  fontWeight: 700,
                }}
              >
                Areng
                <br />
                Teanpakdeeprasat
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "1rem", md: "1.1rem" },
                  maxWidth: { xs: "100%", md: "50%" },
                }}
              >
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua,
                facilitating seamless solutions for diverse clients.
              </Typography>
            </Box>
          </Grid2>
        </Container>
      </Box>

      {/* Skills */}
      <Box sx={{ paddingTop: 32 }}>
        <Container maxWidth={false} sx={{ maxWidth: "1600px"}}>       
            <Typography variant="h1" sx={{fontWeight: 700}}>
              Skills
            </Typography>
            <Grid2 container spacing={6} sx={{ paddingTop: 6 }}>
              {/* React */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="React"
                colors={["rgb(80, 179, 207)", "rgb(0, 98, 123)"]}
                angle="45deg"
                icon={"/misc/skills/react.svg"}
                iconangle={45}/>         
              </Grid2>
              {/* Python */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Python"
                colors={["rgb(22, 167, 105)", "rgb(17, 133, 159)", "rgb(6, 99, 198)"]}
                angle="45deg"
                icon={"/misc/skills/python.svg"}/>              
              </Grid2>
              {/* Javascript */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="JavaScript"
                colors={["rgb(210, 116, 1)", "rgb(202, 131, 0)", "rgb(186, 159, 2)"]}
                angle="45deg"
                icon={"/misc/skills/js.svg"}/>              
              </Grid2>
              {/* Java */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Java"
                colors={["rgb(1, 51, 79)","rgb(0, 116, 183)","rgb(72, 153, 188)"]}
                angle="45deg"
                icon={"/misc/skills/java.svg"}/>              
              </Grid2>
              {/* Swift */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Swift"
                colors={["rgb(212, 47, 39)", "rgb(209, 81, 49)", "rgb(212, 124, 0)"]}
                angle="45deg"
                icon={"/misc/skills/swift.svg"}/>              
              </Grid2>
            </Grid2>
        </Container>
      </Box>
    </Box>
  );
}