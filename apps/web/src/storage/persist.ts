/**
 * Durabilidade do armazenamento.
 *
 * Isto NAO e polimento. O Safari faz eviction proativa: se uma origem fica
 * **7 dias sem interacao do usuario**, ele apaga IndexedDB, Cache API,
 * localStorage e Service Worker — tudo de uma vez, sem aviso. Sete dias sem
 * abrir um app de colecao de Pokemon e completamente normal, entao sem isto a
 * colecao do usuario simplesmente evapora.
 *
 * A unica isencao documentada e estar em "persistent mode", e o WebKit cita
 * nominalmente "ser um Home Screen Web App" como heuristica pra conceder. Por
 * isso instalar na tela de inicio e mecanismo de durabilidade, nao conveniencia.
 */

export type PersistState =
  | { supported: false }
  | { supported: true; persisted: boolean; usageBytes: number | null; quotaBytes: number | null };

export async function requestPersistence(): Promise<PersistState> {
  if (!("storage" in navigator) || !navigator.storage?.persist) {
    return { supported: false };
  }

  let persisted = await navigator.storage.persisted();
  if (!persisted) {
    // Safari e Chromium decidem sozinhos por heuristica, sem mostrar prompt.
    // Chamar de novo depois da instalacao costuma mudar a resposta.
    persisted = await navigator.storage.persist();
  }

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  if (navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      usageBytes = est.usage ?? null;
      quotaBytes = est.quota ?? null;
    } catch {
      // estimate() e opcional; a ausencia dela nao muda a durabilidade.
    }
  }

  return { supported: true, persisted, usageBytes, quotaBytes };
}

/** True quando o app roda instalado (standalone), e nao numa aba do browser. */
export function isInstalled(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS antigo nao suporta a media query e usa esta propriedade nao padrao.
  return (navigator as { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ se apresenta como Mac; o toque desempata.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
