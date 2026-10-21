"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";
import { listItems, onOutboxChange } from "@/lib/client/outbox";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** Réseau + nombre de scans encore sur le téléphone (envoyés automatiquement au retour du réseau). */
export function OnlineBadge() {
  const { t } = useI18n();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!("indexedDB" in window)) return;
    const refresh = () => void listItems().then((l) => setPending(l.length)).catch(() => {});
    refresh();
    return onOutboxChange(refresh);
  }, []);
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2 py-0.5 text-xs font-bold ${
        online ? "border-white/40 text-white" : "border-brand-ink bg-yellow-300 text-brand-ink"
      }`}
    >
      <span aria-hidden className={`size-2.5 rounded-full ${online ? "bg-green-400" : "bg-brand-ink"}`} />
      {online ? t.header.online : t.header.offline}
      {pending > 0 && <span className="rounded-full bg-brand-green px-1.5 text-brand-ink">{t.header.pending(pending)}</span>}
    </span>
  );
}
