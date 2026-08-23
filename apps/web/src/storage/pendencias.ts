import { useMemo } from "react";

import {
  ACOES_QUE_COBRAM,
  cumpriu,
  decide,
  fazGigantamax,
  type Action,
} from "@trainerkit/core";

import type { DatasetState } from "../data/useDataset.ts";
import { tetoDePowerUp, useSetup } from "../onboarding/setup.ts";
import { useCollection } from "./collection.ts";

/**
 * Quantos especie pedem uma decisao hoje.
 *
 * ── Por que isto virou modulo, em vez de mais um calculo na barra ───────────
 *
 * O documento de desktop poe um selo com esse numero ao lado de "Especies" na
 * barra lateral. O numero ja existia — a Home calcula ele — mas dentro de um
 * `useMemo` que devolve muito mais coisa (a fila ordenada, o melhor, os
 * perfeitos), e a barra nao tem como alcancar aquilo.
 *
 * A saida obvia era copiar o filtro pra `App.tsx`. Nao dava: e exatamente o que
 * a nota do `PEDEM_ACAO` avisa — "duas telas com a mesma regra escrita em dois
 * lugares divergem; ja divergiram antes, neste mesmo app". O selo diria 4 e a
 * Home diria 3 no dia em que alguem mexesse num dos dois.
 *
 * Entao a REGRA mora aqui e as duas leem daqui.
 *
 * ── Sobre rodar o veredito duas vezes ────────────────────────────────────────
 *
 * Roda: a Home faz a passada dela (que precisa de mais campos) e esta faz a
 * sua. Parece caro e nao e, pelo mesmo motivo que a `CollectionScreen` ja
 * documenta na contagem da faxina: `rankOf` guarda a tabela de stat product por
 * especie e liga, entao a segunda passada volta do cache. O que custa
 * milissegundos e a PRIMEIRA.
 *
 * O `useMemo` fecha o resto: sem ele isto recalcularia a cada render do app
 * inteiro — inclusive ao abrir uma folha, que nao muda colecao nenhuma.
 */

/**
 * O que conta como "pede decisao".
 *
 * ⚠️ `descobrir` VEM PRIMEIRO e a ordem e a da fila. Enquanto o IV nao for
 * medido, nenhum dos outros vereditos daquele especie vale — e escanear um
 * print custa menos que qualquer uma das outras tres acoes.
 */
export const PEDEM_ACAO: readonly Action[] = [
  "descobrir",
  ...ACOES_QUE_COBRAM.filter((a) => a !== "descobrir"),
];

export function usePendencias(dataset: DatasetState): number {
  const { items } = useCollection();
  const setup = useSetup();
  const nivel = setup.level;
  const pronto = dataset.status === "ready";
  const data = pronto ? dataset.data : null;

  return useMemo(() => {
    if (!data || !items || setup.mode !== "colecao") return 0;

    return items.filter((owned) => {
      const s = data.species.find((x) => x.id === owned.speciesId);
      if (!s) return false;

      const verdict = decide({
        ivDesconhecido: owned.ivDesconhecido === true,
        name: s.name,
        baseStats: s.baseStats,
        ivs: owned.ivs,
        level: owned.level ?? 20,
        cpm: data.cpm,
        levelCap: tetoDePowerUp(nivel, data.version.levelCap),
        evolvesInto: s.evolvesInto,
        candyToEvolve: s.evolvesInto[0] ? (s.candyToEvolve[s.evolvesInto[0]] ?? null) : null,
        lucky: owned.lucky,
        shadow: owned.shadow,
        gigantamax: fazGigantamax(s.id, data.dynamax),
      });

      /*
       * As tres condicoes sao a MESMA regra da fila da Home, e a do meio e a
       * que se esquece: o que a pessoa DISCORDOU sai da conta.
       *
       * "e tem q ter um botão, discordo..." — o veredito continua calculado e
       * visivel na ficha; o que ele perde e o direito de COBRAR. Um selo que
       * conta bichos que a pessoa ja disse que vai ficar e insistencia.
       */
      return (
        !cumpriu(verdict.action, owned.doneAction) &&
        owned.meuMotivo == null &&
        PEDEM_ACAO.includes(verdict.action)
      );
    }).length;
  }, [items, data, nivel, setup.mode]);
}
