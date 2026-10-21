import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SyncAgent } from "@/components/SyncAgent";
import { I18nProvider } from "@/i18n/client";
import { LOCALE_DIR } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.app.name, template: `%s | ${t.app.short} NEOTRADE` },
    description: t.app.description,
    applicationName: `${t.app.short} NEOTRADE`,
    appleWebApp: { capable: true, title: t.app.short, statusBarStyle: "black-translucent" },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
    formatDetection: { telephone: false }, // les n° d'envoi ne doivent pas devenir des liens d'appel sur iPhone
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#24234B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  return (
    <html lang={locale} dir={LOCALE_DIR[locale]}>
      <body className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-white focus:p-3 focus:font-bold">
          {t.app.skip}
        </a>
        <I18nProvider locale={locale}>
          {children}
          <ServiceWorkerRegister />
          <SyncAgent />
        </I18nProvider>
      </body>
    </html>
  );
}
