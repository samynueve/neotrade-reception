import { describe, expect, it } from "vitest";
import { newReceptionSchema, parseSeals } from "./reception";

const base = {
  loadingListNumber: "80977/652747",
  tripNumber: "",
  documentDate: "",
  arrivedAt: "2026-10-20T08:30",
  vehiclePlate: "",
  trailerPlate: "",
  sealsExpected: "",
  expectedPackages: "",
  expectedWeightKg: "",
  expectedValueEur: "",
  comment: "",
};

describe("newReceptionSchema", () => {
  it("transforme les champs", () => {
    const r = newReceptionSchema.parse({ ...base, expectedPackages: "42", expectedWeightKg: "3 673,5", sealsExpected: "a123, B456\nc789" });
    expect(r.loadingListNumber).toBe("80977/652747");
    expect(r.tripNumber).toBeNull();
    expect(r.expectedPackages).toBe(42);
    expect(r.expectedWeightKg).toBe(3673.5);
    expect(r.sealsExpected).toEqual(["A123", "B456", "C789"]);
    expect(r.arrivedAt?.toISOString()).toBe("2026-10-20T06:30:00.000Z");
  });
  it("refuse un nombre de colis non entier", () => {
    expect(newReceptionSchema.safeParse({ ...base, expectedPackages: "4,5" }).success).toBe(false);
  });
  it("découpe les plombs", () => {
    expect(parseSeals("  ")).toEqual([]);
  });
});
