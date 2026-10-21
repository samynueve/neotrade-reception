import type { Dict } from "@/i18n/dictionaries/fr";
import type { Fmt } from "@/i18n/format";

/**
 * Contrôles d'une CMR : un code et des paramètres, traduits à l'affichage (la fiche s'affiche dans la langue
 * de chaque utilisateur, quelle que soit la langue de celui qui a importé la CMR).
 */
export const CHECK_CODES = [
  "no_cmr",
  "no_positions",
  "no_list_number",
  "totals_unread",
  "pkg_ok",
  "pkg_bad",
  "kg_ok",
  "kg_bad",
  "eur_ok",
  "eur_bad",
  "bad_shipment",
  "off_address",
  "grouped",
  "dup_shipment",
  "dup_printed",
  "no_fa",
  "fa_reise",
  "fa_barcode",
  "plates_differ",
  "no_seals",
  "seals",
  "fa_ok",
  "fa_missing",
  "fa_extra",
  "fa_mismatch",
  "handwritten",
  "doubt",
  "duplicate_list",
  "dispute_found",
] as const;

export type CheckCode = (typeof CHECK_CODES)[number];
export type CheckLevel = "ok" | "warn" | "error";
export type CheckParams = Record<string, string | number | null>;
export type Check = { level: CheckLevel; code: CheckCode; params?: CheckParams };

export function checkText(t: Dict, check: Check, f: Fmt): string {
  const render = t.checks[check.code] as (p: CheckParams, f: Fmt) => string;
  return render(check.params ?? {}, f);
}

/** Lecture tolérante des contrôles stockés en base (JSON). */
export function parseChecks(value: unknown): Check[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is Check => !!c && typeof c === "object" && (CHECK_CODES as readonly string[]).includes((c as Check).code) && ["ok", "warn", "error"].includes((c as Check).level),
  );
}
