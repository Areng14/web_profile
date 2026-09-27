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
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent/90">
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
                What I do
              </h2>
              <div className="space-y-4 text-slate-300 leading-relaxed">
                <p>
                  I build tools, games and apps, mostly for communities I&apos;m
                  part of. The biggest is BeePEE, a desktop editor for Portal
                  2&apos;s BEEmod that real people use, along with BeeBOT, the
                  Discord bot that keeps its server free of scams and triages its
                  crash reports.
                </p>
                <p>
                  I like projects where the hard part is under the hood: a model
                  pipeline that chains Java, Python and Valve&apos;s own compiler
                  behind one button, a math site whose tests generate thousands
                  of problems to keep the grader honest, or a railway sim with a
                  real interlocking.
                </p>
                <p>
                  Most of my work is in Python and JavaScript/TypeScript, with
                  some Java and Go. Everything is in the{" "}
                  <Link href="/#projects" className="text-accent underline-offset-2 hover:underline">
                    projects section
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div>
              <h2 className="mb-6 text-2xl font-bold text-white sm:text-3xl">
                Working together
              </h2>
              <p className="text-slate-300 leading-relaxed">
                I&apos;m open to interesting projects, especially ones close to
                what I&apos;ve built: desktop tools, web apps, Discord bots and
                game tooling. I might pass if I&apos;m busy. Reach me through the{" "}
                <Link href="/contact" className="text-accent underline-offset-2 hover:underline">
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
