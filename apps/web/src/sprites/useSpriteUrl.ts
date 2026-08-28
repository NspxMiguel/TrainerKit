import { useEffect, useState, useSyncExternalStore } from "react";

import {
  arteEmMemoria,
  assinarArmazem,
  carregarIndice,
  pegarArte,
  temNoArmazem,
  versaoDoArmazem,
} from "./armazem.ts";
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
 * Tres caminhos, nesta ordem, e a ordem e a resposta pro "demora 1 a 3 segundos
 * mesmo depois de baixado":
 *
 *   1. ARMAZEM LOCAL (`armazem.ts`) — se a imagem foi baixada, ela sai do
 *      IndexedDB, sem tocar a rede. E o caminho que faz "baixado" significar
 *      alguma coisa em origem insegura, onde nao existe service worker;
 *   2. fonte do usuario (`src:`) — o .zip que ele importou, tambem local;
 *   3. a URL remota — quem nunca baixou continua vendo tudo, sob demanda.
 *
 * Fontes por URL resolvem na hora; o resto precisa ler o blob do IndexedDB,
 * entao a resposta chega depois. O tile ja lida com isso mostrando o monograma
 * enquanto nao chega — nao ha estado intermediario feio.
 */
export function useSpriteUrl(keys: Keys): string | null {
  const settings = useSpriteSettings();
  const sources = useSources();
  const [resolved, setResolved] = useState<string | null>(null);
  /*
   * A leitura local pode falhar mesmo com o indice dizendo que tem: banco
   * apagado por outra aba, cota estourada no meio da gravacao, modo privado.
   * Sem esta saida o tile ficaria no monograma para sempre — com ela, ele
   * volta pro caminho de rede, que e o comportamento de quem nunca baixou.
   */
  const [semLocal, setSemLocal] = useState<string | null>(null);

  /*
   * A grade monta antes de o indice do armazem chegar do disco. Sem assinar, os
   * 60 tiles decidiriam "nao tenho" e iriam pra rede — e nunca reconsiderariam.
   */
  useSyncExternalStore(assinarArmazem, versaoDoArmazem, () => -1);

  const custom = settings.source.startsWith("src:")
    ? (sources ?? []).find((s) => `src:${s.id}` === settings.source)
    : undefined;

  const remota = custom ? null : spriteUrl({ spriteId: keys.spriteId, dex: keys.dex }, settings);

  /*
   * ⚠️ SINCRONO DE PROPOSITO. `SpeciesTile` decide no inicializador do
   * `useState` se a arte ja pode nascer visivel; uma resposta que so chega no
   * efeito seguinte traz de volta o quadro de monograma que aquele codigo
   * existe pra evitar. Por isso a memoria e consultada aqui, no corpo.
   */
  const local = remota !== null ? arteEmMemoria(remota) : null;
  const guardadaNoDisco =
    remota !== null && local === null && semLocal !== remota && temNoArmazem(remota);

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

  /*
   * Le o blob guardado. Sem revogar na saida: o endereco fica no cache do
   * armazem, compartilhado por todos os tiles da mesma especie, e quem decide
   * quando revogar e o teto de la. Revogar aqui derrubaria a imagem da ficha no
   * instante em que a lista atras dela desmontasse.
   */
  useEffect(() => {
    if (!guardadaNoDisco || remota === null) return;
    let vivo = true;
    void pegarArte(remota).then((url) => {
      if (!vivo) return;
      if (url) setResolved(url);
      else setSemLocal(remota);
    });
    return () => {
      vivo = false;
    };
  }, [guardadaNoDisco, remota]);

  // Garante que o indice sera lido nem que ninguem mais peca.
  useEffect(() => {
    void carregarIndice();
  }, []);

  if (custom) return resolved;
  if (local !== null) return local;
  if (guardadaNoDisco) return resolved;
  return remota;
}
