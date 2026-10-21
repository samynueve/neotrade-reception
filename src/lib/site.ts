/** Société et site de réception. */
export const SITE = {
  name: "NEOTRADE",
  company: "SAS KASMI",
  street: "2 rue de Pâques",
  zip: "62138",
  city: "Douvrin",
} as const;

/** Valeurs par défaut des camions Kuehne+Nagel. */
export const KN_DEFAULTS = {
  carrier: "Kuehne+Nagel",
  agency: "Hauneck",
  relation: "X085",
} as const;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

/**
 * Une position est « hors adresse » si elle n'est pas livrée à Douvrin (ex. Loos-en-Gohelle).
 * Sans code postal ni ville, on ne peut pas conclure : elle est considérée comme livrée ici.
 */
export function isOffAddress(zip?: string | null, city?: string | null): boolean {
  const z = zip?.replace(/\D/g, "") ?? "";
  const c = city ? fold(city) : "";
  if (!z && !c) return false;
  if (z) return z !== SITE.zip;
  return !c.includes(fold(SITE.city));
}
