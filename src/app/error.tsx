"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

/** Erreur inattendue d'une page : message clair et bouton pour réessayer (les scans restent dans le téléphone). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-extrabold">{t.errorPage.title}</h1>
      <p className="text-lg">{t.errorPage.text}</p>
      <button type="button" onClick={reset} className="btn-primary w-full">
        {t.errorPage.retry}
      </button>
    </main>
  );
}
