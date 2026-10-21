import { describe, expect, it } from "vitest";
import { formatShipmentNumber, normalizeCode, shipmentKey } from "./codes";
import { isOffAddress } from "./site";

describe("codes", () => {
  it("normalise un n° d'envoi", () => {
    expect(shipmentKey("362/000/4659205")).toBe("3620004659205");
    expect(formatShipmentNumber("3620004659205")).toBe("362/000/4659205");
    expect(formatShipmentNumber(" 362/000/4659205 ")).toBe("362/000/4659205");
  });

  it("nettoie un code lu par la douchette", () => {
    expect(normalizeCode("]C100340312892450832")).toBe("00340312892450832");
    expect(normalizeCode(" 0034 0312 8924 50832\n")).toBe("00340312892450832");
    expect(normalizeCode("362/000/4659205")).toBe("3620004659205");
  });
});

describe("isOffAddress", () => {
  it("Douvrin n'est pas hors adresse", () => {
    expect(isOffAddress("62138", "DOUVRIN")).toBe(false);
    expect(isOffAddress(null, "Douvrin")).toBe(false);
    expect(isOffAddress(null, null)).toBe(false);
  });
  it("Loos-en-Gohelle est hors adresse", () => {
    expect(isOffAddress("62750", "LOOS-EN-GOHELLE")).toBe(true);
    expect(isOffAddress(null, "Loos-en-Gohelle")).toBe(true);
  });
});
