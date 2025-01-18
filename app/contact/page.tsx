// app/projects/page.tsx
import { Metadata } from 'next';
import { Box, Container, Grid2, Typography } from "@mui/material";
import { Email, GitHub, YouTube } from '@mui/icons-material';
import ImageSlider from "../components/ImageSlider";
import ContactCard from '../components/ContactCard';

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


const contacts = [
  {
    id: 1,
    name: "Email",
    icon: <Email sx={{ color: "white", fontSize: 54 }} />,
    gradientColors: ["rgb(81, 147, 201)", "rgb(51, 182, 191)"],
    description: "Send me an email at areng@andromedamc.space.",
    href: "mailto:areng@andromedamc.space"
  },
  {
    id: 2,
    name: "Discord",
    iconImage: "/icons/discord.svg",
    gradientColors: ["rgb(61, 52, 193)", "rgb(51, 116, 191)"],
    description: "Add me on discord at ArengDev. I am most active on discord",
    href: "https://discord.com"
  },
  {
    id: 3,
    name: "GitHub",
    icon: <GitHub sx={{ color: "white", fontSize: 54 }} />,
    gradientColors: ["rgb(99, 104, 115)", "rgb(81, 87, 97)"],
    description: "Check out my GitHub profile for my projects and contributions.",
    href: "https://github.com/areng14"
  },
  {
    id: 4,
    name: "Youtube",
    icon: <YouTube sx={{ color: "white", fontSize: 54 }} />,
    gradientColors: ["rgb(182, 38, 64)", "rgb(167, 41, 32)"],
    description: "Check out my youtube channel for content.",
    href: "https://www.youtube.com/@areng3545"
  }
]

export default function Contact() {
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
                Contact
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "1rem", md: "1.1rem" },
                  maxWidth: { xs: "60%", md: "50%" },
                }}
              >
                A list of ways you can contact me for whatever reason.
                I am mainly active on Discord, and I check my email every now and then.
                Choose whatever way is most convenient for you.
              </Typography>
            </Box>
          </Grid2>
        </Container>
      </Box>

      {/* Contact Cards Section */}
      <Box sx={{ paddingTop: 16 }}>
        <Container maxWidth={false} sx={{ maxWidth: "1800px" }}>
          <Typography 
            variant="h1" 
            sx={{ fontWeight: 700, fontSize: { xs: "3.5rem", sm: "6rem" }, paddingBottom: 4 }}
          >
            Options
          </Typography>

          <Grid2 
            container 
            spacing={3}
            sx={{ 
              display: 'flex',
              justifyContent: 'flex-start'
            }}
          >
            {contacts.map((contact) => (
              <Grid2 
                key={contact.id} 
                sx={{
                  width: {
                    xs: '100%',
                    md: '382px'
                  },
                  display: 'flex',
                  alignItems: 'stretch'
                }}
              >
                <ContactCard
                  name={contact.name}
                  description={contact.description}
                  icon={contact.icon}
                  iconImage={contact.iconImage}
                  href={contact.href}
                  gradientColors={contact.gradientColors}
                  gradientAngle={45}
                />
              </Grid2>
            ))}
          </Grid2>
        </Container>
      </Box>
    </Box>
  );
}
