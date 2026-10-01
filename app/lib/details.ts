// Long-form writeups for project pages, keyed by project id (see content.ts).
// Projects without an entry still get a page built from their card info.
//
// A section's body is a list of blocks: a string is a paragraph, an array of
// strings is a bullet list.

export interface ProjectSection {
  title?: string;
  body: (string | string[])[];
}

export interface ProjectImage {
  src: string;
  alt: string;
}

export interface ProjectDetails {
  // Screenshots shown in the right-hand column; the first is the largest
  images?: ProjectImage[];
  sections?: ProjectSection[];
  // Full stack, beyond the skill tags
  tech?: string[];
}

export const projectDetails: Record<string, ProjectDetails> = {
  // BeePEE
  "9": {
    sections: [
      {
        body: [
          "BeePEE is an Electron + React app for making BEEmod packages, which are mods that add new items to Portal 2's Puzzle Maker. It's a full rewrite of the older BPE editor, merged with BeePKG's features, at about 50k lines and on v1.1.",
        ],
      },
      {
        title: "The model pipeline",
        body: [
          "The hardest part was the custom model pipeline. One \"Make Model\" button takes a level instance (VMF) and turns it into a real game model, chaining Java, Python and Valve's own compiler:",
          [
            "merges the instances and converts them to OBJ",
            "optionally cartoonifies the textures with OpenCV",
            "converts the textures to Valve's VTF format",
            "writes a QC file and compiles an MDL with Valve's studiomdl",
            "builds a matching 3DS collision model",
          ],
          "All of that gets staged and only lands in the package when you hit save.",
        ],
      },
      {
        title: "Everything an item needs, in one place",
        body: [
          "You can set up everything an item needs from one UI: info, inputs/outputs, VMF instances, right-click variables, and VBSP conditions. The conditions use a drag-and-drop block editor that compiles down to Valve's config format, so nobody has to write it by hand.",
          "There's also an autopacker that scans an instance for custom assets (models, materials and their dependencies) and bundles them into the package automatically, plus a signage designer with SVG import and automatic glow masks.",
        ],
      },
      {
        title: "Shipping it",
        body: [
          "It ships as a Windows installer and a Linux AppImage, with auto-updates, a beta channel and built-in crash reporting. Crash reports and bug reports go straight to BeeBOT, which triages them.",
        ],
      },
    ],
    tech: [
      "Electron",
      "React",
      "Material UI",
      "Three.js (react-three-fiber)",
      "Vite",
      "Node.js",
      "Python (OpenCV, PyAssimp, srctools)",
      "Java (VMF2OBJ)",
      "Source SDK studiomdl",
      "Jest",
    ],
  },

  // SmartLung
  "16": {
    images: [
      { src: "/misc/projects/smartlung-device.webp", alt: "The SmartLung device, its touchscreen showing today's training session" },
      { src: "/misc/projects/smartlung-patients.webp", alt: "Clinician dashboard: the patient caseload with adherence and status" },
      { src: "/misc/projects/smartlung-devices.webp", alt: "Clinician dashboard: paired devices by hardware UUID" },
    ],
    sections: [
      {
        body: [
          "SmartLung is a full-stack IoT health platform for respiratory muscle training in elderly patients, made of three parts: a touchscreen device for the patient, a Go backend, and a dashboard for clinicians.",
        ],
      },
      {
        title: "Patient device",
        body: [
          "ESP32-S3 firmware with a smooth, anti-aliased LVGL touchscreen UI. It guides patients through breathing sessions with a live pressure gauge, then uploads the results to the cloud.",
          "It reads a differential pressure sensor (MPX100DP through an ADS1115 ADC) and a MAX30102 pulse oximeter over I²C, and handles WiFi onboarding, pairing to a patient, and running offline.",
        ],
      },
      {
        title: "Security",
        body: [
          "Each device generates its own ECDSA P-256 keypair on first boot and signs every API request, with replay protection. Clinicians log in with JWT access/refresh tokens and bcrypt-hashed passwords.",
        ],
      },
      {
        title: "Backend",
        body: [
          "A multi-tenant Go REST API. Clinics, nurses, patients, devices and sessions are all scoped per organization. It also estimates MIP (the patient's max breathing strength) and flags heart rate and SpO₂. It ships as a Docker image of about 8 MB.",
        ],
      },
      {
        title: "Clinician dashboard",
        body: [
          "Next.js + TypeScript, with a patient list, custom SVG charts for pressure vs. target and adherence, a session log, device and WiFi management, and caseload reports.",
        ],
      },
    ],
    tech: [
      "C++ / C (ESP32-S3, Arduino)",
      "LVGL 9.2",
      "Arduino_GFX",
      "MPX100DP + ADS1115",
      "MAX30102",
      "Go",
      "Fiber",
      "GORM",
      "SQLite / PostgreSQL",
      "JWT · bcrypt · ECDSA",
      "Next.js 14",
      "React 18",
      "TypeScript",
      "Docker Compose",
      "arduino-cli",
    ],
  },

  // BeeBOT
  "11": {
    sections: [
      {
        body: [
          "BeeBOT runs the BeemodTools Discord server and has two main jobs: catching scams and triaging BeePEE's crash reports. It's about 12k lines of Python, running on a live server.",
        ],
      },
      {
        title: "Scam detection",
        body: [
          "Every message goes through a layered pipeline:",
          [
            "a DistilBERT classifier I fine-tuned (97.9% accuracy, 0.979 F1)",
            "GPT-4o for the uncertain cases",
            "perceptual image hashing plus OCR to catch scam screenshots",
            "a cross-channel spam detector that auto-mutes anyone posting the same thing in several channels",
          ],
          "It's smart about who it scans. Mods skip it, active long-time members skip image scans, and watchlisted users always get checked. The model keeps improving: mods confirm or reject flagged messages with buttons, and half of GPT's verdicts are automatically added to the training data.",
        ],
      },
      {
        title: "Crash reports",
        body: [
          "BeePEE sends crash reports to an HTTP endpoint on the bot, which is rate-limited and filters out junk reports. A fast model first checks whether the bug was already reported, and merges it into the existing thread if so.",
          "Otherwise an agent using OpenAI tool calling reads through the user's .bpee package file by file to find the likely cause. It then opens a forum thread tagged with the app version, and mods can close it with /resolve.",
        ],
      },
      {
        title: "The rest",
        body: [
          "It also handles the usual moderation (timed mutes and bans that survive restarts, purge, softban, logging). It runs on SQLite locally and Postgres in production on Railway.",
        ],
      },
    ],
    tech: [
      "Python",
      "nextcord",
      "PyTorch",
      "Hugging Face Transformers (DistilBERT)",
      "OpenAI API (GPT-4o, tool calling)",
      "EasyOCR",
      "imagehash",
      "aiohttp",
      "PostgreSQL / SQLite",
      "Railway",
    ],
  },

  // AlgebraLoop
  "12": {
    images: [
      { src: "/misc/projects/algebraloop-calculator.webp", alt: "A trapezoid area problem with the built-in calculator open beside it" },
      { src: "/misc/projects/algebraloop-graph.webp", alt: "Reading a system of equations' solution off a generated graph" },
      { src: "/misc/projects/algebraloop-limit.webp", alt: "A limit problem rendered with KaTeX, with the answer toolbar" },
      { src: "/misc/projects/algebraloop-courses.webp", alt: "The Algebra 2 course: 14 units plus mixed loop practice" },
    ],
    sections: [
      {
        body: [
          "AlgebraLoop has 9 courses, from Algebra 1 through AP Calc and Linear Algebra, and about 100 units of practice. Each unit is a set of question families: a prompt pattern plus parameter ranges, rolled from a seed and rendered with KaTeX.",
        ],
      },
      {
        title: "Testing the generator against itself",
        body: [
          "The test suite generates thousands of problems across every unit and difficulty tier, and checks three things:",
          [
            "the grader accepts what the generator produced",
            "no formatting junk like 1x or x^{1} ever leaks into a prompt",
            "no question family is secretly trivial, like one whose answer is always 5",
          ],
          "Self-consistency isn't correctness, so passing the grader isn't enough on its own; the other two checks catch problems that are technically valid but broken for a student.",
        ],
      },
      {
        title: "Grading",
        body: [
          "Grading uses a locked-down math.js parser that checks the student's answer numerically at ten sample points, so 2x+3 and 3+2x, or 1/2 and 0.5, all count as correct. It handles numeric answers, expressions, equations, coordinates, select-all questions, and step-by-step proofs where you pick a reason for each step.",
        ],
      },
      {
        title: "Difficulty and replay",
        body: [
          "Difficulty scales by how many reasoning steps a problem takes, not by making the numbers bigger. Multistep versions unlock once your mastery for that unit passes 40.",
          "The generator is versioned, so a saved session always replays the exact same questions even after the templates change. A pinned-digest test catches any accidental drift.",
        ],
      },
      {
        title: "Calculator",
        body: [
          "A built-in calculator with two screens:",
          [
            "Calculate: stats distributions (normalcdf, invT, binompdf…) and matrix ops (rref, det, inverse)",
            "Graph: the cursor snaps to zeros, turning points and intersections, and you can trace with the keyboard",
          ],
        ],
      },
    ],
    tech: ["Next.js", "React", "TypeScript", "KaTeX", "MathLive", "math.js"],
  },

  // Railway Signalling Sim
  "13": {
    images: [
      { src: "/misc/projects/signalling-desk.webp", alt: "The Chattanooga desk mid-shift, with routes set and the timetable alongside" },
      { src: "/games/signalling/guide/network-map.jpg", alt: "Network map of the fictional Chattanooga railway" },
      { src: "/misc/projects/signalling-shift.webp", alt: "Picking a desk and conditions for a new shift" },
    ],
    sections: [
      {
        body: [
          "You're the signaller at a modern control-centre workstation over a fictional 8-zone railway around Chattanooga. There's a main line, a branch, a 125 mph high-speed line and an airport branch on a flyover.",
        ],
      },
      {
        title: "A real interlocking",
        body: [
          "You set routes by clicking signals, and a real interlocking decides what's allowed:",
          [
            "routes lock every track section and set of points they use, and only unlock section by section as the train clears",
            "signals show proper 4-aspect indications",
            "cancel a route too late and approach locking holds it for two minutes, like the real thing",
          ],
          "A train describer tracks each train's headcode as it moves. The zones you're not controlling run on automatic route setting, which takes trains in timetable order and makes a train wait when a conflicting one is nearly due, so it can't deadlock.",
        ],
      },
      {
        title: "Shifts and faults",
        body: [
          "Each shift is generated from a seed, so the same number always gives the same shift. Harder shifts add track circuit failures, stuck points, broken-down trains, trains missing their description, leaves on the line, and engineering possessions the timetable wasn't written around.",
          "You phone faults in to fault control, and a call about nothing costs you points. Scoring uses the industry's own punctuality measure (arriving within 5 minutes counts as on time), weighted by train class.",
        ],
      },
      {
        title: "SO/01, the rule book",
        body: [
          "It ships with a playable training desk and SO/01, a 20-page rule book in the style of a real railway operating manual: 9 sections covering the train describer, signals, interlocking, regulating trains, faults and degraded working, plus appendices for the keys and a glossary. It opens in a panel right on the desk, or as a PDF to save or print.",
          "The PDF is generated from the HTML version by a Playwright script, and tests keep it honest:",
          [
            "a test fails if the PDF and its source ever drift apart",
            "another checks that Appendix A matches the game's actual key bindings, so the manual can't lie about the controls",
          ],
        ],
      },
    ],
    tech: ["JavaScript (ES modules, no framework)", "SVG", "Web Audio API", "Playwright", "localStorage"],
  },

  // Tower Defense
  "14": {
    images: [
      { src: "/misc/projects/td-wave.webp", alt: "Wave 1 under way on the spiral route" },
      { src: "/misc/projects/td-towers.webp", alt: "Choosing the ten towers to bring into a run" },
      { src: "/misc/projects/td-routes.webp", alt: "The route chooser, with board stats and difficulty" },
    ],
    sections: [
      {
        body: [
          "A 3D tower defense game in Three.js, with no framework and every sound synthesized live.",
          [
            "20 towers, each with two upgrade paths of four tiers",
            "28 enemy types and 11 random mutations",
            "20 maps and a 50-wave campaign",
            "bosses that split apart on death (Broodmother → 3 hydras → 6 blocks), shields, damage resistances, and hidden enemies most towers can't see",
          ],
        ],
      },
      {
        title: "Difficulty that changes the game",
        body: [
          "The four difficulties change the whole shape of the campaign, not just a stat multiplier. The top one, Ruin, takes away board space, sight and choices instead of adding health.",
          "Balance was tuned against measured win rates. Beating a route unlocks a sandbox mode.",
        ],
      },
    ],
    tech: ["JavaScript (ES modules, no framework)", "Three.js", "Web Audio API", "localStorage"],
  },

  // Bank App
  "10": {
    sections: [
      {
        body: [
          "A banking dashboard of about 2k lines, built with Next.js 16, React 19 and Tailwind, connected to a Go Fiber REST API. Users can register, log in, check their balance, deposit and withdraw, transfer money to other users by username, and search their transaction history. The Cards, Payments and Settings screens are UI only.",
        ],
      },
      {
        title: "Auth",
        body: [
          "Auth uses short-lived JWT access tokens plus refresh tokens. The API client refreshes the session silently when a token expires. If several requests fail at the same moment, they wait in a queue and retry once the new token comes back, instead of each one firing its own refresh call.",
        ],
      },
      {
        title: "Deployment",
        body: [
          "Every push to main runs GitHub Actions, which builds a multi-stage Docker image (running as a non-root user) and ships it to a VPS over SSH.",
        ],
      },
    ],
    tech: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Go Fiber", "JWT", "Docker", "GitHub Actions"],
  },

  // BPE
  "1": { images: [{ src: "/misc/projects/bpe.webp", alt: "BPE's item select window, item commands and signage picker" }] },

  // TR
  "2": { images: [{ src: "/misc/projects/tr.webp", alt: "TestRunner grading four student scripts" }] },

  // SCR ATO
  "4": { images: [{ src: "/misc/projects/scr-ato.webp", alt: "A train in Stepford County Railway" }] },

  // Graph IMG
  "5": { images: [{ src: "/misc/projects/graph-img.webp", alt: "A Graph IMG source file drawing waves, an island and a palm tree with inequalities" }] },

  // Website
  "6": {
    images: [
      { src: "/misc/projects/website-home.webp", alt: "This site's home page" },
      { src: "/misc/projects/website-projects.webp", alt: "The projects grid with tech filter chips" },
    ],
  },

  // MC SERVER (the same shots as the home, About and Contact banners)
  "8": {
    images: [
      { src: "/misc/mainslide/img2.webp", alt: "A glowing blue hall with the server's generator room" },
      { src: "/misc/mainslide/img1.webp", alt: "A pink-lit lounge built for the server" },
      { src: "/misc/mainslide/img3.webp", alt: "A lab corridor with green glass tanks" },
      { src: "/misc/mainslide/img4.webp", alt: "A long white sci-fi corridor" },
      { src: "/misc/mainslide/img5.webp", alt: "A white atrium around a glowing ore pillar" },
      { src: "/misc/mainslide/img6.webp", alt: "A neon purple lounge overlooking the map" },
      { src: "/misc/mainslide/img7.webp", alt: "A player in red armor by a red-lit glass tower" },
      { src: "/misc/mainslide/img8.webp", alt: "Players on a glowing blue walkway between server racks" },
    ],
  },
};
