/**
 * Langues de l'application. Ajouter une langue : un fichier dans dictionaries/ (typé Dict, le compilateur
 * signale toute traduction manquante), puis l'ajouter ici.
 */
export const LOCALES = ["fr", "en", "de", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "lang";

/** Nom de chaque langue dans sa propre langue (sélecteur). */
export const LOCALE_NAMES: Record<Locale, string> = { fr: "Français", en: "English", de: "Deutsch", ar: "العربية" };

/** Arabe : sens de lecture de droite à gauche, chiffres latins (codes-barres, poids, n° d'envoi). */
export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = { fr: "ltr", en: "ltr", de: "ltr", ar: "rtl" };
export const INTL_LOCALE: Record<Locale, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", ar: "ar-u-nu-latn" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Langue préférée du navigateur (en-tête Accept-Language), sinon français. */
export function matchAcceptLanguage(header: string | null | undefined): Locale {
  for (const part of (header ?? "").split(",")) {
    const code = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}
