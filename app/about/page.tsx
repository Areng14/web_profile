// app/projects/page.tsx
import { Metadata } from 'next';
import { Box, Container, Grid2, Link, Typography } from "@mui/material";
import ImageSlider from "../components/ImageSlider";

const images: string[] = [
  "/misc/mainslide/img5.png",
  "/misc/mainslide/img6.png",
  "/misc/mainslide/img7.png",
  "/misc/mainslide/img8.png",
];

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: 'About',
    description: 'About me',
  };
};

export default function About() {
  return (
    <Box>
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
        <ImageSlider imgs={images} />
        <Container 
          maxWidth={false} 
          sx={{ maxWidth: "1600px", minWidth: { xs: "500px", md: "1600px" } }}
        >
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
                About
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "1rem", md: "1.1rem" },
                  maxWidth: { xs: "60%", md: "50%" },
                }}
              >
                A long essay about myself. tl;dr Im a software developer who makes programs that might be useful
                on my freetime.
              </Typography>
            </Box>
          </Grid2>
        </Container>
      </Box>

      {/* Content */}
      <Box sx={{ paddingTop: 16 }}>
        <Container maxWidth={false} sx={{ maxWidth: "1600px", minWidth: { xs: "500px", md: "1600px" } }}>
            <Box sx={{ width: "90%" }}>
                <Typography 
                    variant="h1" 
                    sx={{ fontWeight: 700, fontSize: { xs: "3.5rem", sm: "6rem" }, paddingBottom: 4 }}
                >
                    Story
                </Typography>
                <Typography sx={{paddingLeft: 16}}>
                    Since the age of 12, I have been intrested in computers and technology. I started off with
                    learning Python as my first language. Which is why you see alot of 
                    <Link href="/projects?search=Python" color="primary" underline="hover"> Python projects </Link> 
                    on the projects page. My first program was a temporary file remover. It was a simple program that
                    goes through temporary directories and removes the files to free up space.
                    <br/>
                    <br/>
                    My second program was a <Link href="https://github.com/Areng14/Fizzler-Recolor/" color="primary" underline="hover"> Fizzler Recolorer </Link> 
                    for the game Portal 2. It was a program that can recolor
                    the fizzler in the game. It works by changing the vmt (Valve Material)s color value to the selected color.
                    It didnt have a GUI so you had to use the command line to use it.
                    <br/>
                    <br/>
                    I have since been learning new languages and frameworks to expand my knowledge. I have recently been learning react and other js frameworks
                    and JavaScript overall. One of the more recent projects I have worked on was <Link href="https://github.com/Areng14/testrunner/" color="primary" underline="hover"> TestRunner </Link>
                    which is a program that runs tests on multiple python scripts and checks if it matches the expected output.
                    The program features a security measure where if the program does something suspicoius, it will warn the user.
                    <br/>
                    <br/>
                    In conclusion, I am a software developer who makes programs on my freetime.
                    I make programs that have a range of purposes, from being useless to being kinda useful.
                    Check out my projects page to see what I have made.
                </Typography>
                <Typography 
                    variant="h1" 
                    sx={{ fontWeight: 700, fontSize: { xs: "3.5rem", sm: "6rem" }, paddingBottom: 4, paddingTop: 8 }}
                >
                    Why me?
                </Typography>
                <Typography sx={{paddingLeft: 16}}>
                    I am open to work on projects that are intresting but not too challanging.
                    Keep in mind that I may choose to not work on a project if I am busy.
                    I am mainly open to work on projects that are related to what I have done before or are similar to what I have done before.
                    Stuff like AI I will not work on as I have no experience in that field. To contact me, go to the contact page or 
                    click this <Link href="/contact" color="primary" underline="hover"> link </Link>.
                </Typography>
            </Box>
        </Container>
      </Box>
    </Box>
  );
}
