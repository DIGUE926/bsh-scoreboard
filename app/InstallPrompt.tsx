"use client";

import { useEffect, useState } from "react";

// Bouton "Installer l'app" flottant — même pattern que bsh-web.
const DISMISS_KEY = "bsh-scoreboard-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIOS() {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Détection ponctuelle au montage (localStorage / UA), pas un état
    // dérivé de props : pas de re-render en cascade possible ici.
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture localStorage/UA une seule fois au montage
    setDismissed(false);

    if (isIOS()) {
      setShowIOSHint(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (dismissed) return null;
  if (!showIOSHint && !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
      <div className="bg-bsh-black border border-bsh-orange/40 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-bsh-orange/15 flex items-center justify-center shrink-0">
          <span className="font-display text-bsh-orange text-xs tracking-tight">BSH</span>
        </div>

        {showIOSHint ? (
          <div className="flex-1 text-sm text-white/80 leading-snug">
            Installe BSH Scoreboard : appuie sur{" "}
            <svg
              className="inline-block align-text-bottom mx-0.5"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>{" "}
            puis <span className="text-bsh-orange font-semibold">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
          </div>
        ) : (
          <div className="flex-1 text-sm text-white/80">Installe BSH Scoreboard sur ton appareil</div>
        )}

        {!showIOSHint && deferredPrompt && (
          <button
            onClick={install}
            className="bg-bsh-orange text-black text-xs font-bold rounded-lg px-3 py-2 shrink-0 hover:opacity-90 transition-opacity"
          >
            Installer 📲
          </button>
        )}

        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="text-white/40 hover:text-white/70 shrink-0 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
