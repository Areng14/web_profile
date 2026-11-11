This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Content and the admin panel

Projects and skills live in Postgres (Neon) and are edited at `/admin`. Public
pages read through Next's data cache and refresh when you save in the panel.

`npm run build` runs `scripts/db-setup.ts` first: it creates the tables if they
don't exist and copies in the launch content from `app/lib/content.ts` and
`app/lib/details.ts` once. Without `DATABASE_URL` (local dev) the site serves
that seed content directly and the admin panel is unavailable.

Environment variables (keep the GitHub ones Production-only, so preview builds can't sign anyone in):

| Variable | What it's for |
| --- | --- |
| `DATABASE_URL` | Neon, added by the Vercel integration |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob, for screenshot uploads |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app, callback `https://arengdev.com/api/admin/auth/callback` |
| `SESSION_SECRET` | Optional. Signs admin sessions; derived from the OAuth secret if unset |

Only one GitHub account (id in `app/lib/admin/session.ts`) can sign in.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
