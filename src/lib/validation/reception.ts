import { z } from "zod";
import { parseParisLocal } from "@/lib/dates";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "too_long_text")
    .transform((v) => v || null);

const optionalInt = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d+$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "integer" });
      return z.NEVER;
    }
    return Number(v);
  });

// Accepte « 3 673,5 » ou « 3673.5 »
const optionalDecimal = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "decimal" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

const optionalDateTime = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseParisLocal(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "datetime" });
      return z.NEVER;
    }
    return d;
  });

/** Plombs : séparés par des espaces, virgules ou retours à la ligne. */
export const parseSeals = (v: string) =>
  v
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

export const newReceptionSchema = z.object({
  loadingListNumber: text(40),
  tripNumber: text(40),
  documentDate: optionalDateTime,
  arrivedAt: optionalDateTime,
  vehiclePlate: text(20),
  trailerPlate: text(20),
  sealsExpected: z.string().max(200).transform(parseSeals),
  expectedPackages: optionalInt,
  expectedWeightKg: optionalDecimal,
  expectedValueEur: optionalDecimal,
  comment: text(1000),
});

export type NewReception = z.output<typeof newReceptionSchema>;
