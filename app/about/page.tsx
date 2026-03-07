import { Metadata } from "next";
import Link from "next/link";
import ImageSlider from "../components/ImageSlider";

const images: string[] = [
  "/misc/mainslide/img5.png",
  "/misc/mainslide/img6.png",
  "/misc/mainslide/img7.png",
  "/misc/mainslide/img8.png",
];

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: "About",
    description: "About me",
  };
};

export default function About() {
  return (
    <div className="min-h-screen">
      {/* Hero with slider - same padding as home */}
      <section className="relative flex h-screen min-h-[500px] w-full flex-col justify-end">
        <ImageSlider imgs={images} />
        <div className="relative z-10 mx-auto w-full max-w-[1600px] px-8 pb-40 pt-28 sm:px-12 sm:pb-44 sm:pt-32 lg:px-20 lg:pb-52 lg:pt-40 pointer-events-none">
          <div className="max-w-2xl pointer-events-auto">
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-amber-400/90">
              Get to know me
            </p>
            <h1 className="mb-3 text-4xl font-bold leading-tight text-white drop-shadow-lg sm:text-5xl md:text-6xl">
              About
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-slate-300 drop-shadow sm:text-lg">
              tl;dr I&apos;m a software developer who makes programs that might be useful in my free time.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="border-t border-slate-800/80 bg-slate-950/50 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-3xl space-y-14">
            <div>
              <h2 className="mb-6 text-2xl font-bold text-white sm:text-3xl">
                Story
              </h2>
              <div className="space-y-4 text-slate-300 leading-relaxed">
                <p>
                  Since the age of 12, I have been interested in computers and
                  technology. I started off with learning Python as my first
                  language, which is why you see a lot of{" "}
                  <Link
                    href="/projects?search=Python"
                    className="text-amber-400 underline-offset-2 hover:underline"
                  >
                    Python projects
                  </Link>{" "}
                  on the projects page. My first program was a temporary file
                  remover. It was a simple program that goes through temporary
                  directories and removes the files to free up space.
                </p>
                <p>
                  My second program was a{" "}
                  <Link
                    href="https://github.com/Areng14/Fizzler-Recolor/"
                    className="text-amber-400 underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fizzler Recolorer
                  </Link>{" "}
                  for the game Portal 2. It was a program that can recolor the
                  fizzler in the game. It works by changing the VMT (Valve
                  Material) color value to the selected color. It didn&apos;t have
                  a GUI so you had to use the command line to use it.
                </p>
                <p>
                  I have since been learning new languages and frameworks to
                  expand my knowledge. I have recently been learning React and
                  other JS frameworks and JavaScript overall. One of the more
                  recent projects I have worked on was{" "}
                  <Link
                    href="https://github.com/Areng14/testrunner/"
                    className="text-amber-400 underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    TestRunner
                  </Link>
                  , which is a program that runs tests on multiple Python scripts
                  and checks if they match the expected output. The program
                  features a security measure where if the program does something
                  suspicious, it will warn the user.
                </p>
                <p>
                  In conclusion, I am a software developer who makes programs in
                  my free time. I make programs that have a range of purposes,
                  from being useless to being kinda useful. Check out my{" "}
                  <Link href="/projects" className="text-amber-400 underline-offset-2 hover:underline">
                    projects page
                  </Link>{" "}
                  to see what I have made.
                </p>
              </div>
            </div>

            <div>
              <h2 className="mb-6 text-2xl font-bold text-white sm:text-3xl">
                Why me?
              </h2>
              <p className="text-slate-300 leading-relaxed">
                I am open to work on projects that are interesting but not too
                challenging. Keep in mind that I may choose to not work on a
                project if I am busy. I am mainly open to work on projects that
                are related to what I have done before or are similar to what I
                have done before. Stuff like AI I will not work on as I have no
                experience in that field. To contact me, go to the{" "}
                <Link href="/contact" className="text-amber-400 underline-offset-2 hover:underline">
                  contact page
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
