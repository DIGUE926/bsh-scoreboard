"use client";

import { useEffect } from "react";

// Enregistre le service worker (public/sw.js) côté client uniquement.
// Un échec ici ne doit jamais casser l'app — c'est un plus PWA, pas une
// dépendance.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // silencieux : l'app marche normalement sans le SW
    });
  }, []);

  return null;
}
