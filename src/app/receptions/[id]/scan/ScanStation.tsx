"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { compressImage } from "@/lib/client/compress-image";
import { errorText } from "@/lib/client/errors";
import { feedback } from "@/lib/client/feedback";
import { addItem, listItems, onOutboxChange, removePendingScan, STATE_EVENT, syncReception, type OutboxItem, type ScanStateEvent } from "@/lib/client/outbox";
import { matchCode, type MatchPosition } from "@/lib/scan/match";
import { DAMAGE_TYPES, type SyncResponse } from "@/lib/scan/ops";

const CameraScanner = dynamic(() => import("@/components/CameraScanner").then((m) => m.CameraScanner), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-brand-indigo/20" />,
});

export type StationPosition = MatchPosition & {
  description: string | null;
  deliveryCity: string | null;
  packagingType: string | null;
};

type Mode = "camera" | "douchette" | "clavier";
type Tone = "ok" | "warn" | "error";
type Last = { tone: Tone; title: string; detail: string; clientId?: string; positionId?: string | null; counted?: boolean };
type DamageType = (typeof DAMAGE_TYPES)[number];

const MODE_KEY = "scan-mode";
const TONE_STYLE: Record<Tone, string> = {
  ok: "border-ok bg-green-50",
  warn: "border-amber-600 bg-amber-50",
  error: "border-alert bg-red-50",
};
const TONE_ICON: Record<Tone, string> = { ok: "✓", warn: "!", error: "✕" };

/**
 * Poste de scan d'un camion : chaque colis scanné est rapproché de la CMR sur le téléphone (réponse immédiate,
 * même sans réseau), enregistré dans IndexedDB, puis envoyé au serveur qui refait le rapprochement et fait foi.
 */
export function ScanStation({ receptionId, listNumber, positions: basePositions, initial }: { receptionId: string; listNumber: string | null; positions: StationPosition[]; initial: SyncResponse }) {
  const { t } = useI18n();
  const ts = t.scan;
  const [server, setServer] = useState(initial);
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("camera");
  const [last, setLast] = useState<Last | null>(null);
  const [damageFor, setDamageFor] = useState<Last | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const wedgeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY) as Mode | null;
      if (m === "camera" || m === "douchette" || m === "clavier") setMode(m);
    } catch {
      // stockage indisponible : mode caméra
    }
  }, []);
  const chooseMode = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // sans importance
    }
  };

  // File d'attente locale de cette réception
  const reload = useCallback(() => void listItems(receptionId).then(setPending).catch(() => {}), [receptionId]);
  useEffect(() => {
    reload();
    return onOutboxChange(reload);
  }, [reload]);

  // État renvoyé par le serveur à chaque synchro (de ce téléphone)
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ScanStateEvent>).detail;
      if (d.receptionId !== receptionId) return;
      setServer(d.state);
      setApplied((a) => new Set([...a, ...d.applied]));
      setSyncError(null);
    };
    window.addEventListener(STATE_EVENT, on);
    return () => window.removeEventListener(STATE_EVENT, on);
  }, [receptionId]);

  // Scans des autres téléphones sur le même camion
  useEffect(() => {
    const t = setInterval(() => {
      if (!navigator.onLine || document.hidden) return;
      fetch(`/api/receptions/${receptionId}/scans`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s: SyncResponse | null) => s && setServer(s))
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(t);
  }, [receptionId]);

  const sync = useCallback(() => {
    syncReception(receptionId).catch((e: Error) => setSyncError(errorText(t, e.message) ?? null));
  }, [receptionId, t]);

  // Compteurs affichés = serveur + opérations encore sur le téléphone
  const live = pending.filter((i) => i.op && !applied.has(`${i.op.type}:${i.op.clientId}`));
  const positions = useMemo(() => {
    const srv = new Map(server.positions.map((p) => [p.id, p.packagesReceived]));
    const delta = new Map<string, number>();
    for (const i of live) {
      if (!i.local?.positionId || !i.local.counted || !i.op) continue;
      const q = i.op.type === "scan" ? (i.op.quantity ?? 1) : i.op.type === "cancel" ? -1 : 0;
      delta.set(i.local.positionId, (delta.get(i.local.positionId) ?? 0) + q);
    }
    return basePositions.map((p) => ({ ...p, packagesReceived: (srv.get(p.id) ?? p.packagesReceived) + (delta.get(p.id) ?? 0) }));
  }, [basePositions, server, live]);

  const scanned = useMemo(() => {
    const s = new Set(server.scannedCodes);
    for (const i of live) if (i.local?.counted && i.local.normalized !== "MANUEL" && i.op?.type === "scan") s.add(i.local.normalized);
    return s;
  }, [server, live]);

  const here = positions.filter((p) => !p.isOffAddress);
  const expected = here.reduce((s, p) => s + p.packagesExpected, 0);
  const received = here.reduce((s, p) => s + Math.min(p.packagesReceived, p.packagesExpected), 0);
  const surplus = here.reduce((s, p) => s + Math.max(0, p.packagesReceived - p.packagesExpected), 0);
  const remaining = here.filter((p) => p.packagesReceived < p.packagesExpected);
  const done = here.filter((p) => p.packagesReceived >= p.packagesExpected);
  const offs = positions.filter((p) => p.isOffAddress);
  const unknownLocal = live.filter((i) => i.op?.type === "scan" && !i.local?.positionId && !i.op.positionId);
  const pendingCount = pending.length;

  async function enqueueScan(raw: string, local: OutboxItem["local"], extra?: { positionId: string; quantity: number }) {
    const clientId = crypto.randomUUID();
    await addItem({ receptionId, op: { type: "scan", clientId, rawCode: raw, scannedAt: new Date().toISOString(), ...extra }, local });
    sync();
    return clientId;
  }

  async function handleCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const { normalized, result } = matchCode(code, positions, scanned);

    if (result.kind === "duplicate") {
      feedback("warn");
      setLast({ tone: "warn", title: ts.duplicateTitle, detail: ts.duplicateDetail(result.position?.lineNumber ?? null) });
      return;
    }
    if (result.kind === "unknown" && result.wrongBarcode) {
      feedback("warn");
      setLast({ tone: "warn", title: ts.wrongTitle, detail: ts.wrongDetail });
      return;
    }
    if (result.kind === "unknown") {
      const clientId = await enqueueScan(code, { positionId: null, counted: false, normalized });
      feedback("error");
      setLast({ tone: "error", title: ts.unknownTitle, detail: ts.unknownDetail(normalized), clientId, positionId: null, counted: false });
      return;
    }

    const p = result.position as StationPosition;
    const clientId = await enqueueScan(code, { positionId: p.id, counted: true, normalized });
    const count = `${p.packagesReceived + 1}/${p.packagesExpected}`;
    if (p.isOffAddress) {
      feedback("error");
      setLast({ tone: "error", title: ts.offTitle(p.deliveryCity ?? ts.otherSite), detail: ts.offDetail(p.lineNumber, p.shipmentNumber), clientId, positionId: p.id, counted: true });
    } else if (result.surplus) {
      feedback("warn");
      setLast({ tone: "warn", title: ts.surplusTitle(p.lineNumber), detail: ts.surplusDetail(p.description ?? ts.defaultDesc, p.shipmentNumber, count), clientId, positionId: p.id, counted: true });
    } else {
      feedback("ok");
      setLast({
        tone: "ok",
        title: ts.okTitle(p.lineNumber, count),
        detail: ts.okDetail(p.description ?? ts.defaultDesc, p.shipmentNumber) + (result.ambiguous ? ts.ambiguous : ""),
        clientId,
        positionId: p.id,
        counted: true,
      });
    }
  }

  async function manualReceive(p: StationPosition) {
    const clientId = await enqueueScan("MANUEL", { positionId: p.id, counted: true, normalized: "MANUEL" }, { positionId: p.id, quantity: 1 });
    feedback("ok");
    setLast({ tone: "ok", title: ts.okTitle(p.lineNumber, `${p.packagesReceived + 1}/${p.packagesExpected}`), detail: ts.manualDetail(p.description ?? ts.defaultDesc, p.shipmentNumber), clientId, positionId: p.id, counted: true });
  }

  async function cancelLast() {
    if (!last?.clientId) return;
    const removed = await removePendingScan(last.clientId);
    if (!removed) {
      await addItem({ receptionId, op: { type: "cancel", clientId: last.clientId }, local: { positionId: last.positionId ?? null, counted: !!last.counted, normalized: "" } });
      sync();
    }
    setLast({ tone: "warn", title: ts.cancelledTitle, detail: ts.cancelledDetail });
  }

  // Douchette : saisie clavier « invisible », validée par Entrée
  useEffect(() => {
    if (mode === "douchette" && !damageFor) wedgeRef.current?.focus();
  }, [mode, damageFor, last]);

  const pct = expected ? Math.round((received / expected) * 100) : 0;

  return (
    <div className="space-y-4 pb-10">
      {/* Avancement */}
      <section className="card p-4" aria-label={ts.progressAria}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wider text-brand-green-text">{t.common.list(listNumber ?? t.common.none)}</p>
            <p className="text-4xl font-black tabular-nums">
              <span dir="ltr">
                {received}
                <span className="text-2xl text-brand-ink/50">/{expected}</span>
              </span>{" "}
              <span className="text-lg font-bold">{t.common.packages}</span>
            </p>
          </div>
          <p className="text-end text-sm font-bold text-brand-ink/70">
            {ts.toReceivePositions(remaining.length)}
            {surplus > 0 && <span className="block text-amber-800">{ts.surplus(surplus)}</span>}
          </p>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-brand-indigo/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand-green transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
        {(pendingCount > 0 || syncError) && (
          <p className={`mt-2 text-sm font-bold ${syncError ? "text-alert" : "text-brand-ink/70"}`}>
            {syncError ?? ts.pendingOnPhone(pendingCount)}
          </p>
        )}
      </section>

      {/* Choix du lecteur */}
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={ts.readerAria}>
        {(
          [
            ["camera", ts.modeCamera],
            ["douchette", ts.modeWedge],
            ["clavier", ts.modeTyped],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => chooseMode(m)} className={`btn min-h-14 px-2 text-base ${mode === m ? "border-brand-indigo bg-brand-indigo text-white" : "border-brand-indigo/40 bg-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "camera" && <CameraScanner onCode={handleCode} paused={!!damageFor} />}

      {mode === "douchette" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = wedgeRef.current?.value ?? "";
            if (wedgeRef.current) wedgeRef.current.value = "";
            void handleCode(v);
          }}
          className="card flex items-center gap-3 border-dashed p-4"
        >
          <span aria-hidden className="size-4 animate-pulse rounded-full bg-brand-green" />
          <label className="flex-1">
            <span className="block font-bold">{ts.wedgeReady}</span>
            <input
              ref={wedgeRef}
              inputMode="none"
              autoComplete="off"
              dir="ltr"
              aria-label={ts.wedgeAria}
              onBlur={() => setTimeout(() => mode === "douchette" && !damageFor && wedgeRef.current?.focus(), 300)}
              className="mt-1 h-10 w-full rounded-lg border-2 border-brand-indigo/20 bg-brand-ground px-2 font-mono"
            />
          </label>
        </form>
      )}

      {mode === "clavier" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCode(typed);
            setTyped("");
          }}
          className="flex gap-2"
        >
          <input value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="numeric" dir="ltr" placeholder={ts.typedPlaceholder} aria-label={ts.typedAria} className="h-16 min-w-0 flex-1 rounded-xl border-2 border-brand-indigo/40 bg-white px-3 font-mono text-lg" />
          <button type="submit" className="btn-primary px-5">
            {t.common.ok}
          </button>
        </form>
      )}

      {/* Résultat du dernier scan */}
      {last && (
        <section aria-live="assertive" className={`rounded-2xl border-4 p-4 ${TONE_STYLE[last.tone]}`}>
          <div className="flex gap-3">
            <span aria-hidden className={`flex size-12 shrink-0 items-center justify-center rounded-full text-2xl font-black text-white ${last.tone === "ok" ? "bg-ok" : last.tone === "warn" ? "bg-amber-600" : "bg-alert"}`}>
              {TONE_ICON[last.tone]}
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-black leading-tight">{last.title}</p>
              <p className="mt-1 font-semibold">{last.detail}</p>
            </div>
          </div>
          {last.clientId && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDamageFor(last)} className="btn-outline min-h-14 text-base">
                {ts.damage}
              </button>
              <button type="button" onClick={cancelLast} className="btn-outline min-h-14 text-base">
                {ts.cancelScan}
              </button>
            </div>
          )}
        </section>
      )}

      {damageFor?.clientId && <DamageSheet receptionId={receptionId} clientId={damageFor.clientId} onDone={(msg) => (setDamageFor(null), msg && setLast({ ...damageFor, tone: "warn", title: ts.damageNoted, detail: msg }), sync())} />}

      {/* À recevoir */}
      <section className="card p-4">
        <h2 className="mb-2 text-lg font-extrabold">{ts.toReceive(remaining.reduce((s, p) => s + p.packagesExpected - p.packagesReceived, 0))}</h2>
        {remaining.length === 0 ? (
          <p className="font-bold text-ok">{ts.allReceived}</p>
        ) : (
          <ul className="divide-y-2 divide-brand-indigo/10">
            {remaining.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-bold">{p.shipmentNumber}</p>
                  <p className="truncate text-sm text-brand-ink/75">
                    {t.common.pos(p.lineNumber)} · {p.description ?? t.common.none}
                    {p.printedNumber && <span dir="ltr"> · …{p.printedNumber.slice(-6)}</span>}
                  </p>
                </div>
                <p dir="ltr" className="text-xl font-black tabular-nums">
                  {p.packagesReceived}/{p.packagesExpected}
                </p>
                <button type="button" onClick={() => manualReceive(p)} className="btn-outline min-h-14 px-3 text-base" aria-label={ts.plusAria(p.lineNumber)}>
                  {ts.plusOne(p.isGrouped)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-brand-ink/70">{ts.plusHelp}</p>
      </section>

      {(unknownLocal.length > 0 || server.unknown.length > 0) && (
        <section className="card border-alert/50 p-4">
          <h2 className="mb-2 text-lg font-extrabold text-alert">{ts.unknownList(unknownLocal.length + server.unknown.length)}</h2>
          <ul className="space-y-1 font-mono text-sm">
            {unknownLocal.map((i) => (
              <li key={i.op!.clientId}>
                {i.local?.normalized} · <span className="font-sans">{ts.waitingSend}</span>
              </li>
            ))}
            {server.unknown.map((u) => (
              <li key={u.clientId}>{u.rawCode}</li>
            ))}
          </ul>
        </section>
      )}

      {offs.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-extrabold">{ts.offList}</h2>
          <ul className="space-y-1">
            {offs.map((p) => (
              <li key={p.id} className="text-sm">
                <span className="font-mono font-bold">{p.shipmentNumber}</span> · {ts.offFor(p.deliveryCity ?? ts.otherSite)} · {p.packagesReceived > 0 ? <b className="text-alert">{ts.offArrived}</b> : ts.offAbsent}
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <details className="card p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">{ts.receivedList(done.length)}</summary>
          <ul className="mt-2 space-y-1">
            {done.map((p) => (
              <li key={p.id} className="text-sm">
                <span className="font-mono font-bold">{p.shipmentNumber}</span> · {p.description} · {p.packagesReceived}/{p.packagesExpected}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Link href={`/receptions/${receptionId}`} className="btn-secondary min-h-16 w-full text-lg">
        {ts.finish}
      </Link>
    </div>
  );
}

/** Avarie : type, commentaire et photo (gardés sur le téléphone puis envoyés avec le scan). */
function DamageSheet({ receptionId, clientId, onDone }: { receptionId: string; clientId: string; onDone: (msg: string | null) => void }) {
  const { t } = useI18n();
  const ts = t.scan;
  const [type, setType] = useState<DamageType | null>(null);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (!type) return;
    setBusy(true);
    await addItem({ receptionId, op: { type: "damage", clientId, damageType: type, comment: comment.trim() || null } });
    if (photo) await addItem({ receptionId, photo: { clientId, photoId: crypto.randomUUID(), blob: photo } });
    onDone(`${t.damage[type]}${comment.trim() ? ` · ${comment.trim()}` : ""}${photo ? ` · ${ts.photoAttached}` : ""}`);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={ts.damageTitle} className="fixed inset-0 z-30 flex items-end bg-brand-ink/50" onClick={() => onDone(null)}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-xl font-extrabold">{ts.damageTitle}</h2>
        <div className="grid grid-cols-2 gap-2">
          {DAMAGE_TYPES.map((d) => (
            <button key={d} type="button" onClick={() => setType(d)} aria-pressed={type === d} className={`btn min-h-14 px-2 text-base ${type === d ? "border-alert bg-alert text-white" : "border-brand-indigo/40 bg-white"}`}>
              {t.damage[d]}
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={ts.damageComment} aria-label={ts.damageComment} rows={2} className="mt-3 w-full rounded-xl border-2 border-brand-indigo/40 p-3 text-lg" />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={async (e) => e.target.files?.[0] && setPhoto(await compressImage(e.target.files[0], 1600, 0.8))} />
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline mt-3 w-full">
          {photo ? ts.damagePhotoTaken : ts.damagePhoto}
        </button>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onDone(null)} className="btn-outline">
            {t.common.cancel}
          </button>
          <button type="button" onClick={save} disabled={!type || busy} className="btn-primary">
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
