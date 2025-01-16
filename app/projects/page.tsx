import { Box, Container, Grid2, Typography } from "@mui/material";
import ImageSlider from "../components/ImageSlider";
import ProjectCard from "../components/ProjectCard";

export default function Projects() {

  const images = [
    "/misc/mainslide/img5.png",
    "/misc/mainslide/img6.png",
    "/misc/mainslide/img7.png",
    "/misc/mainslide/img8.png",
  ];

  // TODO: Replace with fetched data
  const temp_projects = [
    {
      id: 1,
      name: "BPE",
      description: "Beemod Package Editor is a python program that allows users to create and edit packages for BEEMOD, a puzzlemaker mod for Portal 2. BPE v3 allows users to use plugins to extend the functionality of the program.",
      gradientColors: ["rgb(192, 76, 30)","rgb(175, 48, 48)"],
      gradientAngle: 45,
      gitRepo: "BeePackageEditor",
      technologies: ["Python"]
    },
    {
      id: 2,
      name: "TR",
      description: "TestRunner is built for testing multiple scripts at a time. Designed for teachers to use to mass grade student assignments. Includes a warning if the script uses weird imports.",
      gradientColors: ["rgb(30, 192, 70)","rgb(72, 99, 52)"],
      gradientAngle: 45,
      technologies: ["Python","JavaScript","Electron","Node.js"]
    },
    {
      id: 3,
      name: "Blank",
      description: "A image format using only whitespace. [SPACE][TAB][SPACE][TAB][SPACE][TAB] Each increment of whitespace corresponds to an increment in the RGB values. A newline signifies to move on to the next row.",
      gradientColors: ["rgb(35, 71, 169)","rgb(45, 151, 163)"],
      gradientAngle: 45,
      gitRepo: "blank",
      technologies: ["Python"]
    },
    {
      id: 4,
      name: "SCR ATO",
      description: "An macro program that automates the driving of trains in Stepford County Railway. The script uses OCR to read the information on the HUD which the program decides what to press.",
      gradientColors: ["rgb(35, 111, 173)","rgb(40, 44, 121)"],
      gradientAngle: 45,
      gitRepo: "scr-ato",
      technologies: ["Python"]
    },
    {
      id: 4,
      name: "Graph IMG",
      description: "A vector based image format that uses mathematical functions to generate images. The program uses a custom language to define the image.",
      gradientColors: ["rgb(80, 35, 169)","rgb(155, 45, 163)"],
      gradientAngle: 45,
      gitRepo: "GraphIMG",
      technologies: ["Python"]
    },
    {
      id: 5,
      name: "Website",
      description: "This very website. Built using Next.js, React, Material-UI and NodeJS for the backend. The website is responsive and showcases my projects, skills, design knowledge, and contact information.",
      gradientColors: ["rgb(182, 37, 88)","rgb(140, 49, 185)"],
      gradientAngle: 45,
      gitRepo: "web_profile",
      technologies: ["TypeScript","React","Next.js","Node.js"]
    },
    {
      id: 6,
      name: "Yapper",
      description: "A work in progress yapping program. Yapper allows for users to yap to each other. Basically a chat program.",
      gradientColors: ["rgb(157, 95, 33)","rgb(177, 48, 109)"],
      gradientAngle: 45,
      technologies: ["JavaScript","Electron","Node.js"]
    },
    {
      id: 7,
      name: "MC SERVER",
      description: "A minecraft minigames server. Game logic coded by me in Java. Games include: KitPVP Duels, Extreme Hide and Seek",
      gradientColors: ["rgb(0, 151, 161)","rgb(164, 0, 153)"],
      gradientAngle: 45,
      technologies: ["Java"]
    },
  ]

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
                A collection of programs and scripts that use a variety of languages
                and libaries. Each project is diffrent and showcases my skills in software.  
              </Typography>
            </Box>
          </Grid2>
        </Container>
      </Box>

      {/* Project List */}
      <Box sx={{ paddingTop: 16}}>
        <Container maxWidth={false} sx={{ maxWidth: "1600px"}}>       
            <Typography variant="h1" sx={{fontWeight: 700, fontSize: {xs: '3.5rem',sm: '6rem'}}}>
              Projects
            </Typography>

            {/* Search for project */}

            <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
            {temp_projects.map((project) => (
              <Grid2 key={project.id} size={{ xs: 12, md: 6 , lg: 4}}>
                <ProjectCard
                  name={project.name}
                  description={project.description}
                  gradientColors= {project.gradientColors}
                  gradientAngle= {project.gradientAngle}             
                  {...(project.gitRepo
                    ? { gitRepo: project.gitRepo }
                    : {}
                  )}
                  technologies={project.technologies}
                />
              </Grid2>
            ))}
            </Grid2>            
        </Container>
      </Box>
    </Box>
  );
}