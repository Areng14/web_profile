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
      <Box sx={{ paddingTop: 4 }}>
        <Container maxWidth={false} sx={{ maxWidth: "1600px"}}>       
            <Typography variant="h1">
              Skills
            </Typography>
            <Grid2 container spacing={6} sx={{ paddingTop: 4 }}>
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard skill="React" colors={["#61DAFB", "#0093B7"]} angle="45deg" icon={""}/>              
              </Grid2>
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard skill="React" colors={['rgb(255, 161, 54)', 'rgb(169, 64, 35)']} angle="45deg" icon={""}/>              
              </Grid2>
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard skill="React" colors={['rgb(255, 161, 54)', 'rgb(169, 64, 35)']} angle="45deg" icon={""}/>              
              </Grid2>
            </Grid2>
        </Container>
      </Box>
    </Box>
  );
}