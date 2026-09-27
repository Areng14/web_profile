import type { ApiProject, ApiSkill } from "./types";
import { SkillType } from "./types";

// Local, serverless source of truth for the site content.
// Edit these arrays to add or change projects and skills — no backend required.
//
// Skill icons may be a path under /public (e.g. "/misc/skills/python.svg"),
// an absolute URL, or a base64 data URI (e.g. "data:image/svg+xml;base64,...").
// Use the POST /api/upload route to turn an SVG/image into a base64 data URI.

export const skills: ApiSkill[] = [
  // Languages
  {
    id: "python",
    skillName: "Python",
    description:
      "My go-to for tools and automation: a Discord bot with a fine-tuned ML model, desktop apps, custom image formats, and the model pipeline in BeePEE.",
    color: "#4B8BBE",
    gradientColor: ["#3776AB", "#FFD43B"],
    gradientAngle: 45,
    icon: "/misc/skills/python.svg",
    skillType: SkillType.Lang,
  },
  {
    id: "javascript",
    skillName: "JavaScript",
    description:
      "The logic behind my Electron apps, from the UI to talking to the file system and other processes.",
    color: "#F7DF1E",
    gradientColor: ["#F7DF1E", "#C9A227"],
    gradientAngle: 45,
    icon: "/misc/skills/js.svg",
    skillType: SkillType.Lang,
  },
  {
    id: "java",
    skillName: "Java",
    description:
      "Game logic for a Minecraft minigames server, plus wiring VMF2OBJ into BeePEE's model pipeline.",
    color: "#E76F00",
    gradientColor: ["#E76F00", "#B07219"],
    gradientAngle: 45,
    icon: "/misc/skills/java.svg",
    skillType: SkillType.Lang,
  },
  {
    id: "go",
    skillName: "Go",
    description:
      "Backend services. The bank app's REST API runs on Go Fiber with JWT auth.",
    color: "#00ADD8",
    gradientColor: ["#00ADD8", "#007D9C"],
    gradientAngle: 45,
    icon: "/misc/skills/go.svg",
    skillType: SkillType.Lang,
  },
  {
    id: "swift",
    skillName: "Swift",
    description:
      "Picking up native Apple development. Nothing shipped yet.",
    color: "#F05138",
    gradientColor: ["#F05138", "#C1352A"],
    gradientAngle: 45,
    icon: "/misc/skills/swift.svg",
    skillType: SkillType.Lang,
  },

  // Frameworks
  {
    id: "electron",
    skillName: "Electron",
    description:
      "Cross-platform desktop apps with installers, auto-updates and crash reporting.",
    color: "#9FEAF9",
    gradientColor: ["#2B2E3A", "#47848F"],
    gradientAngle: 45,
    icon: "/misc/skills/electron.svg",
    skillType: SkillType.Framework,
  },
  {
    id: "nodejs",
    skillName: "Node.js",
    description:
      "The backend side of my apps: file handling, child processes, packaging and build tooling.",
    color: "#5FA04E",
    gradientColor: ["#3C873A", "#215732"],
    gradientAngle: 45,
    icon: "/misc/skills/nodejs.svg",
    skillType: SkillType.Framework,
  },
  {
    id: "nextjs",
    skillName: "Next.js",
    description:
      "React and TypeScript on the web: this site and the bank app's dashboard.",
    color: "#FFFFFF",
    gradientColor: ["#444444", "#000000"],
    gradientAngle: 45,
    icon: "/misc/skills/nextjs.svg",
    skillType: SkillType.Framework,
  },

  // Tools
  {
    id: "docker",
    skillName: "Docker",
    description:
      "Multi-stage images running as a non-root user, built and shipped to a VPS by GitHub Actions on every push.",
    color: "#2496ED",
    gradientColor: ["#2496ED", "#1D63ED"],
    gradientAngle: 45,
    icon: "/misc/skills/docker.svg",
    skillType: SkillType.Tools,
  },
  {
    id: "claudecode",
    skillName: "Claude Code",
    description:
      "AI pair programmer for planning changes, refactors and reviews. It writes a lot of the code; I still read every diff.",
    color: "#D97757",
    gradientColor: ["#D97757", "#B85C3E"],
    gradientAngle: 45,
    icon: "/misc/skills/claudecode.svg",
    skillType: SkillType.Tools,
  },

  // Design Tools
  {
    id: "adobe",
    skillName: "Adobe",
    description:
      "Photoshop and Illustrator for logos, icons and UI assets.",
    color: "#FF3B30",
    gradientColor: ["#FF0000", "#990000"],
    gradientAngle: 45,
    icon: "/misc/skills/adobe.svg",
    skillType: SkillType.DesignTools,
  },
];

export const projects: ApiProject[] = [
  {
    id: "9",
    name: "BeePEE",
    description:
      "A desktop editor for building custom items for Portal 2's Puzzle Maker (via the BEEmod mod). Create and edit item packages visually, with no hand-editing of config files. It can auto-generate 3D models from level geometry and has a built-in signage designer.",
    gradientColor: ["#E3C83A", "#D88D5E"],
    gradientAngle: 45,
    gitRepo: "BeemodTools/BeePEE",
    skillId: ["electron", "javascript", "nodejs", "python", "java"],
    status: "Used by real people",
  },
  {
    id: "11",
    name: "BeeBOT",
    description:
      "The Discord bot for the BeemodTools community. It catches scams with a fine-tuned DistilBERT model and GPT fallback, and triages BeePEE crash reports with an AI agent that deduplicates bugs and digs through the user's package to find the cause.",
    gradientColor: ["#4B8BBE", "#5865F2"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["python"],
    status: "Running live for the BeemodTools community",
  },
  {
    id: "10",
    name: "Bank App",
    description:
      "A full-stack banking web app. Users can sign up, deposit, withdraw, send money to other users and view their transaction history. Built in Next.js on a Go backend, with JWT auth and Docker deployment to a VPS.",
    gradientColor: ["#00ADD8", "#2496ED"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["nextjs", "go", "docker"],
  },
  {
    id: "1",
    name: "BPE",
    description:
      "Beemod Package Editor is a python program that allows users to create and edit packages for BEEMOD, a puzzlemaker mod for Portal 2. BPE v3 allows users to use plugins to extend the functionality of the program.",
    gradientColor: ["rgb(217, 211, 43)", "rgb(216, 141, 94)"],
    gradientAngle: 45,
    gitRepo: "BeePackageEditor",
    skillId: ["python"],
  },
  {
    id: "2",
    name: "TR",
    description:
      "TestRunner is built for testing multiple scripts at a time. Designed for teachers to use to mass grade student assignments. Includes a warning if the script uses weird imports.",
    gradientColor: ["rgb(30, 192, 70)", "rgb(72, 99, 52)"],
    gradientAngle: 45,
    gitRepo: "TestRunner",
    skillId: ["python", "javascript", "electron", "nodejs"],
  },
  {
    id: "3",
    name: "Blank",
    description:
      "A image format using only whitespace. [SPACE][TAB][SPACE][TAB][SPACE][TAB] Each increment of whitespace corresponds to an increment in the RGB values. A newline signifies to move on to the next row.",
    gradientColor: ["rgb(35, 71, 169)", "rgb(45, 151, 163)"],
    gradientAngle: 45,
    gitRepo: "blank",
    skillId: ["python"],
  },
  {
    id: "4",
    name: "SCR ATO",
    description:
      "An macro program that automates the driving of trains in Stepford County Railway. The script uses OCR to read the information on the HUD which the program decides what to press.",
    gradientColor: ["rgb(35, 111, 173)", "rgb(40, 44, 121)"],
    gradientAngle: 45,
    gitRepo: "scr-ato",
    skillId: ["python"],
  },
  {
    id: "5",
    name: "Graph IMG",
    description:
      "A vector based image format that uses mathematical functions to generate images. The program uses a custom language to define the image.",
    gradientColor: ["rgb(80, 35, 169)", "rgb(155, 45, 163)"],
    gradientAngle: 45,
    gitRepo: "GraphIMG",
    skillId: ["python"],
  },
  {
    id: "6",
    name: "Website",
    description:
      "This very website. Built using Next.js, React, Material-UI and NodeJS for the backend. The website is responsive and showcases my projects, skills, design knowledge, and contact information.",
    gradientColor: ["rgb(182, 37, 88)", "rgb(140, 49, 185)"],
    gradientAngle: 45,
    gitRepo: "web_profile",
    skillId: ["nextjs", "nodejs", "claudecode"],
  },
  {
    id: "7",
    name: "Yapper",
    description:
      "A work in progress yapping program. Yapper allows for users to yap to each other. Basically a chat program.",
    gradientColor: ["rgb(157, 95, 33)", "rgb(177, 48, 109)"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["javascript", "electron", "nodejs"],
  },
  {
    id: "8",
    name: "MC SERVER",
    description:
      "A minecraft minigames server. Game logic coded by me in Java. Games include: KitPVP Duels, Extreme Hide and Seek",
    gradientColor: ["rgb(0, 151, 161)", "rgb(164, 0, 153)"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["java"],
  },
];
