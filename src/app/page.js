
import styles from "./page.module.css";
import ResponsiveAppBar from "@/comp/appbar";
import { Box, Typography } from "@mui/material";
import Avatar from '@mui/material/Avatar';

export default function Home() {
  return (
    <div>
      <ResponsiveAppBar />
      <Box sx={{display: "flex",justifyContent: "center",alignItems: "center", marginY: 16,flexDirection:"column"}}>
        <Avatar
          alt="Remy Sharp"
          src="https://yt3.googleusercontent.com/bAPgcc0NUsnRyyikb_X6cz4Wdv4vFGZ0PvdAZs6dHgeMjXcau5AM7aFqdFxzP_UBXlbwiBg4=s900-c-k-c0x00ffffff-no-rj"
          sx={{ width: 380, height: 380}}
        />
        <Typography component={"h1"} sx={{marginY: 4, fontSize:32, fontWeight:"bold"}}>Areng Teanpakdeeprasat</Typography>
      </Box>
    </div>
  );
}
