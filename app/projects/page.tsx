import { Box, Container, Grid2, Typography } from "@mui/material";
import ImageSlider from "../components/ImageSlider";

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
    </Box>
  );
}