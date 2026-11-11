import ReactMarkdown, { type Components } from "react-markdown";

// Project writeups are Markdown. Raw HTML in the source is ignored (react-markdown's
// default), so a writeup can't inject markup into the page.

const components: Components = {
  h1: ({ children }) => <h2 className="mb-3 mt-10 text-2xl font-bold text-white first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="mb-3 mt-10 text-2xl font-bold text-white first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-8 text-xl font-semibold text-white first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="mt-4 leading-relaxed text-slate-300 first:mt-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mt-4 list-disc space-y-1.5 pl-5 leading-relaxed text-slate-300 marker:text-slate-600">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal space-y-1.5 pl-5 leading-relaxed text-slate-300 marker:text-slate-500">{children}</ol>
  ),
  a: ({ href, children }) => {
    const external = Boolean(href && /^https?:\/\//.test(href));
    return (
      <a
        href={href}
        className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.9em] text-slate-200">{children}</code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 border-white/10 pl-4 text-slate-400">{children}</blockquote>
  ),
  hr: () => <hr className="my-8 border-white/[0.06]" />,
  // Images belong in the screenshots column
  img: () => null,
};

export default function Markdown({ children }: { children: string }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
}
