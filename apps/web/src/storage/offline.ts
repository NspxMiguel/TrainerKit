import { useEffect, useState } from "react";

import { resolvedDatasetUrl } from "../data/source.ts";

/**
 * O que ja esta no aparelho, medido — e nao prometido.
 *
 * ── Por que este arquivo nao baixa nada ──────────────────────────────────────
 *
 * O handoff pede "um cartao com barra de progresso e a lista do que esta sendo
 * baixado: especies e evolucoes, tabela de tipos e counters, regras de veredito,
 * os prints do usuario, e a voz neural".
 *
 * Quatro dos cinco itens dessa lista NAO tem o que baixar, e o motivo esta
 * escrito no `vite.config.ts`:
 *
 *   · especies, evolucoes, tabela de tipos e counters sao o mesmo arquivo — o
 *     `gamedata.json`, que entra no PRE-CACHE do service worker. Ele ja esta no
 *     aparelho quando o app abre pela primeira vez;
 *   · as regras de veredito sao codigo, e codigo tambem esta no pre-cache;
 *   · os prints do usuario nunca saem do aparelho. Nao ha de onde baixar.
 *
 * Uma barra de progresso enchendo por cima de coisas que ja estao la seria uma
 * animacao de carregamento fingida — o tipo de coisa que este app inteiro evita.
 * Entao o cartao MEDE em vez de simular: pergunta ao `CacheStorage` o que
 * realmente esta guardado e mostra a resposta.
 *
 * ── O unico que falta de verdade ─────────────────────────────────────────────
 *
 * As imagens das especies. Sao ~150 MB para as 1.024, e por isso elas sao
 * buscadas sob demanda — a nota do `vite.config.ts` e explicita: "o app so paga
 * pelo que voce realmente olha". Quem quiser tudo offline tem o download com
 * progresso que ja existe (`sprites/prefetch.ts`), e e ele que o cartao oferece.
 *
 * ── O que ficou de fora, e por que ───────────────────────────────────────────
 *
 * A voz neural e o modelo de IA local nao aparecem aqui. Nao e esquecimento: os
 * dois sao guardados pelas proprias bibliotecas, fora do `CacheStorage`, entao
 * este modulo nao consegue afirmar se estao no aparelho — e afirmar sem medir e
 * exatamente o que ele existe pra nao fazer. Cada um ja tem o proprio estado na
 * tela onde e ligado.
 */

/** Um item do cartao. `pendente` significa "da pra baixar", nao "quebrado". */
export type EstadoOffline = "guardado" | "pendente" | "desconhecido";

export interface OfflineItem {
  id: "dados" | "leitor" | "imagens";
  estado: EstadoOffline;
  /** Quantos itens ha, quando a pergunta faz sentido. Sprites usam isto. */
  contagem?: { feito: number; total: number };
}

/** Nomes de cache do `vite.config.ts`. Mudou la, muda aqui. */
const CACHE_SPRITES = "tk-sprites";
const CACHE_OCR = "tk-ocr";

async function temAlgo(cache: string): Promise<EstadoOffline> {
  try {
    if (!("caches" in globalThis)) return "desconhecido";
    if (!(await caches.has(cache))) return "pendente";
    const c = await caches.open(cache);
    return (await c.keys()).length > 0 ? "guardado" : "pendente";
  } catch {
    return "desconhecido";
  }
}

async function quantosSprites(): Promise<number> {
  try {
    if (!("caches" in globalThis) || !(await caches.has(CACHE_SPRITES))) return 0;
    return (await caches.open(CACHE_SPRITES)).keys().then((k) => k.length);
  } catch {
    return 0;
  }
}

/**
 * O dataset esta guardado?
 *
 * ⚠️ `caches.match` SEM nome de cache, de proposito: o pre-cache do Workbox tem
 * nome gerado (`workbox-precache-v2-<origem>`) e ele muda a cada versao. Fixar o
 * nome aqui daria um cartao dizendo "pendente" para sempre depois do primeiro
 * deploy — e o dataset estaria la o tempo todo.
 *
 * `ignoreSearch` porque o Workbox guarda a URL com `?__WB_REVISION__=…`.
 */
async function temDataset(): Promise<EstadoOffline> {
  try {
    if (!("caches" in globalThis)) return "desconhecido";
    const hit = await caches.match(resolvedDatasetUrl(), { ignoreSearch: true });
    return hit ? "guardado" : "pendente";
  } catch {
    return "desconhecido";
  }
}

export async function medirOffline(totalEspecies: number): Promise<OfflineItem[]> {
  const [dados, leitor, sprites] = await Promise.all([
    temDataset(),
    temAlgo(CACHE_OCR),
    quantosSprites(),
  ]);

  return [
    { id: "dados", estado: dados },
    { id: "leitor", estado: leitor },
    {
      id: "imagens",
      /*
       * "guardado" so quando cobre a Pokedex inteira. Meio caminho e
       * `pendente` de proposito: o cartao responde "da pra ficar sem rede?", e
       * com metade das imagens a resposta e nao.
       */
      estado:
        totalEspecies > 0 && sprites >= totalEspecies
          ? "guardado"
          : sprites > 0
            ? "pendente"
            : "pendente",
      contagem: { feito: sprites, total: totalEspecies },
    },
  ];
}

/**
 * Mede na montagem e quando `chave` mudar.
 *
 * A medicao e assincrona e toca disco, entao ela NAO roda a cada render — quem
 * quiser remedir (depois de um download, depois de apagar) muda a `chave`.
 */
export function useOffline(totalEspecies: number, chave: unknown): OfflineItem[] | null {
  const [itens, setItens] = useState<OfflineItem[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void medirOffline(totalEspecies).then((r) => {
      if (vivo) setItens(r);
    });
    return () => {
      vivo = false;
    };
  }, [totalEspecies, chave]);

  return itens;
}
