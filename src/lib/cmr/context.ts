import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReceptionDraft } from "./analyze";
import type { Check } from "./checks";

/** Contrôles qui dépendent de la base : liste déjà enregistrée, colis manquants d'un camion précédent qui reviennent. */
export async function contextChecks(draft: ReceptionDraft): Promise<{ checks: Check[]; duplicateOf: string | null }> {
  const checks: Check[] = [];
  let duplicateOf: string | null = null;

  if (draft.loadingListNumber) {
    const existing = await prisma.reception.findFirst({
      where: { loadingListNumber: draft.loadingListNumber },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      duplicateOf = existing.id;
      checks.push({ level: "error", code: "duplicate_list", params: { list: draft.loadingListNumber, date: existing.createdAt.toISOString() } });
    }
  }

  const printed = draft.positions.map((p) => p.printedNumber).filter((v): v is string => !!v);
  if (printed.length) {
    const disputes = await prisma.dispute.findMany({
      where: { status: "OUVERT", printedNumber: { in: printed } },
      select: { printedNumber: true, oldShipmentNumber: true, originReception: { select: { loadingListNumber: true } } },
    });
    for (const d of disputes) {
      const pos = draft.positions.find((p) => p.printedNumber === d.printedNumber);
      checks.push({
        level: "ok",
        code: "dispute_found",
        params: { line: pos?.lineNumber ?? null, old: d.oldShipmentNumber, list: d.originReception.loadingListNumber ?? "?", shipment: pos?.shipmentNumber ?? null },
      });
    }
  }
  return { checks, duplicateOf };
}
