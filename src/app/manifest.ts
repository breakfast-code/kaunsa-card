import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kaunsa Card?", short_name: "Kaunsa Card", description: "Find the best payment route before you pay.",
    start_url: "/", display: "standalone", background_color: "#faf9f4", theme_color: "#122219",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
