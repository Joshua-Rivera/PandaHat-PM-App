import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";

import { AppShell } from "@/components/shell/AppShell";

import "./globals.css";
import { Providers } from "./providers";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-space-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PandaHat Research Operations", template: "%s · PandaHat" },
  description: "Research projects, learning paths, availability and tasks for the PandaHat research group.",
  icons: { icon: { url: "/pandahat-logo.webp", type: "image/webp" } },
};

export const viewport: Viewport = { themeColor: "#ececeb", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
