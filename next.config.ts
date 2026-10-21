import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le service worker doit toujours être relu pour que les mises à jour arrivent sur les téléphones
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
