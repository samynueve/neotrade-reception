"use client";

import Link from "next/link";
import { useState, useTransition, type InputHTMLAttributes } from "react";
import { useI18n } from "@/i18n/client";
import { createReceptionFromImportAction } from "@/lib/actions/reception";
import { declaredMissing, draftTotals, type PositionDraft, type ReceptionDraft } from "@/lib/cmr/analyze";
import { checkText, type Check } from "@/lib/cmr/checks";
import { errorText } from "@/lib/client/errors";
import { isOffAddress } from "@/lib/site";
import type { ImportResult } from "./ImportFlow";

/** Relecture de ce qui a été lu sur les photos : tout est modifiable avant de créer la réception. */
export function ImportReview({ result, onRetake }: { result: ImportResult; onRetake: () => void }) {
  const { t, f } = useI18n();
  const r = t.review;
  const nf = f.num;
  const [draft, setDraft] = useState<ReceptionDraft>(result.draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [newNote, setNewNote] = useState("");
  const tot = draftTotals(draft);
  const errors = result.checks.filter((c) => c.level === "error").length;

  const set = <K extends keyof ReceptionDraft>(k: K, v: ReceptionDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setPos = (i: number, patch: Partial<PositionDraft>) =>
    setDraft((d) => ({ ...d, positions: d.positions.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createReceptionFromImportAction({ importId: result.importId, photoCount: result.photoCount, draft });
      if (res?.error) setError(errorText(t, res.error) ?? null);
    });
  }

  function addNote() {
    const text = newNote.trim();
    if (!text) return;
    set("handwrittenNotes", [...draft.handwrittenNotes, { text, declaredMissingPackages: declaredMissing(text) }]);
    setNewNote("");
  }

  return (
    <div className="space-y-5 pb-36">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-brand-green-text">{r.readFrom(result.photoCount)}</p>
        <h1 className="text-2xl font-extrabold">{t.common.list(draft.loadingListNumber ?? t.common.none)}</h1>
        <p className="text-brand-ink/75">
          {r.summary(draft.positions.length, tot.packages.sum)}
          <b>{r.forDouvrin(tot.forDouvrin)}</b>
        </p>
      </div>

      {/* Totaux recalculés en direct */}
      <section className="card grid grid-cols-3 divide-x-2 divide-brand-indigo/10 p-3 text-center rtl:divide-x-reverse" aria-label={r.totalsAria}>
        <Total label={r.packages} sum={nf(tot.packages.sum)} total={tot.packages.total == null ? null : nf(tot.packages.total)} ok={tot.packages.ok} />
        <Total label={r.weight} sum={nf(tot.weight.sum)} total={tot.weight.total == null ? null : nf(tot.weight.total)} ok={tot.weight.ok} />
        <Total label={r.value} sum={nf(tot.value.sum)} total={tot.value.total == null ? null : nf(tot.value.total)} ok={tot.value.ok} />
      </section>

      <section className="card p-4">
        <h2 className="mb-2 text-lg font-extrabold">
          {r.checks} {errors > 0 && <span className="text-alert">· {r.toFix(errors)}</span>}
        </h2>
        <ul className="space-y-2">
          {result.checks.map((c, i) => (
            <CheckLine key={i} check={c} text={checkText(t, c, f)} />
          ))}
        </ul>
        {result.duplicateOf && (
          <Link href={`/receptions/${result.duplicateOf}`} className="btn-outline mt-3 w-full text-base">
            {r.openExisting}
          </Link>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-extrabold">{r.truck}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Text label={r.listNumber} value={draft.loadingListNumber} onChange={(v) => set("loadingListNumber", v)} dir="ltr" />
          <Text label={r.reise} value={draft.tripNumber} onChange={(v) => set("tripNumber", v)} inputMode="numeric" dir="ltr" />
          <Text label={r.vehicle} value={draft.vehiclePlate} onChange={(v) => set("vehiclePlate", v?.toUpperCase() ?? null)} dir="ltr" />
          <Text label={r.trailer} value={draft.trailerPlate} onChange={(v) => set("trailerPlate", v?.toUpperCase() ?? null)} dir="ltr" />
        </div>
        <Text
          dir="ltr"
          label={r.seals}
          value={draft.sealsExpected.join(", ")}
          onChange={(v) => set("sealsExpected", (v ?? "").split(/[\s,;]+/).map((s) => s.toUpperCase()).filter(Boolean))}
        />
        <Text label={r.subcontractor} value={draft.subcontractor} onChange={(v) => set("subcontractor", v)} />
        <Text label={r.documentDate} type="datetime-local" value={draft.documentDate} onChange={(v) => set("documentDate", v)} />
        <div className="grid grid-cols-3 gap-3">
          <Num label={r.expPackages} value={draft.expectedPackages} integer onChange={(v) => set("expectedPackages", v)} />
          <Num label={r.expKg} value={draft.expectedWeightKg} onChange={(v) => set("expectedWeightKg", v)} />
          <Num label={r.expEur} value={draft.expectedValueEur} onChange={(v) => set("expectedValueEur", v)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">{r.positions(draft.positions.length)}</h2>
        {draft.positions.map((p, i) => (
          <PositionCard key={i} p={p} onChange={(patch) => setPos(i, patch)} />
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-extrabold">{r.notes}</h2>
        {draft.handwrittenNotes.length === 0 && <p className="text-brand-ink/70">{r.noNotes}</p>}
        <ul className="space-y-2">
          {draft.handwrittenNotes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 rounded-xl bg-yellow-100 p-3">
              <span className="flex-1">
                « {n.text} »{n.declaredMissingPackages != null && <b>{r.missingAnnounced(n.declaredMissingPackages)}</b>}
              </span>
              <button type="button" className="min-h-11 rounded-lg px-2 font-bold text-alert" onClick={() => set("handwrittenNotes", draft.handwrittenNotes.filter((_, j) => j !== i))} aria-label={r.removeNote}>
                {t.common.remove}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={r.notePlaceholder}
            aria-label={r.newNote}
            className="h-14 min-w-0 flex-1 rounded-xl border-2 border-brand-indigo/40 bg-white px-3 text-lg"
          />
          <button type="button" onClick={addNote} className="btn-outline px-4">
            {t.common.add}
          </button>
        </div>
      </section>

      {/* Barre d'action fixe en bas, à portée de pouce */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-brand-indigo/10 bg-brand-ground/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-2xl space-y-2">
          {error && (
            <p role="alert" className="rounded-xl border-2 border-alert bg-red-50 p-2 font-bold text-alert">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onRetake} disabled={pending} className="btn-outline min-h-16 px-4 text-base">
              {r.photos}
            </button>
            <button type="button" onClick={submit} disabled={pending} className="btn-primary min-h-16 flex-1 text-xl">
              {pending ? r.creating : r.create}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Total({ label, sum, total, ok }: { label: string; sum: string; total: string | null; ok: boolean | null }) {
  const { t } = useI18n();
  return (
    <div className="px-1">
      <p className="text-sm font-semibold text-brand-ink/70">{label}</p>
      <p dir="ltr" className="text-lg font-black tabular-nums">
        {sum}
      </p>
      <p className={`text-sm font-bold ${ok === false ? "text-alert" : ok ? "text-ok" : "text-brand-ink/60"}`}>
        {total == null ? t.review.totalUnread : ok ? t.review.totalOk(total) : t.review.totalBad(total)}
      </p>
    </div>
  );
}

const CHECK_STYLE = {
  error: { icon: "✕", className: "border-alert bg-red-50 text-alert" },
  warn: { icon: "!", className: "border-amber-600 bg-amber-50 text-amber-900" },
  ok: { icon: "✓", className: "border-ok/50 bg-green-50 text-ok" },
} as const;

function CheckLine({ check, text }: { check: Check; text: string }) {
  const s = CHECK_STYLE[check.level];
  return (
    <li className={`flex gap-2 rounded-xl border-2 p-2.5 ${s.className}`}>
      <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-current font-black">
        {s.icon}
      </span>
      <span className="min-w-0 break-words font-semibold text-brand-ink">{text}</span>
    </li>
  );
}

function PositionCard({ p, onChange }: { p: PositionDraft; onChange: (patch: Partial<PositionDraft>) => void }) {
  const { t, f } = useI18n();
  const r = t.review;
  const nf = f.num;
  const [edit, setEdit] = useState(false);
  const off = isOffAddress(p.deliveryZip, p.deliveryCity);
  return (
    <article className={`card p-4 ${off ? "border-alert/60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand-ink/60">{t.common.pos(p.lineNumber)}</p>
          <p className="font-mono text-lg font-bold">{p.shipmentNumber}</p>
        </div>
        <p className="text-end text-2xl font-black tabular-nums">
          {p.packagesExpected}
          <span className="block text-xs font-bold text-brand-ink/60">{p.packagingType ?? t.common.packages}</span>
        </p>
      </div>
      <p className="text-brand-ink/85">
        {p.description ?? t.common.none} · {f.kg(p.weightKg)}
        {p.valueEur != null && ` · ${nf(p.valueEur)} €`}
      </p>
      {p.printedNumber && <p className="text-sm text-brand-ink/75">
          {r.printed("")}
          <span className="font-mono">{p.printedNumber}</span>
        </p>}
      <p className="text-sm text-brand-ink/75">{r.from(`${p.shipper ?? t.common.none}${p.shipperCity ? ` (${p.shipperCity})` : ""}`)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {off && <Badge className="border-alert bg-red-50 text-alert">{r.offAddress(p.deliveryCity ?? p.deliveryZip ?? "")}</Badge>}
        {p.isGrouped && <Badge className="border-brand-indigo bg-brand-indigo text-white">{r.grouped}</Badge>}
        {p.borderoNumbers.length > 0 && <Badge className="border-brand-indigo/40">{r.bordero([...new Set(p.borderoNumbers)].join(", "))}</Badge>}
      </div>
      <button type="button" onClick={() => setEdit((e) => !e)} className="mt-3 min-h-11 font-bold text-brand-green-text underline" aria-expanded={edit}>
        {edit ? t.common.close : t.common.edit}
      </button>
      {edit && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Text label={r.shipment} value={p.shipmentNumber} onChange={(v) => onChange({ shipmentNumber: v ?? "" })} dir="ltr" />
          </div>
          <div className="col-span-2">
            <Text label={r.printedField} value={p.printedNumber} inputMode="numeric" onChange={(v) => onChange({ printedNumber: v })} dir="ltr" />
          </div>
          <div className="col-span-2">
            <Text label={r.description} value={p.description} onChange={(v) => onChange({ description: v })} />
          </div>
          <Num label={r.packages} value={p.packagesExpected} integer onChange={(v) => onChange({ packagesExpected: v ?? 0, isGrouped: (v ?? 0) > 1 || p.borderoNumbers.length > 0 })} />
          <Num label={r.weightField} value={p.weightKg} onChange={(v) => onChange({ weightKg: v ?? 0 })} />
          <Num label={r.valueField} value={p.valueEur} onChange={(v) => onChange({ valueEur: v })} />
          <Text label={r.zip} value={p.deliveryZip} inputMode="numeric" onChange={(v) => onChange({ deliveryZip: v })} dir="ltr" />
          <div className="col-span-2">
            <Text label={r.city} value={p.deliveryCity} onChange={(v) => onChange({ deliveryCity: v })} />
          </div>
        </div>
      )}
    </article>
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-block rounded-lg border-2 px-2 py-0.5 text-sm font-bold ${className}`}>{children}</span>;
}

const inputCls = "h-14 w-full rounded-xl border-2 border-brand-indigo/40 bg-white px-3 text-lg focus:border-brand-indigo";

function Text({ label, value, onChange, ...props }: { label: string; value: string | null; onChange: (v: string | null) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={inputCls} {...props} />
    </label>
  );
}

/** Champ numérique au format français (« 3 673,5 ») ; la valeur n'est appliquée que si elle est valide. */
function Num({ label, value, onChange, integer }: { label: string; value: number | null; onChange: (v: number | null) => void; integer?: boolean }) {
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  const parsed = text.trim() === "" ? null : Number(text.replace(/\s/g, "").replace(",", "."));
  const invalid = parsed != null && (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed)));
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <input
        value={text}
        dir="ltr"
        inputMode={integer ? "numeric" : "decimal"}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const raw = e.target.value.trim();
          const n = raw === "" ? null : Number(raw.replace(/\s/g, "").replace(",", "."));
          if (n === null || (Number.isFinite(n) && n >= 0 && (!integer || Number.isInteger(n)))) onChange(n);
        }}
        className={`${inputCls} aria-[invalid=true]:border-alert aria-[invalid=true]:bg-red-50`}
      />
    </label>
  );
}
