import { describe, expect, it } from "vitest";
import { parseParisLocal, toParisLocalInput } from "./dates";

describe("dates (heure de Paris)", () => {
  it("heure d'été : UTC+2", () => {
    expect(parseParisLocal("2026-07-01T08:30")?.toISOString()).toBe("2026-07-01T06:30:00.000Z");
  });
  it("heure d'hiver : UTC+1", () => {
    expect(parseParisLocal("2026-12-01T08:30")?.toISOString()).toBe("2026-12-01T07:30:00.000Z");
  });
  it("aller-retour", () => {
    expect(toParisLocalInput(new Date("2026-10-20T06:15:00Z"))).toBe("2026-10-20T08:15");
  });
  it("refuse une valeur invalide", () => {
    expect(parseParisLocal("20/10/2026")).toBeNull();
  });
});
