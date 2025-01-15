import { Box, Container, Grid2, Typography } from "@mui/material";
import ImageSlider from "../components/ImageSlider";
import ProjectCard from "../components/ProjectCard";

export default function Projects() {

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
                Projects
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "1rem", md: "1.1rem" },
                  maxWidth: { xs: "100%", md: "50%" },
                }}
              >
                {/* TODO: Write projects */}
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua,
                facilitating seamless solutions for diverse clients.              
              </Typography>
            </Box>
          </Grid2>
        </Container>
      </Box>

      {/* Project List */}
      <Box sx={{ paddingTop: 16}}>
        <Container maxWidth={false} sx={{ maxWidth: "1600px"}}>       
            <Typography variant="h1" sx={{fontWeight: 700}}>
              Projects
            </Typography>
            <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
              {/* BeemodPackageEditor */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <ProjectCard
                name={"BPE"}
                description={
                  "Beemod Package Editor is a python program that allows users to create and edit packages for BEEMOD, a puzzlemaker mod for Portal 2. BPE v3 allows users to use plugins to extend the functionality of the program."}
                image={"/misc/projects/bpe.png"}
                gitRepo="BeePackageEditor"/>              
              </Grid2>
              {/* TestRunner */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <ProjectCard
                name={"TR"}
                description={
                  "TestRunner is built for testing multiple scripts at a time. Designed for teachers to use to mass grade student assignments. Includes a warning if the script uses weird imports."}
                image={"/misc/projects/testrunner.png"}
                gitRepo="testrunner"/>              
              </Grid2>
              {/* Blank */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <ProjectCard
                name={"Blank"}
                description={
                  "A image format using only whitespace. [SPACE][TAB][SPACE][TAB][SPACE][TAB] Each increment of whitespace corresponds to an increment in the RGB values. A newline signifies to move on to the next row."}
                gradientColors={["rgb(48, 98, 234)","rgb(69, 236, 255)"]}
                gradientAngle={45}
                gitRepo="blank"/>              
              </Grid2>
              {/* SCR ATO */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <ProjectCard
                name={"SCR ATO"}
                description={
                  "An macro program that automates the driving of trains in Stepford County Railway. The script uses OCR to read the information on the HUD which the program decides what to press."}
                image={"/misc/projects/scrato.png"}
                gitRepo="scr-ato"/>              
              </Grid2>
              {/* WEB PROFILE */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <ProjectCard
                name={"WEB PROFILE"}
                description={
                  "This very website. Built using Next.js, React, and Material-UI. The website is responsive and showcases my projects, skills, design knowledge, and contact information."}
                gradientColors={["rgb(234, 48, 113)","rgb(193, 69, 255)"]}
                gradientAngle={45}
                gitRepo="web_profile"/>              
              </Grid2>
            </Grid2>
        </Container>
      </Box>
    </Box>
  );
}