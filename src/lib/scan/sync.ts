import "server-only";
import { prisma } from "@/lib/prisma";
import { matchCode, positionStatus, type MatchPosition } from "./match";
import type { ScanOp, SyncResponse } from "./ops";

export class SyncError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** État courant à renvoyer au téléphone après une synchro (ou au chargement de l'écran de scan). */
export async function scanState(receptionId: string): Promise<SyncResponse> {
  const [reception, positions, unknown, codes] = await Promise.all([
    prisma.reception.findUniqueOrThrow({ where: { id: receptionId }, select: { status: true } }),
    prisma.position.findMany({ where: { receptionId }, select: { id: true, packagesReceived: true, status: true } }),
    prisma.scan.findMany({
      where: { receptionId, match: "INCONNU" },
      select: { clientId: true, rawCode: true, scannedAt: true },
      orderBy: { scannedAt: "desc" },
      take: 100,
    }),
    prisma.scan.findMany({ where: { receptionId, isDuplicate: false, match: { not: "MANUEL" } }, select: { normalizedCode: true }, distinct: ["normalizedCode"] }),
  ]);
  return {
    positions,
    unknown: unknown.map((u) => ({ ...u, scannedAt: u.scannedAt.toISOString() })),
    scannedCodes: codes.map((c) => c.normalizedCode),
    receptionStatus: reception.status,
  };
}

/** Applique les opérations d'un téléphone. Le rapprochement est refait ici : c'est le serveur qui fait foi. */
export async function applyOps(receptionId: string, userId: string, ops: ScanOp[]): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const reception = await tx.reception.findUnique({ where: { id: receptionId }, select: { status: true } });
      if (!reception) throw new SyncError("not_found", 404);
      if (reception.status === "CLOTUREE") throw new SyncError("closed", 409);

      const positions: MatchPosition[] = await tx.position.findMany({
        where: { receptionId },
        select: { id: true, lineNumber: true, shipmentNumber: true, shipmentKey: true, printedNumber: true, packagesExpected: true, packagesReceived: true, isOffAddress: true, isGrouped: true },
      });
      const byId = new Map(positions.map((p) => [p.id, p]));
      const existing = await tx.scan.findMany({ where: { receptionId }, select: { clientId: true, normalizedCode: true, isDuplicate: true, match: true } });
      const known = new Set(existing.map((s) => s.clientId));
      const scanned = new Set(existing.filter((s) => !s.isDuplicate && s.match !== "MANUEL").map((s) => s.normalizedCode));

      for (const op of ops) {
        if (op.type === "scan") {
          if (known.has(op.clientId)) continue;
          known.add(op.clientId);
          const base = { clientId: op.clientId, receptionId, userId, rawCode: op.rawCode, scannedAt: new Date(op.scannedAt) };
          const quantity = op.quantity ?? 1;

          if (op.positionId) {
            const p = byId.get(op.positionId);
            if (!p) continue; // position d'une autre réception : ignorée
            await tx.scan.create({ data: { ...base, normalizedCode: "MANUEL", match: "MANUEL", positionId: p.id, quantity } });
            p.packagesReceived += quantity;
            continue;
          }

          const { normalized, result } = matchCode(op.rawCode, positions, scanned);
          if (result.kind === "position") {
            await tx.scan.create({ data: { ...base, normalizedCode: normalized, match: result.via, positionId: result.position.id, quantity } });
            result.position.packagesReceived += quantity;
            scanned.add(normalized);
          } else if (result.kind === "duplicate") {
            await tx.scan.create({ data: { ...base, normalizedCode: normalized, match: "N_IMPRIME", positionId: result.position?.id, isDuplicate: true } });
          } else {
            await tx.scan.create({ data: { ...base, normalizedCode: normalized, match: "INCONNU" } });
          }
        } else if (op.type === "damage") {
          await tx.scan.updateMany({
            where: { clientId: op.clientId, receptionId },
            data: { condition: op.damageType ? "ENDOMMAGE" : "OK", damageType: op.damageType, comment: op.comment },
          });
        } else {
          await tx.scan.deleteMany({ where: { clientId: op.clientId, receptionId } });
        }
      }

      // Recalcul des compteurs depuis les scans (source de vérité), puis des statuts
      const sums = await tx.scan.groupBy({
        by: ["positionId"],
        where: { receptionId, isDuplicate: false, positionId: { not: null } },
        _sum: { quantity: true },
      });
      const received = new Map(sums.map((s) => [s.positionId!, s._sum.quantity ?? 0]));
      for (const p of positions) {
        const n = received.get(p.id) ?? 0;
        await tx.position.update({ where: { id: p.id }, data: { packagesReceived: n, status: positionStatus(n, p.packagesExpected, p.isOffAddress) } });
      }
      if (reception.status === "BROUILLON") {
        await tx.reception.update({ where: { id: receptionId }, data: { status: "EN_CONTROLE" } });
      }
    },
    { timeout: 20_000 },
  );
}
