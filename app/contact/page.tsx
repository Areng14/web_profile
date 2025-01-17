// app/projects/page.tsx
import { Metadata } from 'next';
import { Box, Container, Grid2, Typography } from "@mui/material";
import { Email, GitHub } from '@mui/icons-material';
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
    description: "Send me an email at areng@andromedamc.space. I will try to respond as soon as possible.",
    href: "mailto:areng@andromedamc.space"
  },
  {
    id: 2,
    name: "Discord",
    iconImage: "/icons/discord.svg",
    description: "Add me on discord at ArengDev. I am most active on discord",
    href: "https://discord.com"
  },
  {
    id: 3,
    name: "GitHub",
    icon: <GitHub sx={{ color: "white", fontSize: 54 }} />,
    description: "Check out my GitHub profile for my projects and contributions.",
    href: "https://github.com/areng14"
  }
]

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

      {/* Content */}
      <Box sx={{ paddingTop: 16 }}>
        <Container maxWidth="md">
          <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
            {contacts.map((contact) => (
              <Grid2 
                key={contact.id} 
                sx={{ 
                  width: {
                    xs: '100%',   // Full width on mobile
                    md: '50%',    // Two cards per row on medium
                    lg: '33.33%'  // Three cards per row on large
                  }
                }}
              >
                <ContactCard
                  name={contact.name}
                  description={contact.description}
                  icon={contact.icon}
                  iconImage={contact.iconImage}
                  href={contact.href}
                  gradientColors={["rgb(19, 91, 150)", "rgb(51, 69, 191)"]}
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
