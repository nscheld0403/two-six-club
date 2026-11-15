import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

/** Web app manifest: lets "Add to Home Screen" open the club as a standalone app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: brand.name,
    short_name: brand.shortName,
    description: brand.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.backgroundColor,
    theme_color: brand.backgroundColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
