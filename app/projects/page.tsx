// app/projects/page.tsx
import { Box, Container, Grid2, Typography } from "@mui/material";
import ImageSlider from "../components/ImageSlider";
import ProjectSearch from "../components/ProjectSearch";
import { getProjects, type Project } from './getProjects';

const images: string[] = [
  "/misc/mainslide/img5.png",
  "/misc/mainslide/img6.png",
  "/misc/mainslide/img7.png",
  "/misc/mainslide/img8.png",
];

export default async function Projects({
  searchParams,
}: {
  searchParams: { search: string };
}) {
  // Initial server-side filtering
  const initialProjects = !searchParams.search 
    ? getProjects()
    : getProjects().filter(project => {
        const searchLower = searchParams.search.toLowerCase();
        return project.name.toLowerCase().includes(searchLower) ||
               project.description.toLowerCase().includes(searchLower) ||
               project.technologies.some(tech => 
                 tech.toLowerCase().includes(searchLower)
               );
      });

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
                  maxWidth: { xs: "60%", md: "50%" },
                }}
              >
                A collection of programs and scripts that use a variety of languages
                and libraries. Each project is different and showcases my skills in software.  
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

            <ProjectSearch 
              initialProjects={initialProjects}
              initialSearch={searchParams.search || ''}
            />         
        </Container>
      </Box>
    </Box>
  );
}