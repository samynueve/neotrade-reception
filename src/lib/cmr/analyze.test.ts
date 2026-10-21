import { describe, expect, it } from "vitest";
import { analyzeExtraction, declaredMissing, packagesForDouvrin } from "./analyze";
import { KN_80977_652747 } from "./fixture";

describe("analyzeExtraction — CMR réelle 80977/652747", () => {
  const { draft, checks } = analyzeExtraction(KN_80977_652747);

  it("pré-remplit l'en-tête depuis la CMR et le Fahrauftrag", () => {
    expect(draft.loadingListNumber).toBe("80977/652747");
    expect(draft.tripNumber).toBe("80977");
    expect(draft.relation).toBe("X085");
    expect(draft.documentDate).toBe("2026-10-15T13:50");
    expect(draft.vehiclePlate).toBe("TM 24 YMB");
    expect(draft.trailerPlate).toBe("CI 463");
    expect(draft.sealsExpected).toEqual(["756015"]);
    expect(draft.subcontractor).toBe("SC SABIKO-IMPLEX SRL");
    expect(draft.expectedPackages).toBe(18);
    expect(draft.expectedWeightKg).toBe(3919.5);
    expect(draft.expectedValueEur).toBe(5145.12);
  });

  it("lit les 4 positions, dont l'envoi groupé de 15 palettes", () => {
    expect(draft.positions).toHaveLength(4);
    const grouped = draft.positions[3];
    expect(grouped.shipmentNumber).toBe("362/000/4659205");
    expect(grouped.isGrouped).toBe(true);
    expect(grouped.packagesExpected).toBe(15);
    expect(grouped.borderoNumbers).toEqual(["65035", "65049", "65049", "65204"]);
    expect(draft.positions[0].isGrouped).toBe(false);
  });

  it("valide les totaux et le recoupement avec le Fahrauftrag", () => {
    expect(checks.filter((c) => c.level === "error")).toEqual([]);
    expect(checks.some((c) => c.code === "pkg_ok" && c.params?.sum === 18)).toBe(true);
    expect(checks.some((c) => c.code === "fa_ok" && c.params?.count === 4)).toBe(true);
  });

  it("signale la position de Loos-en-Gohelle et compte 17 colis pour Douvrin", () => {
    expect(checks.some((c) => c.code === "off_address" && c.params?.city === "LOOS EN GOHELLE")).toBe(true);
    expect(packagesForDouvrin(draft.positions)).toBe(17);
  });

  it("détecte un total qui ne colle pas (page manquante)", () => {
    const L = KN_80977_652747.ladeliste!;
    const r = analyzeExtraction({ ...KN_80977_652747, ladeliste: { ...L, positions: L.positions.slice(0, 3) } });
    expect(r.checks[0]).toEqual({ level: "error", code: "pkg_bad", params: { sum: 3, total: 18 } });
  });

  it("détecte un n° imprimé en double et une note manuscrite", () => {
    const L = KN_80977_652747.ladeliste!;
    const dup = { ...L.positions[0], pos: 5, shipmentNumber: "362/000/0863199" };
    const r = analyzeExtraction({ ...KN_80977_652747, ladeliste: { ...L, positions: [...L.positions, dup] }, handwrittenNotes: ["25 Missing Box"] });
    expect(r.checks.some((c) => c.code === "dup_printed" && c.params?.code === "00340312892450832" && c.params?.lines === "1 + 5")).toBe(true);
    expect(r.draft.handwrittenNotes).toEqual([{ text: "25 Missing Box", declaredMissingPackages: 25 }]);
  });

  it("signale l'absence de Fahrauftrag", () => {
    const r = analyzeExtraction({ ...KN_80977_652747, fahrauftrag: null });
    expect(r.checks.some((c) => c.code === "no_fa")).toBe(true);
    expect(r.draft.tripNumber).toBe("80977");
    expect(r.draft.vehiclePlate).toBe("TM 24 YMB");
  });
});

describe("declaredMissing", () => {
  it("lit le nombre de colis manquants d'une note", () => {
    expect(declaredMissing("25 Missing Box")).toBe(25);
    expect(declaredMissing("manque 3")).toBe(3);
    expect(declaredMissing("RAS")).toBeNull();
  });
});
