"use client";

import { useEffect } from "react";
import { onOutboxChange, syncAll } from "@/lib/client/outbox";

/** Envoie les scans en attente dès que le réseau revient, puis toutes les 20 secondes tant qu'il en reste. */
export function SyncAgent() {
  useEffect(() => {
    if (!("indexedDB" in window)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      clearTimeout(timer);
      void syncAll().finally(() => (timer = setTimeout(run, 20_000)));
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 400);
    };
    run();
    window.addEventListener("online", run);
    const off = onOutboxChange(soon);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", run);
      off();
    };
  }, []);
  return null;
}
