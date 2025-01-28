import { Box, Container, Grid2, Typography } from "@mui/material";
import ImageSlider from "./components/ImageSlider";
import SkillCard from "./components/SkillCard";
import getSkills from "./getSkills";

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
                  maxWidth: { xs: "60%", md: "50%" },
                }}
              >
                A software developer who makes programs on his freetime,
                ranging from things that are useless to things that are kinda useful.
                I try to keep my projects as clean and readable.
              </Typography>
            </Box>
          </Grid2>
        </Container>
      </Box>

      {/* Skills */}
      <Box sx={{ paddingTop: 16}}>
        <Container maxWidth={false} sx={{ maxWidth: "1600px"}}>       
            <Typography variant="h1" sx={{fontWeight: 700, fontSize: {xs: '3.5rem',sm: '6rem'}}}>
              Skills
            </Typography>

            {/* Languages */}
            <Typography variant="h2" sx={{fontWeight: 500, paddingTop: 6, fontSize: {xs: '3rem',sm: '3.75rem'}}}>
              Languages
            </Typography>
            <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
              {getSkills()["Languages"].map((skill) => (
                <Grid2 key={crypto.randomUUID()} size={{ xs: 12, md: 6 , lg: 4}}>
                  <SkillCard
                    skill={skill["skill"]}
                    colors={skill["colors"]}
                    angle={skill["angle"]}
                    icon={skill["icon"]}
                    endpoint={`/projects?search=${skill["skill"]}`}
                    />   
                </Grid2>   
                ))}
            </Grid2>

            {/* Frameworks */}
            <Typography variant="h2" sx={{fontWeight: 500, paddingTop: 6, fontSize: {xs: '3rem',sm: '3.75rem'}}}>
              Frameworks
            </Typography>
            <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
              {getSkills()["Frameworks"].map((skill) => (
                <Grid2 key={crypto.randomUUID()} size={{ xs: 12, md: 6 , lg: 4}}>
                  <SkillCard
                    skill={skill["skill"]}
                    colors={skill["colors"]}
                    angle={skill["angle"]}
                    icon={skill["icon"]}     
                    endpoint={`/projects?search=${skill["skill"]}`}            
                    />   
                </Grid2>   
                ))}
            </Grid2>

            {/* Design */}
            <Typography variant="h2" sx={{fontWeight: 500, paddingTop: 6, fontSize: {xs: '3rem',sm: '3.75rem'}}}>
              Design Tools
            </Typography>
            <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
              {getSkills()["DesignTools"].map((skill) => (
                <Grid2 key={crypto.randomUUID()} size={{ xs: 12, md: 6 , lg: 4}}>
                  <SkillCard
                    skill={skill["skill"]}
                    colors={skill["colors"]}
                    angle={skill["angle"]}
                    icon={skill["icon"]}   
                    endpoint={`/projects?search=${skill["skill"]}`}              
                    />   
                </Grid2>   
                ))}
            </Grid2>
        </Container>
      </Box>
    </Box>
  );
}