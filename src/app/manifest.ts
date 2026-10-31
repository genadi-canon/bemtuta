import type { MetadataRoute } from "next";

// Lets phones install the site to the home screen and open it full screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "במטותא · Bematuta",
    short_name: "במטותא",
    description: "כל משימה קטנה, מישהו מהשכונה שמגיע היום",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "he",
    background_color: "#fafaf9",
    theme_color: "#0f766e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "פרסום משימה", url: "/tasks/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "המשימות שלי", url: "/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
