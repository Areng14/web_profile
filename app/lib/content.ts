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
    gradientColor: ["#3776AB", "#FFD43B"],
    gradientAngle: 45,
    icon: "/misc/skills/python.svg",
    skillType: SkillType.Lang,
  },
  {
    id: "javascript",
    skillName: "JavaScript",
    gradientColor: ["#F7DF1E", "#C9A227"],
    gradientAngle: 45,
    icon: "/misc/skills/js.svg",
    skillType: SkillType.Lang,
  },
  {
    id: "typescript",
    skillName: "TypeScript",
    gradientColor: ["#3178C6", "#1E4F8A"],
    gradientAngle: 45,
    icon: "/misc/skills/ts.svg",
    skillType: SkillType.Lang,
  },
  {
    id: "java",
    skillName: "Java",
    gradientColor: ["#E76F00", "#B07219"],
    gradientAngle: 45,
    icon: "/misc/skills/java.svg",
    skillType: SkillType.Lang,
  },
  {
    id: "swift",
    skillName: "Swift",
    gradientColor: ["#F05138", "#C1352A"],
    gradientAngle: 45,
    icon: "/misc/skills/swift.svg",
    skillType: SkillType.Lang,
  },

  // Frameworks
  {
    id: "react",
    skillName: "React",
    gradientColor: ["#61DAFB", "#1F8FB3"],
    gradientAngle: 45,
    icon: "/misc/skills/react.svg",
    skillType: SkillType.Framework,
  },
  {
    id: "electron",
    skillName: "Electron",
    gradientColor: ["#2B2E3A", "#47848F"],
    gradientAngle: 45,
    icon: "/misc/skills/electron.svg",
    skillType: SkillType.Framework,
  },
  {
    id: "nodejs",
    skillName: "Node.js",
    gradientColor: ["#3C873A", "#215732"],
    gradientAngle: 45,
    icon: "/misc/skills/nodejs.svg",
    skillType: SkillType.Framework,
  },
  {
    id: "nextjs",
    skillName: "Next.js",
    gradientColor: ["#444444", "#000000"],
    gradientAngle: 45,
    icon: "/misc/skills/nextjs.svg",
    skillType: SkillType.Framework,
  },

  // Design Tools
  {
    id: "adobe",
    skillName: "Adobe",
    gradientColor: ["#FF0000", "#990000"],
    gradientAngle: 45,
    icon: "/misc/skills/adobe.svg",
    skillType: SkillType.DesignTools,
  },
];

export const projects: ApiProject[] = [
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
    skillId: ["typescript", "react", "nextjs", "nodejs"],
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
