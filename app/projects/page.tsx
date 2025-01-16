// app/projects/page.tsx
import { Metadata } from 'next';
import { Box, Container, Grid, Typography } from "@mui/material";
import ImageSlider from "../components/ImageSlider";
import ProjectSearch from "../components/ProjectSearch";
import { getProjects } from './getProjects';

const images: string[] = [
  "/misc/mainslide/img5.png",
  "/misc/mainslide/img6.png",
  "/misc/mainslide/img7.png",
  "/misc/mainslide/img8.png",
];

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: 'Projects',
    description: 'A collection of software projects',
  };
};

interface ProjectsPageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function Projects({ searchParams }: ProjectsPageProps) {
  const { search } = await searchParams;
  const initialProjects = search
    ? getProjects().filter(project => {
        const searchLower = search.toLowerCase();
        return project.name.toLowerCase().includes(searchLower) ||
               project.description.toLowerCase().includes(searchLower) ||
               project.technologies.some(tech => 
                 tech.toLowerCase().includes(searchLower)
               );
      })
    : getProjects();

  return (
    <Box>
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
        <ImageSlider imgs={images} />
        <Container 
          maxWidth={false} 
          sx={{ maxWidth: "1600px", minWidth: { xs: "500px", md: "1600px" } }}
        >
          <Grid
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
          </Grid>
        </Container>
      </Box>

      {/* Project List */}
      <Box sx={{ paddingTop: 16 }}>
        <Container maxWidth={false} sx={{ maxWidth: "1600px" }}>
          <Typography 
            variant="h1" 
            sx={{ fontWeight: 700, fontSize: { xs: "3.5rem", sm: "6rem" }, paddingBottom: 4 }}
          >
            Projects
          </Typography>

          <ProjectSearch 
            initialProjects={initialProjects}
            initialSearch={search || ''}
          />
        </Container>
      </Box>
    </Box>
  );
}
