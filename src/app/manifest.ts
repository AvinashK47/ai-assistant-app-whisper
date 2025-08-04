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
        src: "/icon512_maskable.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon512_rounded.png", 
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
