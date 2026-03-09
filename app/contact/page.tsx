import { Metadata } from "next";
import ImageSlider from "../components/ImageSlider";
import Link from "next/link";

const images: string[] = [
  "/misc/mainslide/img5.png",
  "/misc/mainslide/img6.png",
  "/misc/mainslide/img7.png",
  "/misc/mainslide/img8.png",
];

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: "Contact",
    description: "How to contact me",
  };
};

export default function Contact() {
  return (
    <div className="min-h-screen">
      {/* Hero with slider - same padding as home */}
      <section className="relative flex h-screen min-h-[500px] w-full flex-col justify-end">
        <ImageSlider imgs={images} />
        <div className="relative z-10 mx-auto w-full max-w-[1600px] px-8 pb-40 pt-28 sm:px-12 sm:pb-44 sm:pt-32 lg:px-20 lg:pb-52 lg:pt-40 pointer-events-none">
          <div className="max-w-2xl pointer-events-auto">
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent/90">
              Get in touch
            </p>
            <h1 className="mb-3 text-4xl font-bold leading-tight text-white drop-shadow-lg sm:text-5xl md:text-6xl">
              Contact
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-slate-300 drop-shadow sm:text-lg">
              I am mainly active on Discord, and I check my email every now and then.
              Choose whatever way is most convenient for you.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="border-t border-slate-800/80 bg-slate-950/50 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-2xl space-y-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Ways to reach me
            </h2>
            <div className="space-y-6 rounded-2xl border border-slate-700/80 bg-slate-800/30 p-6 sm:p-8">
              <p className="text-slate-300">
                You can reach out via Discord or email. I check both periodically.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/50 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/80"
                >
                  Discord
                </a>
                <a
                  href="mailto:your@email.com"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/50 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/80"
                >
                  Email
                </a>
              </div>
              <p className="text-sm text-slate-500">
                Prefer to browse first? Check out my{" "}
                <Link href="/projects" className="text-accent underline-offset-2 hover:underline">
                  projects
                </Link>{" "}
                or{" "}
                <Link href="/about" className="text-accent underline-offset-2 hover:underline">
                  about
                </Link>{" "}
                page.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
