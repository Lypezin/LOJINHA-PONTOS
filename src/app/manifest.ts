import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lojinha EntreGô",
    short_name: "Lojinha",
    description: "Seus pedidos viram pontos. Seus pontos viram conquistas.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#2c67ea",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
