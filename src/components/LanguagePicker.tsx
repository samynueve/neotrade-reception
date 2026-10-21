"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/lib/actions/locale";

/** Choix de la langue : gros boutons, chaque langue écrite dans sa propre langue. */
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: Locale) =>
    start(async () => {
      await setLocaleAction(l);
      router.refresh();
    });
  return (
    <div role="radiogroup" aria-label={t.settings.language} className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2"}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === locale}
          lang={l}
          disabled={pending}
          onClick={() => choose(l)}
          className={`btn px-2 ${compact ? "min-h-12 text-sm" : "min-h-14 text-base"} ${l === locale ? "border-brand-indigo bg-brand-indigo text-white" : "border-brand-indigo/30 bg-white text-brand-ink"}`}
        >
          {compact ? l.toUpperCase() : LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
