import { formatShipmentNumber, normalizeCode, shipmentKey } from "@/lib/codes";
import { isOffAddress } from "@/lib/site";
import type { Check, CheckLevel } from "./checks";

export type { Check, CheckLevel } from "./checks";
import type { Extraction } from "./schema";

/** Réception pré-remplie à partir des photos, modifiable par l'utilisateur avant création. */
export type PositionDraft = {
  lineNumber: number;
  shipmentNumber: string;
  printedNumber: string | null;
  description: string | null;
  shipper: string | null;
  shipperZip: string | null;
  shipperCity: string | null;
  consigneeName: string | null;
  deliveryStreet: string | null;
  deliveryZip: string | null;
  deliveryCity: string | null;
  packagesExpected: number;
  packagingType: string | null;
  weightKg: number;
  valueEur: number | null;
  borderoNumbers: string[];
  isGrouped: boolean;
};

export type ReceptionDraft = {
  loadingListNumber: string | null;
  relation: string | null;
  tripNumber: string | null;
  documentDate: string | null; // AAAA-MM-JJTHH:MM, heure de Paris
  vehiclePlate: string | null;
  trailerPlate: string | null;
  sealsExpected: string[];
  subcontractor: string | null;
  expectedPackages: number | null;
  expectedWeightKg: number | null;
  expectedValueEur: number | null;
  positions: PositionDraft[];
  handwrittenNotes: { text: string; declaredMissingPackages: number | null }[];
};


const round2 = (n: number) => Math.round(n * 100) / 100;
const clean = (s: string | null | undefined) => {
  const v = s?.replace(/\s+/g, " ").trim();
  return v ? v : null;
};
const plate = (s: string | null | undefined) => clean(s)?.toUpperCase() ?? null;
const samePlate = (a: string | null, b: string | null) => !a || !b || a.replace(/[\s-]/g, "") === b.replace(/[\s-]/g, "");

/** « 25 Missing Box », « manque 3 colis », « 2 fehlen » → nombre de colis annoncés manquants. */
export function declaredMissing(note: string): number | null {
  const m =
    /(\d+)\s*(?:x\s*)?(?:missing|manq|fehl|colis manquants?)/i.exec(note) ??
    /(?:missing|manque(?:nt)?|fehlen?)\s*:?\s*(\d+)/i.exec(note);
  return m ? Number(m[1]) : null;
}

const SHIPMENT_RE = /^\d{3}\/\d{3}\/\d{7}$/;

/** Construit la réception pré-remplie et la liste des contrôles à afficher avant validation. */
export function analyzeExtraction(x: Extraction): { draft: ReceptionDraft; checks: Check[] } {
  const checks: Check[] = [];
  const L = x.ladeliste;
  const F = x.fahrauftrag;

  const positions: PositionDraft[] = (L?.positions ?? []).map((p, i) => {
    const printed = p.printedNumber ? normalizeCode(p.printedNumber) : null;
    return {
      lineNumber: p.pos || i + 1,
      shipmentNumber: formatShipmentNumber(p.shipmentNumber),
      printedNumber: printed || null,
      description: clean(p.description),
      shipper: clean(p.shipper.name),
      shipperZip: clean(p.shipper.zip),
      shipperCity: clean(p.shipper.city),
      consigneeName: clean(p.consignee.name),
      deliveryStreet: clean(p.consignee.street),
      deliveryZip: clean(p.consignee.zip),
      deliveryCity: clean(p.consignee.city),
      packagesExpected: p.packages,
      packagingType: clean(p.packagingType),
      weightKg: round2(p.weightKg),
      valueEur: p.valueEur == null ? null : round2(p.valueEur),
      borderoNumbers: p.borderoRefs.map((b) => b.replace(/\D/g, "")).filter(Boolean),
      isGrouped: p.packages > 1 || p.borderoRefs.length > 0,
    };
  });

  const listNumber = clean(L?.loadingListNumber)?.replace(/\s/g, "") ?? null;
  const [listTrip, listBordero] = listNumber?.split("/") ?? [];

  const draft: ReceptionDraft = {
    loadingListNumber: listNumber,
    relation: clean(L?.relation),
    tripNumber: clean(F?.reise) ?? listTrip ?? null,
    documentDate: L?.issuedAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(L.issuedAt) ? L.issuedAt : F?.date ? `${F.date}T00:00` : null,
    vehiclePlate: plate(F?.vehiclePlate) ?? plate(L?.truckPlate),
    trailerPlate: plate(F?.trailerPlate) ?? plate(L?.trailerPlate),
    sealsExpected: [...new Set((F?.seals ?? []).map((s) => s.replace(/\s/g, "").toUpperCase()).filter(Boolean))],
    subcontractor: clean(F?.subcontractor),
    expectedPackages: L?.totalPackages ?? null,
    expectedWeightKg: L?.totalWeightKg ?? F?.totalWeightKg ?? null,
    expectedValueEur: L?.totalValueEur ?? null,
    positions,
    handwrittenNotes: x.handwrittenNotes.map((t) => ({ text: t.trim(), declaredMissingPackages: declaredMissing(t) })).filter((n) => n.text),
  };

  // --- Documents présents ---
  if (!L) checks.push({ level: "error", code: "no_cmr" });
  else if (!positions.length) checks.push({ level: "error", code: "no_positions" });
  if (!listNumber) checks.push({ level: "warn", code: "no_list_number" });

  // --- Totaux : la somme des positions doit retomber sur ENDSUMMEN / W-WERT ---
  if (L && positions.length) {
    const sumPkg = positions.reduce((s, p) => s + p.packagesExpected, 0);
    const sumKg = round2(positions.reduce((s, p) => s + p.weightKg, 0));
    const sumEur = round2(positions.reduce((s, p) => s + (p.valueEur ?? 0), 0));
    if (L.totalPackages == null || L.totalWeightKg == null) {
      checks.push({ level: "warn", code: "totals_unread" });
    }
    if (L.totalPackages != null) {
      checks.push(
        sumPkg === L.totalPackages
          ? { level: "ok", code: "pkg_ok", params: { sum: sumPkg, total: L.totalPackages } }
          : { level: "error", code: "pkg_bad", params: { sum: sumPkg, total: L.totalPackages } },
      );
    }
    if (L.totalWeightKg != null) {
      checks.push(
        Math.abs(sumKg - L.totalWeightKg) < 0.05
          ? { level: "ok", code: "kg_ok", params: { sum: sumKg, total: L.totalWeightKg } }
          : { level: "error", code: "kg_bad", params: { sum: sumKg, total: L.totalWeightKg } },
      );
    }
    if (L.totalValueEur != null) {
      checks.push(
        Math.abs(sumEur - L.totalValueEur) < 0.01
          ? { level: "ok", code: "eur_ok", params: { sum: sumEur, total: L.totalValueEur } }
          : { level: "warn", code: "eur_bad", params: { sum: sumEur, total: L.totalValueEur } },
      );
    }
  }

  // --- Positions ---
  const byShipment = new Map<string, number[]>();
  const byPrinted = new Map<string, number[]>();
  for (const p of positions) {
    if (!SHIPMENT_RE.test(p.shipmentNumber)) checks.push({ level: "warn", code: "bad_shipment", params: { line: p.lineNumber, value: p.shipmentNumber } });
    byShipment.set(shipmentKey(p.shipmentNumber), [...(byShipment.get(shipmentKey(p.shipmentNumber)) ?? []), p.lineNumber]);
    if (p.printedNumber) byPrinted.set(p.printedNumber, [...(byPrinted.get(p.printedNumber) ?? []), p.lineNumber]);
    if (isOffAddress(p.deliveryZip, p.deliveryCity)) {
      checks.push({ level: "warn", code: "off_address", params: { line: p.lineNumber, shipment: p.shipmentNumber, city: p.deliveryCity ?? p.deliveryZip } });
    }
    if (p.isGrouped && p.packagesExpected > 1) {
      checks.push({ level: "ok", code: "grouped", params: { line: p.lineNumber, count: p.packagesExpected, type: p.packagingType, bordero: [...new Set(p.borderoNumbers)].join(", ") || null } });
    }
  }
  for (const [, lines] of byShipment) if (lines.length > 1) checks.push({ level: "warn", code: "dup_shipment", params: { lines: lines.join(" + ") } });
  for (const [code, lines] of byPrinted) if (lines.length > 1) checks.push({ level: "warn", code: "dup_printed", params: { code, lines: lines.join(" + ") } });

  // --- Fahrauftrag : recoupement ---
  if (!F) {
    checks.push({ level: "warn", code: "no_fa" });
  } else {
    if (listTrip && F.reise && F.reise !== listTrip) checks.push({ level: "error", code: "fa_reise", params: { reise: F.reise, list: listNumber } });
    if (listBordero && F.barcodeNumber && F.barcodeNumber !== listBordero) checks.push({ level: "error", code: "fa_barcode", params: { number: F.barcodeNumber, list: listNumber } });
    if (!samePlate(plate(F.vehiclePlate), plate(L?.truckPlate)) || !samePlate(plate(F.trailerPlate), plate(L?.trailerPlate))) {
      checks.push({ level: "warn", code: "plates_differ" });
    }
    if (!draft.sealsExpected.length) checks.push({ level: "warn", code: "no_seals" });
    else checks.push({ level: "ok", code: "seals", params: { seals: draft.sealsExpected.join(", ") } });

    const stops = new Map(F.stops.map((s) => [shipmentKey(s.shipmentNumber), s]));
    const missingInFa = positions.filter((p) => !stops.has(shipmentKey(p.shipmentNumber)));
    const extraInFa = F.stops.filter((s) => !byShipment.has(shipmentKey(s.shipmentNumber)));
    const mismatch = positions.filter((p) => {
      const s = stops.get(shipmentKey(p.shipmentNumber));
      return s && ((s.packages != null && s.packages !== p.packagesExpected) || (s.weightKg != null && Math.abs(s.weightKg - p.weightKg) >= 0.05));
    });
    if (!missingInFa.length && !extraInFa.length && !mismatch.length && F.stops.length) {
      checks.push({ level: "ok", code: "fa_ok", params: { count: F.stops.length } });
    }
    for (const p of missingInFa) checks.push({ level: "warn", code: "fa_missing", params: { line: p.lineNumber, shipment: p.shipmentNumber } });
    for (const s of extraInFa) checks.push({ level: "warn", code: "fa_extra", params: { shipment: formatShipmentNumber(s.shipmentNumber) } });
    for (const p of mismatch) checks.push({ level: "warn", code: "fa_mismatch", params: { line: p.lineNumber, shipment: p.shipmentNumber } });
  }

  for (const n of draft.handwrittenNotes) {
    checks.push({ level: "warn", code: "handwritten", params: { text: n.text, missing: n.declaredMissingPackages } });
  }
  for (const d of x.doubts) checks.push({ level: "warn", code: "doubt", params: { text: d } });

  const order: Record<CheckLevel, number> = { error: 0, warn: 1, ok: 2 };
  checks.sort((a, b) => order[a.level] - order[b.level]);
  return { draft, checks };
}

/** Colis attendus pour Douvrin (hors positions adressées ailleurs). */
export function packagesForDouvrin(positions: Pick<PositionDraft, "packagesExpected" | "deliveryZip" | "deliveryCity">[]) {
  return positions.filter((p) => !isOffAddress(p.deliveryZip, p.deliveryCity)).reduce((s, p) => s + p.packagesExpected, 0);
}

/** Recalcul en direct pendant la relecture : somme des positions face aux totaux du document. */
export function draftTotals(d: Pick<ReceptionDraft, "positions" | "expectedPackages" | "expectedWeightKg" | "expectedValueEur">) {
  const pkg = d.positions.reduce((s, p) => s + p.packagesExpected, 0);
  const kg = round2(d.positions.reduce((s, p) => s + p.weightKg, 0));
  const eur = round2(d.positions.reduce((s, p) => s + (p.valueEur ?? 0), 0));
  return {
    packages: { sum: pkg, total: d.expectedPackages, ok: d.expectedPackages == null ? null : pkg === d.expectedPackages },
    weight: { sum: kg, total: d.expectedWeightKg, ok: d.expectedWeightKg == null ? null : Math.abs(kg - d.expectedWeightKg) < 0.05 },
    value: { sum: eur, total: d.expectedValueEur, ok: d.expectedValueEur == null ? null : Math.abs(eur - d.expectedValueEur) < 0.01 },
    forDouvrin: packagesForDouvrin(d.positions),
  };
}
