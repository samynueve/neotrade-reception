import type { Dict } from "@/i18n/dictionaries/fr";

/** Traduit un code d'erreur renvoyé par le serveur ; texte générique si le code est inconnu. */
export function errorText(t: Dict, code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return (t.errors as Record<string, string>)[code] ?? t.common.unknownError;
}
