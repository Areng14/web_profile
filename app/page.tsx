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
  ];

  return (
    <Box>
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center"}}>
        <ImageSlider imgs={images} />
        <Container maxWidth="lg">
          <Grid2
            container
            spacing={6}
            sx={{
              py: { xs: 4, md: 8 },
              alignItems: "center",
            }}
          >
            {/* Avatar Section */}
            <Grid2
              size={{ xs: 12, md: 6 }}
              sx={{
                display: "flex",
                justifyContent: { xs: "center", md: "flex-end" },
                px: { xs: 2, md: 4 },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: deepOrange[500],
                  width: { xs: 200, sm: 280, md: 350 },
                  height: { xs: 200, sm: 280, md: 350 },
                }}
              >
                Areng
              </Avatar>
            </Grid2>

            {/* Text Content Section */}
            <Grid2
              size={{ xs: 12, md: 6 }}
              sx={{
                display: "flex",
                justifyContent: { xs: "center", md: "flex-start" },
                textAlign: { xs: "center", md: "left" },
                px: { xs: 2, md: 4 },
              }}
            >
              <Box>
                <Typography
                  variant="h2"
                  sx={{
                    fontSize: { xs: "2rem", sm: "2.5rem", md: "3.75rem" },
                    mb: 2,
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