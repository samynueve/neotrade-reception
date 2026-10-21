import { describe, expect, it } from "vitest";
import { matchCode, positionStatus, type MatchPosition } from "./match";

// Positions de la CMR réelle 80977/652747
const P = (o: Partial<MatchPosition> & Pick<MatchPosition, "id" | "lineNumber" | "shipmentNumber">): MatchPosition => ({
  shipmentKey: o.shipmentNumber.replace(/\D/g, ""),
  printedNumber: null,
  packagesExpected: 1,
  packagesReceived: 0,
  isOffAddress: false,
  isGrouped: false,
  ...o,
});
const positions = [
  P({ id: "p1", lineNumber: 1, shipmentNumber: "362/000/0863121", printedNumber: "00340312892450832" }),
  P({ id: "p2", lineNumber: 2, shipmentNumber: "362/000/0863122", printedNumber: "00340312892450473", isOffAddress: true }),
  P({ id: "p3", lineNumber: 3, shipmentNumber: "362/000/0863123", printedNumber: "00340312892450910" }),
  P({ id: "p4", lineNumber: 4, shipmentNumber: "362/000/4659205", packagesExpected: 15, isGrouped: true }),
];
const none = new Set<string>();

describe("matchCode — étiquette Amazon réelle", () => {
  it("retrouve la position 1 depuis le code complet de l'étiquette (préfixe imprimé sur la CMR)", () => {
    const { normalized, result } = matchCode("00340312892450832619", positions, none);
    expect(normalized).toBe("00340312892450832619");
    expect(result.kind).toBe("position");
    if (result.kind === "position") {
      expect(result.position.id).toBe("p1");
      expect(result.via).toBe("N_IMPRIME");
    }
  });

  it("accepte le préfixe de symbologie, les espaces et l'AI 00 retiré par la douchette", () => {
    for (const raw of ["]C100340312892450832619", "0034 0312 8924 5083 2619", "340312892450832619"]) {
      const { result } = matchCode(raw, positions, none);
      expect(result.kind === "position" && result.position.id).toBe("p1");
    }
  });

  it("refuse une deuxième lecture de la même étiquette", () => {
    const { result } = matchCode("00340312892450832619", positions, new Set(["00340312892450832619"]));
    expect(result.kind).toBe("duplicate");
  });

  it("signale le mauvais code-barres (celui du bas de l'étiquette)", () => {
    const { result } = matchCode("LtFh5M3KM/204/vendor-returns/1 of 1/80/815/NZW6", positions, none);
    expect(result).toEqual({ kind: "unknown", wrongBarcode: true });
  });

  it("un colis inconnu de la CMR reste inconnu", () => {
    const { result } = matchCode("00340399999999999999", positions, none);
    expect(result).toEqual({ kind: "unknown", wrongBarcode: false });
  });

  it("reconnaît le colis hors adresse", () => {
    const { result } = matchCode("00340312892450473001", positions, none);
    expect(result.kind === "position" && result.position.isOffAddress).toBe(true);
  });

  it("compte les palettes d'un envoi groupé par le n° d'envoi, même étiquette répétée", () => {
    const seen = new Set(["3620004659205"]);
    const { result } = matchCode("362/000/4659205", positions, seen);
    expect(result.kind === "position" && result.position.id).toBe("p4");
  });

  it("même n° imprimé sur deux positions : remplit d'abord celle qui attend encore", () => {
    const twins = [
      P({ id: "a", lineNumber: 1, shipmentNumber: "362/000/0000001", printedNumber: "00340312892450832", packagesReceived: 1 }),
      P({ id: "b", lineNumber: 2, shipmentNumber: "362/000/0000002", printedNumber: "00340312892450832" }),
    ];
    const { result } = matchCode("00340312892450832777", twins, none);
    expect(result.kind === "position" && result.position.id).toBe("b");
    expect(result.kind === "position" && result.ambiguous).toBe(true);
  });
});

describe("positionStatus", () => {
  it("calcule le statut", () => {
    expect(positionStatus(0, 1, false)).toBe("ATTENDU");
    expect(positionStatus(9, 15, false)).toBe("PARTIEL");
    expect(positionStatus(15, 15, false)).toBe("RECU");
    expect(positionStatus(1, 1, true)).toBe("HORS_ADRESSE");
  });
});
