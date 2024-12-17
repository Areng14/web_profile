import { Avatar, Box, Container, Grid2, Typography } from "@mui/material";
import { deepOrange } from "@mui/material/colors";

export default function Home() {
  return (
    <div>
      <Container maxWidth="md">
        <Grid2 container spacing={6} marginY={8} paddingRight={15}>
          <Grid2
            size={{ md: 6, xs: 12 }}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <Avatar sx={{ bgcolor: deepOrange[500], width: 350, height: 350 }}>
              Areng
            </Avatar>
          </Grid2>
          <Grid2
            size={{ md: 6, xs: 12 }}
            sx={{ display: "flex", justifyContent: "flex-start" }}
            marginTop={6}
          >
            <Box>
              <Typography variant="h2">
                Areng
                <br />
                Teanpakdeeprasat
              </Typography>
              <Typography>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua,
                facilitating seamless solutions for diverse clients.
              </Typography>
            </Box>
          </Grid2>
        </Grid2>
      </Container>
    </div>
  );
}
