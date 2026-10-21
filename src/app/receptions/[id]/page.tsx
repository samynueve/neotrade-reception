import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getI18n } from "@/i18n/server";
import { checkText, parseChecks } from "@/lib/cmr/checks";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { SealsForm } from "./SealsForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.reception.title };
}
export const dynamic = "force-dynamic";

/** Fiche d'un camion : en-tête des documents, plombs, avancement, avaries, colis non prévus, positions. */
export default async function ReceptionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ importee?: string }> }) {
  const { id } = await params;
  const justImported = (await searchParams).importee === "1";
  const user = await requireUser(`/receptions/${id}`);
  const { t, f } = await getI18n();
  const r = await prisma.reception.findUnique({
    where: { id },
    include: {
      controller: { select: { name: true } },
      positions: { orderBy: { lineNumber: "asc" } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      photos: { where: { kind: "CMR_LADELISTE" }, select: { id: true }, orderBy: { storageKey: "asc" } },
      scans: {
        where: { OR: [{ condition: "ENDOMMAGE" }, { match: "INCONNU" }] },
        orderBy: { scannedAt: "asc" },
        select: { id: true, rawCode: true, match: true, damageType: true, comment: true, position: { select: { shipmentNumber: true, lineNumber: true } }, photos: { select: { id: true } } },
      },
      disputesResolved: { select: { oldShipmentNumber: true, foundPositionId: true, originReception: { select: { loadingListNumber: true } } } },
    },
  });
  if (!r) notFound();

  const forDouvrin = r.positions.filter((p) => !p.isOffAddress);
  const received = forDouvrin.reduce((s, p) => s + p.packagesReceived, 0);
  const expected = forDouvrin.length ? forDouvrin.reduce((s, p) => s + p.packagesExpected, 0) : r.expectedPackages;
  const missingSeals = r.sealsExpected.filter((s) => !r.sealsFound.includes(s));
  const checks = parseChecks(r.importChecks);
  const unknown = r.scans.filter((s) => s.match === "INCONNU");
  const damaged = r.scans.filter((s) => s.damageType);
  const open = r.status !== "CLOTUREE";

  return (
    <>
      <AppHeader user={user} back={{ href: "/", label: t.common.home }} />
      <main id="contenu" className="mx-auto max-w-2xl space-y-4 px-4 pb-10 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold">{t.common.list(r.loadingListNumber ?? t.common.none)}</h1>
            {r.arrivedAt && <p className="text-brand-ink/75">{t.reception.arrived(f.date(r.arrivedAt), f.time(r.arrivedAt))}</p>}
          </div>
          <StatusBadge status={r.status} label={t.receptionStatus[r.status]} />
        </div>

        {open && r.positions.length > 0 && (
          <Link href={`/receptions/${r.id}/scan`} className="btn-primary min-h-20 w-full text-2xl">
            {t.reception.scan}
          </Link>
        )}

        {justImported && (
          <p role="status" className="rounded-xl border-2 border-ok bg-green-50 p-3 font-bold text-ok">
            {t.reception.created(r.positions.length)}
          </p>
        )}

        {checks.length > 0 && (
          <section className="card border-amber-600/60 p-4">
            <h2 className="mb-2 text-lg font-extrabold">{t.reception.importChecks}</h2>
            <ul className="list-disc space-y-1 ps-5">
              {checks.map((c, i) => (
                <li key={i} className={c.level === "error" ? "font-bold text-alert" : ""}>
                  {checkText(t, c, f)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card grid grid-cols-3 divide-x-2 divide-brand-indigo/10 p-3 text-center rtl:divide-x-reverse">
          <Stat label={t.reception.received} value={`${received}/${expected ?? "?"}`} />
          <Stat label={t.reception.expectedWeight} value={r.expectedWeightKg ? f.kg(Number(r.expectedWeightKg)) : t.common.none} />
          <Stat label={t.reception.value} value={r.expectedValueCents != null ? f.eur(r.expectedValueCents / 100) : t.common.none} />
        </section>

        <section className="card p-4">
          <h2 className="mb-2 text-lg font-extrabold">{t.reception.truck}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <Row k={t.reception.carrier} v={`${r.carrier} · ${r.agency} · ${r.relation}`} />
            <Row k={t.reception.subcontractor} v={r.subcontractor} />
            <Row k={t.reception.reise} v={r.tripNumber} code />
            <Row k={t.reception.vehicle} v={r.vehiclePlate} code />
            <Row k={t.reception.trailer} v={r.trailerPlate} code />
            <Row k={t.reception.sealsExpected} v={r.sealsExpected.join(", ") || null} code />
            <Row k={t.reception.sealsFound} v={r.sealsFound.join(", ") || null} code />
            <Row k={t.reception.controller} v={r.controller?.name} />
          </dl>
          {r.sealsFound.length > 0 && r.sealsExpected.length > 0 && (
            <p className={`mt-3 rounded-lg border-2 p-2 font-bold ${missingSeals.length ? "border-alert bg-red-50 text-alert" : "border-ok bg-green-50 text-ok"}`}>
              {missingSeals.length ? t.reception.sealsMismatch(missingSeals.join(", ")) : t.reception.sealsMatch}
            </p>
          )}
          {open && <SealsForm receptionId={r.id} current={r.sealsFound} />}
        </section>

        {r.photos.length > 0 && (
          <section className="card p-4">
            <h2 className="mb-2 text-lg font-extrabold">{t.reception.documents}</h2>
            <ul className="grid grid-cols-3 gap-2">
              {r.photos.map((ph, i) => (
                <li key={ph.id}>
                  <a href={`/api/photos/${ph.id}`} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${ph.id}`} alt={t.reception.documentPhoto(i + 1)} loading="lazy" className="aspect-[3/4] w-full rounded-xl border-2 border-brand-indigo/20 object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {unknown.length > 0 && (
          <section className="card border-alert/50 p-4">
            <h2 className="mb-2 text-lg font-extrabold text-alert">{t.reception.unknown}</h2>
            <ul className="space-y-1 font-mono text-sm">
              {unknown.map((s) => (
                <li key={s.id}>{s.rawCode}</li>
              ))}
            </ul>
          </section>
        )}

        {damaged.length > 0 && (
          <section className="card p-4">
            <h2 className="mb-2 text-lg font-extrabold">{t.reception.damages}</h2>
            <ul className="space-y-2">
              {damaged.map((s) => (
                <li key={s.id} className="rounded-xl bg-red-50 p-3">
                  <b>{s.position ? `${t.common.pos(s.position.lineNumber)} · ` : ""}</b>
                  <b className="font-mono">{s.position?.shipmentNumber ?? s.rawCode}</b> : {t.damage[s.damageType!]}
                  {s.comment && ` · ${s.comment}`}
                  {s.photos.length > 0 && (
                    <span className="mt-2 flex gap-2">
                      {s.photos.map((ph) => (
                        <a key={ph.id} href={`/api/photos/${ph.id}`} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/photos/${ph.id}`} alt={t.reception.damagePhoto} loading="lazy" className="size-20 rounded-lg object-cover" />
                        </a>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {r.notes.length > 0 && (
          <section className="card p-4">
            <h2 className="mb-2 text-lg font-extrabold">{t.reception.notes}</h2>
            <ul className="space-y-2">
              {r.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-yellow-100 p-2">
                  <span className="font-bold">{n.kind === "MANUSCRITE" ? t.reception.handwritten : t.reception.observation} :</span> « {n.text} »
                  {n.declaredMissingPackages != null && <span className="font-bold">{t.reception.announcedMissing(n.declaredMissingPackages)}</span>}
                  <span className="block text-sm text-brand-ink/70">{t.reception.by(n.author.name)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card p-4">
          <h2 className="mb-2 text-lg font-extrabold">{t.reception.positions(r.positions.length)}</h2>
          {r.positions.length === 0 ? (
            <p className="text-brand-ink/75">{t.reception.noPositions}</p>
          ) : (
            <ul className="divide-y-2 divide-brand-indigo/10">
              {r.positions.map((p) => (
                <li key={p.id} className="py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-lg font-bold">{p.shipmentNumber}</span>
                    <span dir="ltr" className="font-black tabular-nums">
                      {p.packagesReceived}/{p.packagesExpected}
                    </span>
                  </div>
                  <p className="text-brand-ink/80">
                    {p.description ?? t.common.none} · {f.kg(Number(p.weightKg))}
                    {p.isGrouped && t.reception.grouped}
                  </p>
                  {p.printedNumber && <p className="text-sm text-brand-ink/70">
                      {t.reception.printed("")}
                      <span className="font-mono">{p.printedNumber}</span>
                    </p>}
                  {r.disputesResolved
                    .filter((d) => d.foundPositionId === p.id)
                    .map((d) => (
                      <p key={d.oldShipmentNumber} className="text-sm font-bold text-ok">
                        {t.reception.missingFound(d.oldShipmentNumber, d.originReception.loadingListNumber ?? "?")}
                      </p>
                    ))}
                  <p className={`text-sm font-bold ${p.isOffAddress ? "text-alert" : p.status === "RECU" ? "text-ok" : "text-brand-ink/70"}`}>
                    {t.positionStatus[p.status]}
                    {p.isOffAddress && t.reception.deliverableTo(p.deliveryCity ?? t.reception.otherAddress)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1">
      <p className="text-sm font-semibold text-brand-ink/70">{label}</p>
      <p dir="ltr" className="text-lg font-black tabular-nums">
        {value}
      </p>
    </div>
  );
}

function Row({ k, v, code }: { k: string; v?: string | null; code?: boolean }) {
  return (
    <>
      <dt className="font-semibold text-brand-ink/70">{k}</dt>
      <dd className={`min-w-0 break-words font-bold ${code && v ? "font-mono" : ""}`}>{v || "—"}</dd>
    </>
  );
}
