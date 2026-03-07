import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ResponsiveAppBar from "./components/ResponsiveNavbar";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Areng T",
  description: "Software Engineer i think",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground min-h-screen`}
      >
        <div className="flex min-h-screen flex-col bg-[var(--background)] text-slate-50">
          <ResponsiveAppBar />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

