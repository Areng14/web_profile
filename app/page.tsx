import { Avatar, Box, Container, Grid2, Typography } from "@mui/material";
import { deepOrange } from "@mui/material/colors";
import ResponsiveAppBar from "./components/ResponsiveNavbar";
import { useState } from "react";
import ImageSlider from "./components/ImageSlider";

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
        <ImageSlider imgs={images} />
        <Container maxWidth={false} sx={{ maxWidth: "1600px" }}>
          <Grid2
            container
            spacing={6}
            sx={{
              py: { xs: 4, md: 8 },
              alignItems: "center",
            }}
          >
            {/* Text Content Section */}
            <Grid2
              size={{ xs: 12, md: 6 }}
              sx={{
                display: "flex",
                justifyContent: { xs: "center", md: "flex-start" },
                textAlign: { xs: "center", md: "left" },
                px: { xs: 4, md: 6 },
              }}
            >
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
                    maxWidth: { xs: "100%", md: "90%" },
                  }}
                >
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                  eiusmod tempor incididunt ut labore et dolore magna aliqua,
                  facilitating seamless solutions for diverse clients.
                </Typography>
              </Box>
            </Grid2>
          </Grid2>
        </Container>
      </Box>
    </Box>
  );
}