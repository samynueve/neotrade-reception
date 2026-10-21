import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getI18n } from "@/i18n/server";
import { listReceptions, type ReceptionRow } from "@/lib/receptions";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type I18n = Awaited<ReturnType<typeof getI18n>>;

export default async function HomePage({ searchParams }: { searchParams: Promise<{ refuse?: string }> }) {
  const user = await requireUser("/");
  const i18n = await getI18n();
  const { t } = i18n;
  const { refuse } = await searchParams;
  const { open, closed } = await listReceptions();

  return (
    <>
      <AppHeader user={user} />
      <main id="contenu" className="mx-auto max-w-2xl px-4 pb-36 pt-4">
        {refuse && (
          <p role="alert" className="mb-4 rounded-xl border-2 border-alert bg-red-50 p-3 font-bold text-alert">
            {t.home.forbidden}
          </p>
        )}

        <Section title={t.home.inProgress} rows={open} empty={t.home.emptyOpen} i18n={i18n} />
        <Section title={t.home.closed} rows={closed} empty={t.home.emptyClosed} i18n={i18n} />

        {user.role === "RESPONSABLE" && (
          <Link href="/utilisateurs" className="btn-outline w-full text-base">
            {t.home.manageUsers}
          </Link>
        )}
      </main>

      {/* Gros bouton fixe en bas, à portée de pouce */}
      <div className="fixed inset-x-0 bottom-0 border-t-2 border-brand-indigo/10 bg-brand-ground/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <Link href="/receptions/nouveau" className="btn-primary mx-auto min-h-18 w-full max-w-2xl text-2xl">
          <span aria-hidden className="text-3xl leading-none">
            +
          </span>{" "}
          {t.home.newTruck}
        </Link>
      </div>
    </>
  );
}

function Section({ title, rows, empty, i18n }: { title: string; rows: ReceptionRow[]; empty: string; i18n: I18n }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xl font-extrabold">
        {title} <span className="font-semibold text-brand-ink/60">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="card p-4 text-brand-ink/70">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <ReceptionCard row={r} i18n={i18n} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReceptionCard({ row, i18n: { t, f } }: { row: ReceptionRow; i18n: I18n }) {
  const complete = row.expected != null && row.expected > 0 && row.received >= row.expected;
  return (
    <Link href={`/receptions/${row.id}`} className="card flex items-center gap-3 p-4 active:bg-brand-ground">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-brand-ink/75">
          {f.date(row.date)} · {f.time(row.date)}
        </p>
        <p className="truncate text-xl font-extrabold">{t.common.list(row.loadingListNumber ?? t.common.none)}</p>
        {row.tripNumber && <p className="text-base text-brand-ink/75">{t.home.reise(row.tripNumber)}</p>}
        <div className="mt-1">
          <StatusBadge status={row.status} label={t.receptionStatus[row.status]} />
        </div>
      </div>
      <div className="text-end">
        <p className="text-sm font-semibold text-brand-ink/70">{t.home.packages}</p>
        <p dir="ltr" className={`text-3xl font-black tabular-nums ${complete ? "text-ok" : ""}`}>
          {row.received}
          <span className="text-xl font-bold text-brand-ink/60">/{row.expected ?? "?"}</span>
        </p>
      </div>
      <span aria-hidden className="text-2xl text-brand-ink/40 rtl:-scale-x-100">
        ›
      </span>
    </Link>
  );
}
