import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChatFlow",
    short_name: "ChatFlow",
    description: "Central interna de atendimento com PostgreSQL, API própria e Evolution API.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f8fb",
    theme_color: "#1A1C32",
    lang: "pt-BR",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/favicon.ico",
        sizes: "64x64",
        type: "image/x-icon",
      },
      {
        src: "/favicon.ico",
        sizes: "128x128",
        type: "image/x-icon",
      },
    ],
  };
}
