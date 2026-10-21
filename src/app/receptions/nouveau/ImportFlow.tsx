"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Check, ReceptionDraft } from "@/lib/cmr/analyze";
import { useI18n } from "@/i18n/client";
import { compressImage } from "@/lib/client/compress-image";
import { errorText } from "@/lib/client/errors";
import { ImportReview } from "./ImportReview";

type Shot = { id: string; blob: Blob; url: string };
export type ImportResult = { importId: string; photoCount: number; draft: ReceptionDraft; checks: Check[]; duplicateOf: string | null };

const MAX_PHOTOS = 5;

/**
 * « Nouveau camion » : photos de la CMR (et du Fahrauftrag) → lecture automatique → relecture → création.
 */
export function ImportFlow() {
  const { t } = useI18n();
  const tf = t.importFlow;
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  // Libère les aperçus quand le composant disparaît
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setPreparing(true);
    try {
      const room = MAX_PHOTOS - shots.length;
      const files = Array.from(list).slice(0, room);
      const added = await Promise.all(
        files.map(async (f) => {
          const blob = await compressImage(f);
          return { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) };
        }),
      );
      setShots((s) => [...s, ...added]);
      if (list.length > room) setError(tf.maxPhotos(MAX_PHOTOS));
    } catch {
      setError(tf.photoUnreadable);
    } finally {
      setPreparing(false);
    }
  }

  function remove(id: string) {
    setShots((s) => {
      const gone = s.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return s.filter((x) => x.id !== id);
    });
  }

  async function read() {
    if (!navigator.onLine) {
      setError(tf.offline);
      return;
    }
    setBusy(true);
    setError(null);
    const body = new FormData();
    shots.forEach((s, i) => body.append("photos", s.blob, `photo-${i + 1}.jpg`));
    try {
      const res = await fetch("/api/cmr/lire", { method: "POST", body });
      const json = await res.json().catch(() => ({ error: "unexpected" }));
      if (!res.ok) throw new Error(json.error ?? "unexpected");
      setResult(json as ImportResult);
      window.scrollTo(0, 0);
    } catch (e) {
      // Code d'erreur du serveur, ou panne réseau pendant l'envoi
      setError(errorText(t, e instanceof Error && /^[a-z_]+$/.test(e.message) ? e.message : "no_connection") ?? null);
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ImportReview result={result} onRetake={() => setResult(null)} />;

  if (busy) {
    return (
      <div className="card flex flex-col items-center gap-4 p-8 text-center" role="status" aria-live="polite">
        <span aria-hidden className="size-14 animate-spin rounded-full border-[6px] border-brand-green border-t-brand-indigo" />
        <p className="text-xl font-extrabold">{tf.readingTitle}</p>
        <p className="text-brand-ink/75">
          {tf.readingDetail}
          <br />
          {tf.readingTime}
        </p>
        <p dir="ltr" className="font-mono text-2xl font-bold tabular-nums">
          {elapsed} s
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">{tf.title}</h1>
        <p className="mt-1 text-brand-ink/75">
          {tf.introA}
          <b>{tf.introCmr}</b>
          {tf.introB}
          <b>{tf.introFa}</b>
          {tf.introC}
        </p>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />

      {shots.length > 0 && (
        <ul className="grid grid-cols-3 gap-3" aria-label={tf.photosTaken}>
          {shots.map((s, i) => (
            <li key={s.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={t.common.photoN(i + 1)} className="aspect-[3/4] w-full rounded-xl border-2 border-brand-indigo/30 object-cover" />
              <span className="absolute start-1.5 top-1.5 rounded-md bg-brand-indigo px-1.5 text-sm font-bold text-white">{i + 1}</span>
              <button type="button" onClick={() => remove(s.id)} className="absolute -end-2 -top-2 flex size-11 items-center justify-center rounded-full border-2 border-white bg-alert text-xl font-bold text-white" aria-label={tf.removePhoto(i + 1)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {shots.length < MAX_PHOTOS && (
        <div className="grid gap-3">
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={preparing} className={`${shots.length ? "btn-outline" : "btn-primary"} min-h-20 w-full text-xl`}>
            <CameraIcon />
            {preparing ? tf.preparing : shots.length ? tf.addPage : tf.takePhoto}
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} disabled={preparing} className="btn-outline min-h-14 w-full text-base">
            {tf.gallery}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border-2 border-alert bg-red-50 p-3 font-bold text-alert">
          {error}
        </p>
      )}

      {shots.length > 0 && (
        <button type="button" onClick={read} className="btn-primary min-h-20 w-full text-2xl">
          {tf.read(shots.length)}
        </button>
      )}

      <section className="rounded-2xl border-2 border-dashed border-brand-indigo/30 p-4 text-brand-ink/80">
        <h2 className="mb-1 font-bold text-brand-ink">{tf.tipsTitle}</h2>
        <ul className="list-disc space-y-0.5 ps-5">
          {tf.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      <p className="text-center">
        <Link href="/receptions/nouveau?manuel=1" className="inline-flex min-h-12 items-center font-semibold underline">
          {tf.manual}
        </Link>
      </p>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.4-2h7l1.4 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  );
}
