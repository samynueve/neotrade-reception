import type { MetadataRoute } from "next";
import { getI18n } from "@/i18n/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { locale, t } = await getI18n();
  return {
    id: "/",
    name: t.app.name,
    short_name: t.app.short,
    description: t.app.description,
    lang: locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#24234B",
    theme_color: "#24234B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
