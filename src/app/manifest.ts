// In app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Assistant Offline",
    short_name: "AI Assistant",
    description: "An offline-first AI assistant using local STT and TTS.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192x192.png", // Ensure you have an icon at this path in /public
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png", // Ensure you have an icon at this path in /public
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
