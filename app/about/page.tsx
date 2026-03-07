// app/about/page.tsx
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
    <div>
      <section className="relative flex min-h-screen items-center">
        <ImageSlider imgs={images} />
        <div className="z-10 mx-auto flex w-full max-w-[1600px] px-4 py-8">
          <div className="max-w-xl space-y-6">
            <h1 className="break-words text-4xl font-bold md:text-5xl">
              About
            </h1>
            <p className="max-w-[60%] text-sm text-slate-200 md:max-w-[50%] md:text-base">
              A long essay about myself. tl;dr I&apos;m a software developer who
              makes programs that might be useful in my free time.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="pt-16">
        <div className="mx-auto max-w-[1600px] px-4">
          <div className="w-[90%] space-y-8">
            <div>
              <h2 className="pb-4 text-4xl font-bold sm:text-6xl">Story</h2>
              <p className="pl-4 text-slate-200">
                Since the age of 12, I have been interested in computers and
                technology. I started off with learning Python as my first
                language, which is why you see a lot of{" "}
                <Link
                  href="/projects?search=Python"
                  className="text-sky-400 underline-offset-2 hover:underline"
                >
                  Python projects
                </Link>{" "}
                on the projects page. My first program was a temporary file
                remover. It was a simple program that goes through temporary
                directories and removes the files to free up space.
                <br />
                <br />
                My second program was a{" "}
                <Link
                  href="https://github.com/Areng14/Fizzler-Recolor/"
                  className="text-sky-400 underline-offset-2 hover:underline"
                >
                  Fizzler Recolorer
                </Link>{" "}
                for the game Portal 2. It was a program that can recolor the
                fizzler in the game. It works by changing the VMT (Valve
                Material) color value to the selected color. It didn&apos;t have
                a GUI so you had to use the command line to use it.
                <br />
                <br />
                I have since been learning new languages and frameworks to
                expand my knowledge. I have recently been learning React and
                other JS frameworks and JavaScript overall. One of the more
                recent projects I have worked on was{" "}
                <Link
                  href="https://github.com/Areng14/testrunner/"
                  className="text-sky-400 underline-offset-2 hover:underline"
                >
                  TestRunner
                </Link>
                , which is a program that runs tests on multiple Python scripts
                and checks if they match the expected output. The program
                features a security measure where if the program does something
                suspicious, it will warn the user.
                <br />
                <br />
                In conclusion, I am a software developer who makes programs in
                my free time. I make programs that have a range of purposes,
                from being useless to being kinda useful. Check out my projects
                page to see what I have made.
              </p>
            </div>

            <div>
              <h2 className="pb-4 pt-8 text-4xl font-bold sm:text-6xl">
                Why me?
              </h2>
              <p className="pl-4 text-slate-200">
                I am open to work on projects that are interesting but not too
                challenging. Keep in mind that I may choose to not work on a
                project if I am busy. I am mainly open to work on projects that
                are related to what I have done before or are similar to what I
                have done before. Stuff like AI I will not work on as I have no
                experience in that field. To contact me, go to the contact page
                or click this{" "}
                <Link
                  href="/contact"
                  className="text-sky-400 underline-offset-2 hover:underline"
                >
                  link
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

