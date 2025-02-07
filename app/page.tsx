import { Box, Container, Grid2, Typography } from "@mui/material";
import ImageSlider from "./components/ImageSlider";
import SkillCard from "./components/SkillCard";

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
              {/* Python */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Python"
                colors={["rgb(22, 167, 105)", "rgb(17, 133, 159)", "rgb(6, 99, 198)"]}
                angle="45deg"
                icon={"/misc/skills/python.svg"}
                endpoint="/projects?search=Python"/>              
              </Grid2>
              {/* Javascript */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="JS"
                colors={["rgb(210, 116, 1)", "rgb(202, 131, 0)", "rgb(186, 159, 2)"]}
                angle="45deg"
                icon={"/misc/skills/js.svg"}
                endpoint="/projects?search=JavaScript"/>              
              </Grid2>
              {/* Typescript */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="TS"
                colors={["rgb(0, 93, 155)", "rgb(35, 112, 154)", "rgb(62, 133, 177)"]}
                angle="45deg"
                icon={"/misc/skills/ts.svg"}
                endpoint="https://www.typescriptlang.org"/>              
              </Grid2>
              {/* Java */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Java"
                colors={["rgb(1, 51, 79)","rgb(0, 116, 183)","rgb(72, 153, 188)"]}
                angle="45deg"
                icon={"/misc/skills/java.svg"}
                endpoint="/projects?search=Java"/>              
              </Grid2>
              {/* Swift */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Swift"
                colors={["rgb(212, 47, 39)", "rgb(209, 81, 49)", "rgb(212, 124, 0)"]}
                angle="45deg"
                icon={"/misc/skills/swift.svg"}
                endpoint="/projects?search=Swift"/>              
              </Grid2>
            </Grid2>

            {/* Frameworks */}
            <Typography variant="h2" sx={{fontWeight: 500, paddingTop: 6, fontSize: {xs: '3rem',sm: '3.75rem'}}}>
              Frameworks
            </Typography>
            <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
              {/* React */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="React"
                colors={["rgb(80, 179, 207)", "rgb(0, 98, 123)"]}
                angle="45deg"
                icon={"/misc/skills/react.svg"}
                iconangle={45}
                endpoint="/projects?search=React"/>         
              </Grid2>
              {/* Electron */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Electron"
                colors={["rgb(159, 234, 249)", "rgb(71, 132, 143)", "rgb(47, 84, 150)"]}
                angle="45deg"
                icon={"/misc/skills/electron.svg"}
                endpoint="/projects?search=Electron"/>         
              </Grid2>
              {/* NodeJS */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Node.JS"
                colors={["rgb(40, 123, 40)", "rgb(47, 152, 47)", "rgb(72, 177, 72)"]}
                angle="45deg"
                icon={"/misc/skills/nodejs.svg"}
                endpoint="/projects?search=Node.JS"/>         
              </Grid2>
              {/* NextJS */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                  skill="Next.JS"
                  colors={["rgb(0, 0, 0)", "rgb(44, 44, 44)", "rgb(79, 79, 79)"]}
                  angle="45deg"
                  icon={"/misc/skills/nextjs.svg"}
                  endpoint="/projects?search=Next.JS"/>         
              </Grid2>
            </Grid2>

            {/* Design */}
            <Typography variant="h2" sx={{fontWeight: 500, paddingTop: 6, fontSize: {xs: '3rem',sm: '3.75rem'}}}>
              Design Tools
            </Typography>
            <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
              {/* Illustrator */}
              <Grid2 size={{ xs: 12, md: 6 , lg: 4}}>
                <SkillCard
                skill="Adobe Suite"
                colors={["rgb(217, 31, 75)", "rgb(188, 43, 127)", "rgb(139, 31, 211)"]}
                angle="45deg"
                icon={"/misc/skills/adobe.svg"}
                endpoint="/projects?search=Adobe"/>         
              </Grid2>
            </Grid2>
        </Container>
      </Box>
    </Box>
  );
}
