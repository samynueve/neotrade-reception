import type { ReceptionStatus } from "@prisma/client";

/** Couleur = simple repère : le libellé suffit à comprendre (lisible aussi en noir et blanc). */
const STYLE: Record<ReceptionStatus, string> = {
  BROUILLON: "bg-zinc-200 text-zinc-900 border-zinc-500",
  EN_CONTROLE: "bg-amber-300 text-brand-ink border-amber-700",
  CLOTUREE: "bg-green-700 text-white border-green-900",
};

export function StatusBadge({ status, label }: { status: ReceptionStatus; label: string }) {
  return <span className={`inline-block shrink-0 rounded-lg border-2 px-2 py-0.5 text-sm font-bold uppercase ${STYLE[status]}`}>{label}</span>;
}
