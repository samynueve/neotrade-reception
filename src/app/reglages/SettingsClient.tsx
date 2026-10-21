"use client";

import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { logoutAction } from "@/lib/actions/auth";
import { listItems } from "@/lib/client/outbox";
import { getPrefs, setPrefs, type Prefs } from "@/lib/client/prefs";

/** Son et vibration au scan (propres à ce téléphone). */
export function DevicePrefs() {
  const { t } = useI18n();
  const [prefs, update] = useState<Prefs>({ sound: true, vibration: true });
  useEffect(() => update(getPrefs()), []);
  const rows: [keyof Prefs, string][] = [
    ["sound", t.settings.sound],
    ["vibration", t.settings.vibration],
  ];
  return (
    <section className="card space-y-3 p-4">
      {rows.map(([key, label]) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="font-bold">{label}</span>
          <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={prefs[key] === v}
                onClick={() => update(setPrefs({ [key]: v }))}
                className={`btn min-h-12 px-4 text-base ${prefs[key] === v ? "border-brand-indigo bg-brand-indigo text-white" : "border-brand-indigo/30 bg-white"}`}
              >
                {v ? t.settings.on : t.settings.off}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Déconnexion : prévient si des scans ne sont pas encore partis, et vide les pages gardées hors ligne
 * pour que l'utilisateur suivant du téléphone ne voie pas les écrans du précédent.
 */
export function LogoutButton() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  async function logout() {
    const waiting = "indexedDB" in window ? await listItems().then((l) => l.length).catch(() => 0) : 0;
    if (waiting > 0 && !window.confirm(t.settings.logoutPending(waiting))) return;
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("pages-")).map((k) => caches.delete(k)));
    }
    start(() => logoutAction());
  }
  return (
    <button type="button" onClick={logout} disabled={pending} className="btn-secondary w-full">
      {t.settings.logout}
    </button>
  );
}
