import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Cinzel, Inter } from "next/font/google";
import { brand } from "@/config/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-barlow",
  display: "swap",
});
/** Brand serif: headings and wordmark (matches the club plaque). */
const cinzel = Cinzel({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cinzel", display: "swap" });

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  applicationName: brand.name,
  description: "Members-only training app.",
  robots: { index: false, follow: false },
  // iPhone "Add to Home Screen": full-screen app, short label under the icon.
  appleWebApp: {
    capable: true,
    title: brand.shortName,
    statusBarStyle: "black",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: brand.backgroundColor,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable} ${cinzel.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
