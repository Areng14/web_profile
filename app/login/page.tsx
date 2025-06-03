import React from "react";
import { Box, Button, Container, TextField, Typography } from "@mui/material";

export default function LoginPage() {
  return (
    <Box>
      <Box sx={{ paddingTop: 16 }}>
        <Container maxWidth={false} sx={{ maxWidth: "1600px" }}>
          <Typography
            variant="h1"
            sx={{ fontWeight: 700, fontSize: { xs: "3.5rem", sm: "6rem" } }}
          >
            Login
          </Typography>

          <Typography
            variant="h2"
            sx={{
              fontWeight: 500,
              paddingTop: 6,
              fontSize: { xs: "2rem", sm: "2.75rem" },
            }}
          >
            Welcome Back!
          </Typography>

          <TextField
            id="username"
            label="Username"
            variant="outlined"
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: "white",
                },
                "&:hover fieldset": {
                  borderColor: "white",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "white",
                },
              },
              "& .MuiInputLabel-root": {
                color: "white",
              },
              input: { color: "white" },
            }}
          />
          <TextField
            id="admin"
            label="Password"
            type="password"
            variant="outlined"
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: "white",
                },
                "&:hover fieldset": {
                  borderColor: "white",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "white",
                },
              },
              "& .MuiInputLabel-root": {
                color: "white",
              },
              input: { color: "white" },
            }}
          />

          <Button variant="contained"> Login </Button>
        </Container>
      </Box>
    </Box>
  );
}
