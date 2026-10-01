import type { ApiProject, ApiSkill } from "./types";
import { SkillType } from "./types";

// Local, serverless source of truth for the site content.
// Edit these arrays to add or change projects and skills — no backend required.
//
// Skill icons may be a path under /public (e.g. "/misc/skills/python.svg"),
// an absolute URL, or a base64 data URI (e.g. "data:image/svg+xml;base64,...").
// Use the POST /api/upload route to turn an SVG/image into a base64 data URI.

// Ways to reach me, shown on the contact page. Leave a field empty to hide it.
export const contact = {
  email: "contact@arengdev.com",
  discord: "arengdev",
  github: "Areng14",
};

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
      "The logic behind my Electron apps, plus framework-free browser games: a 3D tower defense and a railway signalling sim.",
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
      "Game logic for a Minecraft minigames server: KitPVP Duels and Extreme Hide and Seek.",
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
      "Backend services on Go Fiber: SmartLung's multi-tenant health API and the bank app's REST API.",
    color: "#00ADD8",
    gradientColor: ["#00ADD8", "#007D9C"],
    gradientAngle: 45,
    icon: "/misc/skills/go.svg",
    skillType: SkillType.Lang,
  },
  {
    id: "cpp",
    skillName: "C++",
    description:
      "Embedded firmware: SmartLung's ESP32-S3 touchscreen UI in LVGL and its I²C sensor drivers.",
    color: "#659AD2",
    gradientColor: ["#659AD2", "#00599C"],
    gradientAngle: 45,
    icon: "/misc/skills/cplusplus.svg",
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
      "React and TypeScript on the web: this site and SmartLung's clinician dashboard.",
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
      "Small multi-stage images, like SmartLung's ~8 MB API, and automated deploys to a VPS with GitHub Actions.",
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
    kind: "Desktop app",
    platform: "Windows · Linux",
    description:
      "A desktop editor for making custom Portal 2 Puzzle Maker items (via BEEmod). One button turns level geometry into a real game model.",
    gradientColor: ["#E3C83A", "#D88D5E"],
    gradientAngle: 45,
    gitRepo: "BeemodTools/BeePEE",
    skillId: ["electron", "javascript", "nodejs", "python"],
    hasUsers: true,
  },
  {
    id: "16",
    name: "SmartLung",
    kind: "IoT platform",
    platform: "ESP32 · Web",
    description:
      "A breathing trainer for elderly patients: an ESP32 touchscreen device reading real pressure and pulse-ox sensors, a Go API that verifies each device by its signature, and a Next.js dashboard for clinicians.",
    gradientColor: ["#659AD2", "#00ADD8"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["cpp", "go", "nextjs", "docker", "claudecode"],
  },
  {
    id: "11",
    name: "BeeBOT",
    kind: "Discord bot",
    platform: "Discord",
    description:
      "The Discord bot for the BeemodTools community. It catches scams with a fine-tuned DistilBERT model and triages BeePEE crash reports with an AI agent.",
    gradientColor: ["#4B8BBE", "#5865F2"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["python"],
    hasUsers: true,
  },
  {
    id: "12",
    name: "AlgebraLoop",
    kind: "Web app",
    platform: "Browser",
    description:
      "Math practice from Algebra 1 to AP Calc, with every problem generated and graded in the browser. Tests generate thousands of problems to keep the grader honest.",
    gradientColor: ["#6366F1", "#8B5CF6"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["nextjs", "claudecode"],
  },
  {
    id: "13",
    name: "Railway Signalling Sim",
    kind: "Game",
    platform: "Browser",
    description:
      "Be the signaller for a fictional 8-zone railway, with a real interlocking deciding which routes are allowed. Ships with a 20-page rule book that tests keep in sync with the game.",
    gradientColor: ["#F59E0B", "#DC2626"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["javascript", "claudecode"],
    playUrl: "/games/signalling",
  },
  {
    id: "14",
    name: "Tower Defense",
    kind: "Game",
    platform: "Browser",
    description:
      "A 3D tower defense in Three.js with 20 towers, 28 enemy types and a 50-wave campaign. Balance is tuned against measured win rates.",
    gradientColor: ["#10B981", "#0EA5E9"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["javascript", "claudecode"],
    playUrl: "/games/td",
  },
  {
    id: "10",
    name: "Bank App",
    kind: "Web app",
    platform: "Web",
    description:
      "A full-stack banking app: sign up, deposit, withdraw and send money to other users. Next.js on a Go backend with JWT auth, deployed with Docker.",
    gradientColor: ["#00ADD8", "#2496ED"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["nextjs", "go", "docker"],
    graveyard: true,
    causeOfDeath: "Made a nice tutorial, and that's all it needed to be.",
  },
  {
    id: "1",
    name: "BPE",
    kind: "Desktop app",
    platform: "Desktop",
    description:
      "The original Python editor for BEEmod item packages, with plugin support in v3.",
    gradientColor: ["rgb(217, 211, 43)", "rgb(216, 141, 94)"],
    gradientAngle: 45,
    gitRepo: "BeePackageEditor",
    skillId: ["python"],
    graveyard: true,
    causeOfDeath: "Replaced by BeePEE, a full rewrite.",
  },
  {
    id: "2",
    name: "TR",
    kind: "Desktop app",
    platform: "Desktop",
    description:
      "Runs a batch of scripts at once so teachers can mass-grade student assignments, and warns when a script uses weird imports.",
    gradientColor: ["rgb(30, 192, 70)", "rgb(72, 99, 52)"],
    gradientAngle: 45,
    gitRepo: "TestRunner",
    skillId: ["python", "javascript", "electron", "nodejs"],
    graveyard: true,
    causeOfDeath: "Grading season ended.",
  },
  {
    id: "3",
    name: "Blank",
    kind: "File format",
    platform: "Python",
    description:
      "An image format made entirely of whitespace. Spaces and tabs encode RGB values, and a newline starts the next row.",
    gradientColor: ["rgb(35, 71, 169)", "rgb(45, 151, 163)"],
    gradientAngle: 45,
    gitRepo: "blank",
    skillId: ["python"],
    graveyard: true,
    causeOfDeath: "Turned out to make files larger, not smaller.",
  },
  {
    id: "4",
    name: "SCR ATO",
    kind: "Automation",
    platform: "Desktop",
    description:
      "A macro that drives trains in Stepford County Railway on its own. It reads the HUD with OCR and decides what to press.",
    gradientColor: ["rgb(35, 111, 173)", "rgb(40, 44, 121)"],
    gradientAngle: 45,
    gitRepo: "scr-ato",
    skillId: ["python"],
  },
  {
    id: "5",
    name: "Graph IMG",
    kind: "File format",
    platform: "Python",
    description:
      "A vector image format that draws with math functions, defined in its own small language.",
    gradientColor: ["rgb(80, 35, 169)", "rgb(155, 45, 163)"],
    gradientAngle: 45,
    gitRepo: "GraphIMG",
    skillId: ["python"],
    graveyard: true,
    causeOfDeath: "Desmos and SVG already do this, and better.",
  },
  {
    id: "6",
    name: "Website",
    kind: "Website",
    platform: "Web",
    description:
      "This site. Next.js with no backend, filterable projects and animated transitions.",
    gradientColor: ["rgb(182, 37, 88)", "rgb(140, 49, 185)"],
    gradientAngle: 45,
    gitRepo: "web_profile",
    skillId: ["nextjs", "nodejs", "claudecode"],
  },
  {
    id: "7",
    name: "Yapper",
    kind: "Desktop app",
    platform: "Desktop",
    description:
      "A work-in-progress desktop chat app built with Electron.",
    gradientColor: ["rgb(157, 95, 33)", "rgb(177, 48, 109)"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["javascript", "electron", "nodejs"],
    graveyard: true,
    causeOfDeath: "Discord exists, and the motivation didn't.",
  },
  {
    id: "8",
    name: "MC SERVER",
    kind: "Game server",
    platform: "Minecraft",
    description:
      "A Minecraft minigames server with game logic in Java, including KitPVP Duels and Extreme Hide and Seek.",
    gradientColor: ["rgb(0, 151, 161)", "rgb(164, 0, 153)"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["java"],
    graveyard: true,
    causeOfDeath: "Ran out of motivation.",
  },
  {
    id: "15",
    name: "Music Visualizer",
    kind: "CLI tool",
    platform: "Python",
    description:
      "Turns an MP3 into a video of a cube bouncing to the beat. Bass sets its size, treble rounds its corners and volume controls how bright it glows.",
    gradientColor: ["#4B8BBE", "#A855F7"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["python"],
    graveyard: true,
    causeOfDeath: "Never found a real use for it.",
  },
  {
    id: "17",
    name: "Chaos Encryptor",
    kind: "CLI tool",
    platform: "Terminal",
    description:
      "A toy cipher that pads a message with random characters at prime positions, then shifts, reverses and XORs it over key-driven rounds before shuffling the result. It decrypts every message before handing it over to prove it round-trips.",
    gradientColor: ["#4B8BBE", "#10B981"],
    gradientAngle: 45,
    gitRepo: "",
    skillId: ["python"],
    graveyard: true,
    causeOfDeath: "Used on one project, then lost its charm.",
  },
];
