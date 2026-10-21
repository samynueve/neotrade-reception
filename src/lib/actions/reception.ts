"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { analyzeExtraction } from "@/lib/cmr/analyze";
import type { Extraction } from "@/lib/cmr/schema";
import { normalizeCode, shipmentKey } from "@/lib/codes";
import { parseParisLocal } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isOffAddress } from "@/lib/site";
import { getFile } from "@/lib/storage";
import { importConfirmSchema } from "@/lib/validation/import";
import { newReceptionSchema, parseSeals } from "@/lib/validation/reception";

export type ReceptionFormState = { errors?: Record<string, string>; values?: Record<string, string> } | undefined;

/** « Nouveau camion » : crée la réception en brouillon puis ouvre sa fiche. */
export async function createReceptionAction(_prev: ReceptionFormState, formData: FormData): Promise<ReceptionFormState> {
  const user = await requireUser("/receptions/nouveau");
  const parsed = newReceptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    // Valeurs renvoyées pour ne pas tout retaper après une erreur
    const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
    return { errors, values };
  }
  const { expectedValueEur, ...data } = parsed.data;

  const reception = await prisma.reception.create({
    data: {
      ...data,
      arrivedAt: data.arrivedAt ?? new Date(),
      importSource: "MANUEL",
      expectedValueCents: expectedValueEur == null ? null : Math.round(expectedValueEur * 100),
      createdById: user.id,
      controllerId: user.id,
    },
    select: { id: true },
  });
  redirect(`/receptions/${reception.id}`);
}

/**
 * Création d'une réception à partir des photos lues puis relues par l'utilisateur.
 * Les contrôles sont recalculés à partir de la lecture conservée sur le serveur (pas de celle envoyée par le téléphone).
 */
export async function createReceptionFromImportAction(input: unknown): Promise<{ error: string } | undefined> {
  const user = await requireUser("/receptions/nouveau");
  const parsed = importConfirmSchema.safeParse(input);
  // Le code d'erreur est traduit par l'écran de relecture
  if (!parsed.success) return { error: parsed.error.issues[0]?.message && /^[a-z_]+$/.test(parsed.error.issues[0].message) ? parsed.error.issues[0].message : "invalid_input" };
  const { importId, photoCount, draft } = parsed.data;

  const raw = await getFile(`imports/${importId}/lecture.json`);
  if (!raw) return { error: "import_expired" };
  const extraction = JSON.parse(raw.toString("utf8")) as Extraction;
  const warnings = analyzeExtraction(extraction).checks.filter((c) => c.level !== "ok");

  const photos: Prisma.PhotoUncheckedCreateWithoutReceptionInput[] = [];
  for (let i = 0; i < photoCount; i++) {
    const key = `imports/${importId}/${i}.jpg`;
    const data = await getFile(key);
    if (data) photos.push({ kind: "CMR_LADELISTE" as const, storageKey: key, mimeType: "image/jpeg", sizeBytes: data.length, takenAt: new Date(), userId: user.id });
  }

  const reception = await prisma.$transaction(async (tx) => {
    const created = await tx.reception.create({
      data: {
        loadingListNumber: draft.loadingListNumber,
        relation: draft.relation ?? undefined,
        tripNumber: draft.tripNumber,
        documentDate: draft.documentDate ? parseParisLocal(draft.documentDate) : null,
        vehiclePlate: draft.vehiclePlate,
        trailerPlate: draft.trailerPlate,
        sealsExpected: draft.sealsExpected,
        subcontractor: draft.subcontractor,
        expectedPackages: draft.expectedPackages,
        expectedWeightKg: draft.expectedWeightKg,
        expectedValueCents: draft.expectedValueEur == null ? null : Math.round(draft.expectedValueEur * 100),
        arrivedAt: new Date(),
        importSource: "PHOTO",
        importRaw: extraction as unknown as Prisma.InputJsonValue,
        importChecks: warnings as unknown as Prisma.InputJsonValue,
        createdById: user.id,
        controllerId: user.id,
        positions: {
          create: draft.positions.map((p) => {
            const off = isOffAddress(p.deliveryZip, p.deliveryCity);
            return {
              lineNumber: p.lineNumber,
              shipmentNumber: p.shipmentNumber,
              shipmentKey: shipmentKey(p.shipmentNumber),
              printedNumber: p.printedNumber ? normalizeCode(p.printedNumber) : null,
              description: p.description,
              shipper: p.shipper,
              shipperZip: p.shipperZip,
              shipperCity: p.shipperCity,
              consigneeName: p.consigneeName,
              deliveryStreet: p.deliveryStreet,
              deliveryZip: p.deliveryZip,
              deliveryCity: p.deliveryCity,
              isOffAddress: off,
              packagesExpected: p.packagesExpected,
              packagingType: p.packagingType,
              weightKg: p.weightKg,
              valueCents: p.valueEur == null ? null : Math.round(p.valueEur * 100),
              borderoNumbers: p.borderoNumbers,
              isGrouped: p.isGrouped,
              status: off ? ("HORS_ADRESSE" as const) : ("ATTENDU" as const),
            };
          }),
        },
        notes: {
          create: draft.handwrittenNotes.map((n) => ({ kind: "MANUSCRITE" as const, text: n.text, declaredMissingPackages: n.declaredMissingPackages, authorId: user.id })),
        },
        photos: { create: photos },
      },
      include: { positions: { select: { id: true, printedNumber: true, shipmentNumber: true } } },
    });

    // Cas du colis manquant revenu dans ce camion sous un nouveau n° d'envoi : même n° imprimé
    for (const pos of created.positions) {
      if (!pos.printedNumber) continue;
      await tx.dispute.updateMany({
        where: { status: "OUVERT", printedNumber: pos.printedNumber, originReceptionId: { not: created.id } },
        data: {
          status: "RETROUVE",
          foundReceptionId: created.id,
          foundPositionId: pos.id,
          newShipmentNumber: pos.shipmentNumber,
          foundAt: new Date(),
          resolvedById: user.id,
        },
      });
    }
    return created;
  });

  redirect(`/receptions/${reception.id}?importee=1`);
}

/** Plombs relevés sur la remorque à l'ouverture, comparés aux plombs attendus du Fahrauftrag. */
export async function saveSealsFoundAction(_prev: { ok?: boolean } | undefined, formData: FormData): Promise<{ ok?: boolean }> {
  await requireUser("/");
  const id = String(formData.get("receptionId") ?? "");
  const seals = parseSeals(String(formData.get("seals") ?? "").slice(0, 300)).slice(0, 10);
  await prisma.reception.updateMany({ where: { id, status: { not: "CLOTUREE" } }, data: { sealsFound: seals } });
  revalidatePath(`/receptions/${id}`);
  return { ok: true };
}
