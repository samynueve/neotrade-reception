"use client";

import { useEffect } from "react";

/** Enregistre le service worker (cache de l'application, page hors ligne). Désactivé en développement. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sans service worker l'application fonctionne, simplement sans mode hors ligne
    });
  }, []);
  return null;
}
