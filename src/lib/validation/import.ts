import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);

const kg = z.number().min(0).max(100_000);
const eur = z.number().min(0).max(10_000_000);

export const positionDraftSchema = z.object({
  lineNumber: z.number().int().min(1).max(999),
  shipmentNumber: z.string().trim().min(1, "shipment_required").max(40),
  printedNumber: text(40),
  description: text(120),
  shipper: text(120),
  shipperZip: text(12),
  shipperCity: text(80),
  consigneeName: text(120),
  deliveryStreet: text(160),
  deliveryZip: text(12),
  deliveryCity: text(80),
  packagesExpected: z.number().int().min(0).max(9999),
  packagingType: text(30),
  weightKg: kg,
  valueEur: eur.nullable(),
  borderoNumbers: z.array(z.string().trim().max(20)).max(50),
  isGrouped: z.boolean(),
});

/** Réception relue et corrigée par l'utilisateur, renvoyée au serveur pour création. */
export const receptionDraftSchema = z.object({
  loadingListNumber: text(40),
  relation: text(20),
  tripNumber: text(40),
  documentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullable()
    .or(z.literal("").transform(() => null)),
  vehiclePlate: text(20),
  trailerPlate: text(20),
  sealsExpected: z.array(z.string().trim().min(1).max(30)).max(10),
  subcontractor: text(120),
  expectedPackages: z.number().int().min(0).max(99_999).nullable(),
  expectedWeightKg: kg.nullable(),
  expectedValueEur: eur.nullable(),
  positions: z.array(positionDraftSchema).min(1, "positions_required").max(500),
  handwrittenNotes: z.array(z.object({ text: z.string().trim().min(1).max(300), declaredMissingPackages: z.number().int().min(0).max(9999).nullable() })).max(20),
});

export const importConfirmSchema = z.object({
  importId: z.uuid(),
  photoCount: z.number().int().min(0).max(8),
  draft: receptionDraftSchema,
});

export type ImportConfirm = z.infer<typeof importConfirmSchema>;
