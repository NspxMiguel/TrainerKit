import { useEffect, useState } from "react";

import { isInstalled, isIos } from "./persist.ts";

/**
 * Evento do Chrome que permite disparar o instalador nativo.
 *
 * Nao existe na tipagem padrao do DOM porque so o Chromium implementa. O Safari
 * nunca vai ter: no iOS a instalacao e sempre manual, pelo menu Compartilhar.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(): Platform {
  /*
   * `?platform=ios` no dev.
   *
   * O visual do iOS 26 — vidro flutuante, barra que recolhe, guia do Safari —
   * so aparece num iPhone, e verificar cada ajuste no aparelho de verdade
   * custa minutos por mudanca. Com isto da pra ver no navegador.
   *
   * `import.meta.env.DEV` e substituido por `false` no build de producao, entao
   * o bloco inteiro e removido pelo empacotador. Ninguem consegue forcar
   * plataforma no site publicado.
   */
  if (import.meta.env.DEV) {
    const forced = new URLSearchParams(location.search).get("platform");
    if (forced === "ios" || forced === "android" || forced === "desktop") return forced;
  }

  if (isIos()) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "desktop";
}

const DISMISSED_KEY = "tk:instalar-dispensado";

export interface InstallState {
  /** Ja roda instalado — nao ha o que sugerir. */
  installed: boolean;
  platform: Platform;
  /** Disponivel quando o navegador permite abrir o instalador nativo. */
  promptInstall: (() => Promise<boolean>) | null;
  dismissed: boolean;
  dismiss: () => void;
}

export function useInstallState(): InstallState {
  const [installed, setInstalled] = useState(isInstalled);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1",
  );

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Sem isto o Chrome mostra a propria barra, que compete com a nossa.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // O modo de exibicao muda sem recarregar quando o usuario instala e abre.
    const standalone = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setInstalled(isInstalled());
    standalone.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      standalone.removeEventListener("change", onDisplayChange);
    };
  }, []);

  return {
    installed,
    platform: detectPlatform(),
    promptInstall: deferred
      ? async () => {
          await deferred.prompt();
          const { outcome } = await deferred.userChoice;
          setDeferred(null);
          return outcome === "accepted";
        }
      : null,
    dismissed,
    dismiss: () => {
      localStorage.setItem(DISMISSED_KEY, "1");
      setDismissed(true);
    },
  };
}
