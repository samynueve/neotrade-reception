import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { scanState } from "@/lib/scan/sync";
import { requireUser } from "@/lib/session";
import { ScanStation } from "./ScanStation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.scan.title };
}
export const dynamic = "force-dynamic";

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/receptions/${id}/scan`);
  const { t } = await getI18n();
  const reception = await prisma.reception.findUnique({
    where: { id },
    select: {
      id: true,
      loadingListNumber: true,
      status: true,
      positions: {
        orderBy: { lineNumber: "asc" },
        select: { id: true, lineNumber: true, shipmentNumber: true, shipmentKey: true, printedNumber: true, packagesExpected: true, packagesReceived: true, isOffAddress: true, isGrouped: true, description: true, deliveryCity: true, packagingType: true },
      },
    },
  });
  if (!reception) notFound();

  return (
    <>
      <AppHeader user={user} back={{ href: `/receptions/${id}`, label: t.common.sheet }} />
      <main id="contenu" className="mx-auto max-w-2xl px-4 pt-4">
        {reception.status === "CLOTUREE" ? (
          <p className="card p-4 font-bold">{t.scan.closedReception}</p>
        ) : reception.positions.length === 0 ? (
          <p className="card p-4">
            {t.scan.noPositions}{" "}
            <Link href="/receptions/nouveau" className="font-bold underline">
              {t.scan.photographCmr}
            </Link>{" "}
            {t.scan.toFill}
          </p>
        ) : (
          <ScanStation receptionId={id} listNumber={reception.loadingListNumber} positions={reception.positions} initial={await scanState(id)} />
        )}
      </main>
    </>
  );
}
