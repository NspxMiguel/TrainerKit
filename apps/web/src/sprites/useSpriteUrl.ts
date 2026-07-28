import { useEffect, useState } from "react";

import { spriteUrl } from "./provider.ts";
import { useSpriteSettings } from "./settings.ts";
import { listSources, resolveFromSource, type SpriteSource } from "./sources.ts";

/**
 * Cache de fontes em memoria.
 *
 * Sem isto, cada tile da grade faria uma consulta ao IndexedDB so pra descobrir
 * qual fonte esta ativa — sessenta consultas identicas por tela.
 */
let cachedSources: SpriteSource[] | null = null;
const sourceListeners = new Set<() => void>();

export async function refreshSources(): Promise<SpriteSource[]> {
  cachedSources = await listSources();
  for (const fn of sourceListeners) fn();
  return cachedSources;
}

export function useSources(): SpriteSource[] | null {
  const [sources, setSources] = useState(cachedSources);

  useEffect(() => {
    const update = () => setSources(cachedSources);
    sourceListeners.add(update);
    if (cachedSources === null) void refreshSources();
    return () => {
      sourceListeners.delete(update);
    };
  }, []);

  return sources;
}

interface Keys {
  dex: number;
  speciesId: string;
  spriteId: number | null;
}

/**
 * URL da imagem de uma especie na fonte ativa.
 *
 * Fontes por URL resolvem na hora; fontes de .zip precisam ler o blob do
 * IndexedDB, entao a resposta chega depois. O tile ja lida com isso mostrando o
 * monograma enquanto nao chega — nao ha estado intermediario feio.
 */
export function useSpriteUrl(keys: Keys): string | null {
  const settings = useSpriteSettings();
  const sources = useSources();
  const [resolved, setResolved] = useState<string | null>(null);

  const custom = settings.source.startsWith("src:")
    ? (sources ?? []).find((s) => `src:${s.id}` === settings.source)
    : undefined;

  useEffect(() => {
    if (!custom) {
      setResolved(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void resolveFromSource(custom, keys).then((url) => {
      if (cancelled) {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
        return;
      }
      if (url?.startsWith("blob:")) objectUrl = url;
      setResolved(url);
    });

    return () => {
      cancelled = true;
      // Blob nao revogado vaza memoria: cada tile da grade criaria um novo a
      // cada scroll.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [custom, keys.dex, keys.speciesId, keys.spriteId]);

  if (custom) return resolved;
  return spriteUrl({ spriteId: keys.spriteId, dex: keys.dex }, settings);
}
