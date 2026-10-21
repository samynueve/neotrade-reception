"use client";

import type { ScanOp, SyncResponse } from "@/lib/scan/ops";

/**
 * File d'attente des scans sur le téléphone (IndexedDB).
 * Chaque scan y est écrit AVANT tout envoi : il survit à une coupure réseau, à la fermeture de l'appli ou à un redémarrage.
 * La synchro envoie les opérations dans l'ordre et ne les retire qu'une fois acceptées par le serveur.
 */
export type OutboxItem = {
  seq?: number;
  receptionId: string;
  op?: ScanOp;
  /** Photo d'avarie (envoyée après le scan correspondant) */
  photo?: { photoId: string; clientId: string; blob: Blob };
  /** Rapprochement fait sur le téléphone, pour l'affichage avant synchro */
  local?: { positionId: string | null; counted: boolean; normalized: string };
};

const DB_NAME = "neotrade-reception";
const STORE = "outbox";
const EVENT = "outbox-change";

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
      store.createIndex("receptionId", "receptionId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

const notify = () => window.dispatchEvent(new Event(EVENT));

export async function addItem(item: OutboxItem): Promise<void> {
  await tx("readwrite", (s) => s.add(item));
  notify();
}

export async function listItems(receptionId?: string): Promise<OutboxItem[]> {
  const all = ((await tx("readonly", (s) => (receptionId ? s.index("receptionId").getAll(receptionId) : s.getAll()))) ?? []) as OutboxItem[];
  return all.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

async function removeItems(seqs: number[]): Promise<void> {
  if (!seqs.length) return;
  await tx("readwrite", (s) => {
    for (const k of seqs) s.delete(k);
  });
  notify();
}

/** Retire un scan encore en attente (annulation avant envoi). Renvoie false s'il est déjà parti. */
export async function removePendingScan(clientId: string): Promise<boolean> {
  const item = (await listItems()).find((i) => i.op?.type === "scan" && i.op.clientId === clientId);
  if (!item) return false;
  await removeItems([item.seq!]);
  return true;
}

export const STATE_EVENT = "scan-state";
export type ScanStateEvent = { receptionId: string; state: SyncResponse; applied: string[] };

/** Abonnement aux changements de la file (nombre de scans en attente). */
export function onOutboxChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

const running = new Map<string, Promise<SyncResponse | null>>();

/** Envoie les opérations en attente d'une réception. Renvoie l'état du serveur, ou null si rien n'a pu partir. */
export function syncReception(receptionId: string): Promise<SyncResponse | null> {
  const current = running.get(receptionId);
  if (current) return current;
  const p = doSync(receptionId).finally(() => running.delete(receptionId));
  running.set(receptionId, p);
  return p;
}

async function doSync(receptionId: string): Promise<SyncResponse | null> {
  if (!navigator.onLine) return null;
  const items = await listItems(receptionId);
  const opItems = items.filter((i) => i.op && !i.photo);
  let state: SyncResponse | null = null;

  if (opItems.length) {
    const res = await fetch(`/api/receptions/${receptionId}/scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops: opItems.map((i) => i.op!) }),
    }).catch(() => null);
    if (!res) return null;
    // Le message est un code d'erreur, traduit par l'écran de scan
    if (res.status === 401) throw new Error("session_expired");
    if (res.status === 409 || res.status === 404) {
      // Réception clôturée ou supprimée : ces scans ne pourront jamais être acceptés
      const { error } = await res.json().catch(() => ({ error: "closed" }));
      throw new Error(error);
    }
    if (!res.ok) return null;
    state = (await res.json()) as SyncResponse;
    // L'écran de scan met d'abord à jour ses compteurs, puis les opérations quittent la file : pas de double comptage
    const applied = opItems.map((i) => `${i.op!.type}:${i.op!.clientId}`);
    window.dispatchEvent(new CustomEvent<ScanStateEvent>(STATE_EVENT, { detail: { receptionId, state, applied } }));
    await removeItems(opItems.map((i) => i.seq!));
  }

  for (const item of items.filter((i) => i.photo)) {
    const body = new FormData();
    body.append("clientId", item.photo!.clientId);
    body.append("photoId", item.photo!.photoId);
    body.append("photo", item.photo!.blob, "avarie.jpg");
    const res = await fetch(`/api/receptions/${receptionId}/scans/photo`, { method: "POST", body }).catch(() => null);
    if (res?.ok) await removeItems([item.seq!]);
    else break; // réessai à la prochaine synchro
  }
  return state;
}

/** Synchronise toutes les réceptions qui ont des scans en attente. */
export async function syncAll(): Promise<void> {
  const ids = [...new Set((await listItems()).map((i) => i.receptionId))];
  for (const id of ids) await syncReception(id).catch(() => null);
}
