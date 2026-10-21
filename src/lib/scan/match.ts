import type { PositionStatus } from "@prisma/client";
import { normalizeCode } from "@/lib/codes";

/**
 * Rapprochement d'un code-barres lu sur un colis avec les positions de la CMR.
 * Utilisé sur le téléphone (réponse immédiate, même hors ligne) et sur le serveur (qui fait foi à la synchro).
 *
 * Étiquette Amazon : code « 00340312892450832619 » (AI 00 + SSCC sur 18 chiffres).
 * La CMR n'en imprime que le début, « 00340312892450832 » (colonne ZEICHEN + NR) : on compare donc par préfixe.
 */
export type MatchPosition = {
  id: string;
  lineNumber: number;
  shipmentNumber: string;
  shipmentKey: string;
  printedNumber: string | null;
  packagesExpected: number;
  packagesReceived: number;
  isOffAddress: boolean;
  isGrouped: boolean;
};

export type MatchResult<P extends MatchPosition = MatchPosition> =
  | { kind: "position"; position: P; via: "N_IMPRIME" | "N_ENVOI"; ambiguous: boolean; surplus: boolean }
  | { kind: "duplicate"; position: P | null }
  | { kind: "unknown"; wrongBarcode: boolean };

const MIN_PREFIX = 12; // évite qu'un code court corresponde par hasard

/** Formes équivalentes d'un code lu : tel quel, et avec l'AI « 00 » que certaines douchettes retirent. */
export function codeVariants(normalized: string): string[] {
  const v = [normalized];
  if (/^\d{18}$/.test(normalized)) v.push(`00${normalized}`);
  return v;
}

function matchesPrinted(variants: string[], printed: string | null): boolean {
  if (!printed || printed.length < MIN_PREFIX) return false;
  return variants.some((c) => c === printed || c.startsWith(printed) || (c.length >= MIN_PREFIX && printed.startsWith(c)));
}

function matchesShipment(variants: string[], key: string): boolean {
  // Étiquettes K+N : le n° d'envoi (13 chiffres), parfois suivi d'un compteur de colis
  return key.length === 13 && variants.some((c) => c === key || (c.startsWith(key) && c.length <= key.length + 4));
}

export function matchCode<P extends MatchPosition>(
  raw: string,
  positions: P[],
  alreadyScanned: ReadonlySet<string>,
): { normalized: string; result: MatchResult<P> } {
  const normalized = normalizeCode(raw);
  const variants = codeVariants(normalized);

  let via: "N_IMPRIME" | "N_ENVOI" = "N_IMPRIME";
  let candidates = positions.filter((p) => matchesPrinted(variants, p.printedNumber));
  if (!candidates.length) {
    via = "N_ENVOI";
    candidates = positions.filter((p) => matchesShipment(variants, p.shipmentKey));
  }

  if (!candidates.length) {
    // Un code non numérique (ex. « LtFh5M3KM/204/vendor-returns/… ») n'est jamais celui de la CMR
    return { normalized, result: { kind: "unknown", wrongBarcode: !/^\d+$/.test(normalized) } };
  }

  // Une étiquette ne compte qu'une fois. Exception : les palettes d'un envoi groupé portent souvent la même étiquette K+N.
  if (alreadyScanned.has(normalized) && !(via === "N_ENVOI" && candidates.some((p) => p.isGrouped))) {
    return { normalized, result: { kind: "duplicate", position: candidates[0] } };
  }

  // Même n° imprimé sur plusieurs positions : on remplit d'abord celle qui attend encore des colis
  const remaining = (p: P) => p.packagesExpected - p.packagesReceived;
  const ordered = [...candidates].sort((a, b) => Number(remaining(b) > 0) - Number(remaining(a) > 0) || a.lineNumber - b.lineNumber);
  const position = ordered[0];
  return {
    normalized,
    result: { kind: "position", position, via, ambiguous: candidates.length > 1, surplus: remaining(position) <= 0 },
  };
}

/** Statut d'une position d'après les colis comptés. « Manquant » n'est posé qu'à la clôture. */
export function positionStatus(received: number, expected: number, isOffAddress: boolean): PositionStatus {
  if (isOffAddress) return "HORS_ADRESSE";
  if (received <= 0) return "ATTENDU";
  return received < expected ? "PARTIEL" : "RECU";
}
