import "server-only";
import type { ReceptionStatus } from "@prisma/client";
import { prisma } from "./prisma";

export type ReceptionRow = {
  id: string;
  date: Date;
  loadingListNumber: string | null;
  tripNumber: string | null;
  status: ReceptionStatus;
  received: number;
  expected: number | null;
};

/**
 * Réceptions pour l'écran d'accueil, avec colis reçus / attendus.
 * Les positions hors adresse ne sont comptées ni dans les reçus ni dans les attendus (elles ne sont pas pour Douvrin).
 * Tant que la liste n'est pas saisie, l'attendu est le total ENDSUMMEN.
 */
export async function listReceptions(limitClosed = 30): Promise<{ open: ReceptionRow[]; closed: ReceptionRow[] }> {
  const select = { id: true, arrivedAt: true, createdAt: true, loadingListNumber: true, tripNumber: true, status: true, expectedPackages: true } as const;
  const [open, closed] = await Promise.all([
    prisma.reception.findMany({ where: { status: { not: "CLOTUREE" } }, select, orderBy: { createdAt: "desc" } }),
    prisma.reception.findMany({ where: { status: "CLOTUREE" }, select, orderBy: { closedAt: "desc" }, take: limitClosed }),
  ]);
  const ids = [...open, ...closed].map((r) => r.id);
  const sums = ids.length
    ? await prisma.position.groupBy({
        by: ["receptionId"],
        where: { receptionId: { in: ids }, isOffAddress: false },
        _sum: { packagesExpected: true, packagesReceived: true },
        _count: { _all: true },
      })
    : [];
  const byId = new Map(sums.map((s) => [s.receptionId, s]));

  const toRow = (r: (typeof open)[number]): ReceptionRow => {
    const s = byId.get(r.id);
    return {
      id: r.id,
      date: r.arrivedAt ?? r.createdAt,
      loadingListNumber: r.loadingListNumber,
      tripNumber: r.tripNumber,
      status: r.status,
      received: s?._sum.packagesReceived ?? 0,
      expected: s?._count._all ? (s._sum.packagesExpected ?? 0) : r.expectedPackages,
    };
  };
  return { open: open.map(toRow), closed: closed.map(toRow) };
}
