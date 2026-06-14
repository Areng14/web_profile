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

## Content (serverless)

This site is fully serverless — there is no separate backend to run. All
projects and skills live in [`app/lib/content.ts`](app/lib/content.ts). Edit
that file to add or change content; the public pages read from it directly.

Skill icons can be a path under `/public` (e.g. `/misc/skills/python.svg`), an
absolute URL, or a base64 data URI. To turn an SVG/image into a base64 data
URI, POST it to the serverless route at `/api/upload`.

The route is protected by a shared secret. Set `UPLOAD_SECRET` in your
environment (e.g. an `.env.local` file locally, or project env vars on Vercel)
and pass it as a `Bearer` token. If `UPLOAD_SECRET` is unset the route is
disabled and returns `503`.

```bash
# multipart upload
curl -H "Authorization: Bearer $UPLOAD_SECRET" \
  -F "file=@icon.svg" http://localhost:3000/api/upload

# or JSON
curl -H "Authorization: Bearer $UPLOAD_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name":"icon.svg","data":"<base64>"}' \
  http://localhost:3000/api/upload
```

The response includes a `dataUri` you can paste straight into `content.ts`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
