import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";
import { SiteNav } from "./components/SiteNav";
import { SiteFooter } from "./components/SiteFooter";
import { getProfile } from "@/lib/auth";

const libreCaslon = Libre_Caslon_Text({
  variable: "--font-libre-caslon",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Missions",
  description: "Get paid to flex your skills.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile().catch(() => null);
  return (
    <html
      lang="en"
      className={`${libreCaslon.variable} ${plexSans.variable} ${plexMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <SiteNav profile={profile} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
