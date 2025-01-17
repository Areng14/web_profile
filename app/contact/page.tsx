// app/projects/page.tsx
import { Metadata } from 'next';
import { Box, Container, Grid2, Typography } from "@mui/material";
import { Email } from '@mui/icons-material';
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
    icon: "/icons/email.svg",
    description: "Send me an email",
    href: "mailto:areng@andromedamc.space"
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
        <Container maxWidth={false} sx={{ maxWidth: "1600px", minWidth: { xs: "500px", md: "1600px" } }}>
          <Grid2 container spacing={4} sx={{ paddingTop: 4 }}>
            {contacts.map((contact) => (
              <Grid2 key={contact.id} size={{xs:12, md:6, lg:4}}>
                <ContactCard
                  name={contact.name}
                  description={contact.description}
                  icon={contact.icon}
                  href={contact.href}
                  gradientColors={["rgb(19, 91, 150)rgb(51, 69, 191), 0)"]}
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
