import { Box, Container, Grid2, Typography } from "@mui/material";
import ImageSlider from "../components/ImageSlider";
import SkillCard from "../components/SkillCard";

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

            {/* Featured projects */}
            <Typography variant="h2" sx={{fontWeight: 500, paddingTop: 6}}>
              Featured
            </Typography>
            <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
              {/* Python */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Python"
                colors={["rgb(22, 167, 105)", "rgb(17, 133, 159)", "rgb(6, 99, 198)"]}
                angle="45deg"
                icon={"/misc/skills/python.svg"}
                endpoint="https://www.python.org"/>              
              </Grid2>
              {/* Javascript */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="JS"
                colors={["rgb(210, 116, 1)", "rgb(202, 131, 0)", "rgb(186, 159, 2)"]}
                angle="45deg"
                icon={"/misc/skills/js.svg"}
                endpoint="https://en.wikipedia.org/wiki/JavaScript"/>              
              </Grid2>
              {/* Java */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Java"
                colors={["rgb(1, 51, 79)","rgb(0, 116, 183)","rgb(72, 153, 188)"]}
                angle="45deg"
                icon={"/misc/skills/java.svg"}
                endpoint="https://www.oracle.com/java/"/>              
              </Grid2>
              {/* Swift */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Swift"
                colors={["rgb(212, 47, 39)", "rgb(209, 81, 49)", "rgb(212, 124, 0)"]}
                angle="45deg"
                icon={"/misc/skills/swift.svg"}
                endpoint="https://developer.apple.com/swift/"/>              
              </Grid2>
            </Grid2>
        </Container>
      </Box>
    </Box>
  );
}