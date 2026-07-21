import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prosthesis",
    short_name: "Prosthesis",
    description: "Tell me things. I keep them, no matter what.",
    start_url: "/",
    display: "standalone",
    // Web app manifests can't media-query color scheme, so the splash screen
    // is light-only — a known platform limitation (§5.6 dark mode ships
    // everywhere else via tokens + per-scheme theme-color in layout.tsx).
    background_color: "#faf6ef",
    theme_color: "#faf6ef",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
