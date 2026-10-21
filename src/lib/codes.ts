/**
 * Normalisation des codes lus à quai.
 * - n° d'envoi K+N « 362/000/4659205 » → « 3620004659205 » (chiffres seuls)
 * - code-barres lu : suppression du préfixe de symbologie (]C1, ]d2…), des séparateurs GS1 et des espaces
 */
export function shipmentKey(shipmentNumber: string): string {
  return shipmentNumber.replace(/\D/g, "");
}

export function normalizeCode(raw: string): string {
  return raw
    .trim()
    .replace(/^\][A-Za-z]\d/, "") // identifiant de symbologie AIM
    .replace(/[\x00-\x1f\s/.-]/g, "") // FNC1 / GS, espaces et séparateurs
    .toUpperCase();
}

/** Remet en forme un n° d'envoi saisi sans séparateurs (13 chiffres) : 3620004659205 → 362/000/4659205. */
export function formatShipmentNumber(input: string): string {
  const d = shipmentKey(input);
  return d.length === 13 ? `${d.slice(0, 3)}/${d.slice(3, 6)}/${d.slice(6)}` : input.trim();
}
