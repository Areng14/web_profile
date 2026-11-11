import { setupDatabase } from "../app/lib/db/setup";

// Runs before `next build` (see package.json). Without a database (local dev, or a
// deploy before Neon is connected) it does nothing and the site serves the seed data.

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  console.log("db-setup: no DATABASE_URL, skipping");
} else {
  setupDatabase(url)
    .then(() => console.log("db-setup: database ready"))
    .catch((err) => {
      console.error("db-setup failed:", err);
      process.exit(1);
    });
}
