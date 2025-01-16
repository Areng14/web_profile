// lib/getProjects.ts

export interface Project {
    id: number;
    name: string;
    description: string;
    gradientColors: string[];
    gradientAngle: number;
    gitRepo?: string;
    technologies: string[];
  }
  
  export function getProjects(): Project[] {
    return [
      {
        id: 1,
        name: "BPE",
        description: "Beemod Package Editor is a python program that allows users to create and edit packages for BEEMOD, a puzzlemaker mod for Portal 2. BPE v3 allows users to use plugins to extend the functionality of the program.",
        gradientColors: ["rgb(192, 76, 30)","rgb(175, 48, 48)"],
        gradientAngle: 45,
        gitRepo: "BeePackageEditor",
        technologies: ["Python"]
      },
      {
        id: 2,
        name: "TR",
        description: "TestRunner is built for testing multiple scripts at a time. Designed for teachers to use to mass grade student assignments. Includes a warning if the script uses weird imports.",
        gradientColors: ["rgb(30, 192, 70)","rgb(72, 99, 52)"],
        gradientAngle: 45,
        technologies: ["Python","JavaScript","Electron","Node.js"]
      },
      {
        id: 3,
        name: "Blank",
        description: "A image format using only whitespace. [SPACE][TAB][SPACE][TAB][SPACE][TAB] Each increment of whitespace corresponds to an increment in the RGB values. A newline signifies to move on to the next row.",
        gradientColors: ["rgb(35, 71, 169)","rgb(45, 151, 163)"],
        gradientAngle: 45,
        gitRepo: "blank",
        technologies: ["Python"]
      },
      {
        id: 4,
        name: "SCR ATO",
        description: "An macro program that automates the driving of trains in Stepford County Railway. The script uses OCR to read the information on the HUD which the program decides what to press.",
        gradientColors: ["rgb(35, 111, 173)","rgb(40, 44, 121)"],
        gradientAngle: 45,
        gitRepo: "scr-ato",
        technologies: ["Python"]
      },
      {
        id: 5,
        name: "Graph IMG",
        description: "A vector based image format that uses mathematical functions to generate images. The program uses a custom language to define the image.",
        gradientColors: ["rgb(80, 35, 169)","rgb(155, 45, 163)"],
        gradientAngle: 45,
        gitRepo: "GraphIMG",
        technologies: ["Python"]
      },
      {
        id: 6,
        name: "Website",
        description: "This very website. Built using Next.js, React, Material-UI and NodeJS for the backend. The website is responsive and showcases my projects, skills, design knowledge, and contact information.",
        gradientColors: ["rgb(182, 37, 88)","rgb(140, 49, 185)"],
        gradientAngle: 45,
        gitRepo: "web_profile",
        technologies: ["TypeScript","React","Next.js","Node.js"]
      },
      {
        id: 7,
        name: "Yapper",
        description: "A work in progress yapping program. Yapper allows for users to yap to each other. Basically a chat program.",
        gradientColors: ["rgb(157, 95, 33)","rgb(177, 48, 109)"],
        gradientAngle: 45,
        technologies: ["JavaScript","Electron","Node.js"]
      },
      {
        id: 8,
        name: "MC SERVER",
        description: "A minecraft minigames server. Game logic coded by me in Java. Games include: KitPVP Duels, Extreme Hide and Seek",
        gradientColors: ["rgb(0, 151, 161)","rgb(164, 0, 153)"],
        gradientAngle: 45,
        technologies: ["Java"]
      },
    ];
  }