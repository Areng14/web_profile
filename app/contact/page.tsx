import { Metadata } from "next";
import Link from "next/link";
import CopyButton from "../components/CopyButton";
import ImageSlider from "../components/ImageSlider";
import { contact } from "../lib/content";

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: "Contact",
    description: "How to contact me",
  };
};

interface Method {
  label: string;
  value: string;
  icon: string;
  color: string;
  href?: string;
  copy?: boolean;
}

const banner = [
  "/misc/mainslide/img5.png",
  "/misc/mainslide/img6.png",
  "/misc/mainslide/img7.png",
  "/misc/mainslide/img8.png",
];

// Only the methods that are filled in
const methods = ([
  contact.email && {
    label: "Email",
    value: contact.email,
    icon: "/misc/contact/email.svg",
    color: "#0b70f5",
    href: `mailto:${contact.email}`,
  },
  contact.discord && {
    label: "Discord",
    value: contact.discord,
    icon: "/misc/contact/discord.svg",
    color: "#5865F2",
    copy: true,
  },
  contact.github && {
    label: "GitHub",
    value: `github.com/${contact.github}`,
    icon: "/misc/contact/github.svg",
    color: "#ffffff",
    href: `https://github.com/${contact.github}`,
  },
] as (Method | "")[]).filter((m): m is Method => Boolean(m));

export default function Contact() {
  return (
    <div className="min-h-screen">
      {/* Short banner instead of the full-screen hero */}
      <section className="relative flex h-[40vh] min-h-[280px] w-full flex-col justify-end">
        <ImageSlider imgs={banner} controls={false} />
        <div className="relative z-10 mx-auto w-full max-w-2xl px-6 pb-10 sm:px-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent/90">
            Get in touch
          </p>
          <h1 className="text-4xl font-bold text-white drop-shadow-lg sm:text-5xl">Contact</h1>
        </div>
      </section>

      <section className="border-t border-white/[0.06] py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-6 sm:px-8">
          <p className="text-slate-400">
            Got a project in mind or a question about something I&apos;ve built? Reach out
            wherever&apos;s easiest.
          </p>

          <ul className="mt-8 space-y-3">
            {methods.map((m) => {
              const row = (
                <>
                  {/* Top border in the method's color, curving with the card like the other cards */}
                  <span
                    className="pointer-events-none absolute inset-0 rounded-[11px] border-t-[3px] transition-[clip-path] duration-300 [clip-path:inset(0_88%_0_0)] group-hover:[clip-path:inset(0)]"
                    style={{ borderTopColor: m.color }}
                    aria-hidden
                  />
                  <span
                    className="block h-7 w-7 shrink-0"
                    style={{
                      backgroundColor: m.color,
                      WebkitMask: `url("${m.icon}") center / contain no-repeat`,
                      mask: `url("${m.icon}") center / contain no-repeat`,
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-500">{m.label}</span>
                    <span className="block truncate font-medium text-white">{m.value}</span>
                  </span>
                </>
              );
              const cardClass =
                "group relative flex items-center gap-4 overflow-hidden rounded-xl border border-white/[0.06] bg-card-bg p-5 transition-colors duration-200 hover:border-white/20";

              return (
                <li key={m.label}>
                  {m.href ? (
                    <a
                      href={m.href}
                      target={m.href.startsWith("http") ? "_blank" : undefined}
                      rel={m.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className={`${cardClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                    >
                      {row}
                      <svg
                        className="h-5 w-5 shrink-0 -translate-x-1 text-slate-600 transition-all duration-200 group-hover:translate-x-0 group-hover:text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6l6 6-6 6" />
                      </svg>
                    </a>
                  ) : (
                    <div className={cardClass}>
                      {row}
                      {m.copy && (
                        <CopyButton
                          text={m.value}
                          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-10 text-sm text-slate-500">
            Want to look around first? Check out my{" "}
            <Link href="/#projects" className="text-accent underline-offset-2 hover:underline">
              projects
            </Link>{" "}
            or the{" "}
            <Link href="/about" className="text-accent underline-offset-2 hover:underline">
              about
            </Link>{" "}
            page.
          </p>
        </div>
      </section>
    </div>
  );
}
