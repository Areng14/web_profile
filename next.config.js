/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Browser games are static files in public/games/<name>; serve each one's
  // index.html at a clean URL. Their pages set <base href> so relative assets
  // resolve from the game's folder.
  async rewrites() {
    return [
      { source: "/games/td", destination: "/games/td/index.html" },
      { source: "/games/signalling", destination: "/games/signalling/index.html" },
    ];
  },
};

module.exports = nextConfig;
