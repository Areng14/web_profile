const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy. The site loads nothing from other hosts except uploaded
// screenshots in Vercel Blob. Next's prerendered pages need inline scripts, so scripts
// are limited to this site plus inline; the games get tighter or game-specific rules.
const common = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "manifest-src 'self'",
];

const csp = (...extra) => [...common, ...extra].join("; ");

const siteCsp = csp(
  // Dev needs eval for fast refresh
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
);

// Plain JS games: module scripts from their own folder, nothing inline
const jsGameCsp = csp("script-src 'self'", "img-src 'self' data: blob:", "connect-src 'self'", "media-src 'self' blob:");

// Unity WebGL: an inline bootstrap, a decompressed framework run from a blob: URL, and wasm
const unityCsp = csp(
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "img-src 'self' data: blob:",
  "connect-src 'self' blob: data:",
  "media-src 'self' blob:",
);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The only next/image use is the 32px navbar icon; don't run a resizer anyone can call
  images: { unoptimized: true },

  // Browser games are static files in public/games/<name>; serve each one's
  // index.html at a clean URL. Their pages set <base href> so relative assets
  // resolve from the game's folder.
  async rewrites() {
    return [
      { source: "/games/td", destination: "/games/td/index.html" },
      { source: "/games/signalling", destination: "/games/signalling/index.html" },
      { source: "/games/traffic-sim", destination: "/games/traffic-sim/index.html" },
    ];
  },

  // Projects live on the home page; keep old links (and their filters) working
  async redirects() {
    return [{ source: "/projects", destination: "/#projects", permanent: true }];
  },

  async headers() {
    // Each path gets exactly one CSP: the site's, or its game's
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/((?!games/).*)", headers: [{ key: "Content-Security-Policy", value: siteCsp }] },
      ...["td", "signalling"].flatMap((game) => [
        { source: `/games/${game}`, headers: [{ key: "Content-Security-Policy", value: jsGameCsp }] },
        { source: `/games/${game}/:path*`, headers: [{ key: "Content-Security-Policy", value: jsGameCsp }] },
      ]),
      { source: "/games/traffic-sim", headers: [{ key: "Content-Security-Policy", value: unityCsp }] },
      { source: "/games/traffic-sim/:path*", headers: [{ key: "Content-Security-Policy", value: unityCsp }] },
    ];
  },
};

module.exports = nextConfig;
