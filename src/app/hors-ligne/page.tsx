import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.offline.title };
}

/** Page affichée par le service worker quand une page n'est pas en cache et qu'il n'y a pas de réseau. */
export default async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <svg aria-hidden viewBox="0 0 24 24" className="size-16 text-brand-indigo" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />
      </svg>
      <h1 className="text-2xl font-extrabold">{t.offline.title}</h1>
      <p className="text-lg">{t.offline.text}</p>
      <a href="/" className="btn-primary w-full">
        {t.offline.retry}
      </a>
    </main>
  );
}
