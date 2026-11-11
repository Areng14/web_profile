import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { ProjectImage } from "../types";

// The site's content lives in two tables. Two tiny ones back the rate limiter and
// admin bookkeeping.
// The matching CREATE TABLE statements are in ./setup.ts.

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull(),
  // A path under /public or an SVG data URI, drawn as a flat silhouette in `color`
  icon: text("icon").notNull().default(""),
  type: text("type").notNull(),
  position: integer("position").notNull().default(0),
  // Set when moved to the trash; trashed rows are hidden from the site
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default(""),
  platform: text("platform").notNull().default(""),
  description: text("description").notNull().default(""),
  repo: text("repo").notNull().default(""),
  playUrl: text("play_url").notNull().default(""),
  hasUsers: boolean("has_users").notNull().default(false),
  prototype: boolean("prototype").notNull().default(false),
  graveyard: boolean("graveyard").notNull().default(false),
  causeOfDeath: text("cause_of_death").notNull().default(""),
  skillIds: text("skill_ids").array().notNull().default(sql`'{}'::text[]`),
  stack: text("stack").array().notNull().default(sql`'{}'::text[]`),
  // Markdown
  writeup: text("writeup").notNull().default(""),
  images: jsonb("images").$type<ProjectImage[]>().notNull().default(sql`'[]'::jsonb`),
  position: integer("position").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

// Key/value bookkeeping: "seeded" (launch content was copied in once) and
// "sessions_valid_after" (signing out ends every session issued before it)
export const adminSettings = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
