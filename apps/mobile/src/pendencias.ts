import { useMemo } from "react";

import {
  ACOES_QUE_COBRAM,
  cumpriu,
  decide,
  fazGigantamax,
  tetoDePowerUp,
  type Action,
  type Verdict,
} from "@trainerkit/core";

import { useColecao, type Guardado } from "./colecao";
import type { Base, Especie } from "./dados";
import { useSetup } from "./setup";

/**
 * O QUE PEDE DECISÃO.
 *
 * ⚠️ Isto é a MESMA regra de `apps/web/src/storage/pendencias.ts`, e as três
 * condições importam — a do meio é a que se esquece: o que a pessoa DISCORDOU
 * sai da conta. O veredito continua calculado e visível na ficha; o que ele
 * perde é o direito de cobrar.
 *
 * ⚠️ `descobrir` vem PRIMEIRO e a ordem é a da fila. Enquanto o IV não for
 * medido nenhum outro veredito daquele bicho vale, e escanear um print custa
 * menos que qualquer das outras ações.
 */
export const PEDEM_ACAO: readonly Action[] = [
  "descobrir",
  ...ACOES_QUE_COBRAM.filter((a) => a !== "descobrir"),
];

export interface Pendencia {
  guardado: Guardado;
  especie: Especie;
  veredito: Verdict;
}

/** O veredito de um exemplar guardado, com os dados de hoje. */
export function vereditoDe(
  guardado: Guardado,
  especie: Especie,
  dados: Base,
  nivelDoTreinador: number,
): Verdict {
  return decide({
    ivDesconhecido: guardado.ivDesconhecido === true,
    name: especie.name,
    baseStats: especie.baseStats,
    ivs: guardado.ivs,
    level: guardado.level ?? 20,
    cpm: dados.cpm,
    levelCap: tetoDePowerUp(nivelDoTreinador, dados.version.levelCap),
    evolvesInto: especie.evolvesInto,
    candyToEvolve: especie.evolvesInto[0]
      ? (especie.candyToEvolve[especie.evolvesInto[0]] ?? null)
      : null,
    lucky: guardado.lucky,
    shadow: guardado.shadow,
    gigantamax: fazGigantamax(especie.id, dados.dynamax),
  });
}

/**
 * A fila — quem ainda pede uma decisão, na ordem em que ela vale a pena.
 *
 * ⚠️ Devolve a LISTA e não só o número: o Início precisa do primeiro item para
 * o herói, e a aba precisa do tamanho. Calcular duas vezes daria duas verdades.
 */
export function usePendencias(dados: Base | null): Pendencia[] {
  const { itens } = useColecao();
  const { setup } = useSetup();

  return useMemo(() => {
    if (!dados || !itens) return [];

    const fila: Pendencia[] = [];
    for (const g of itens) {
      const especie = dados.species.find((s) => s.id === g.speciesId);
      if (!especie) continue;
      const veredito = vereditoDe(g, especie, dados, setup.level);
      if (
        !cumpriu(veredito.action, g.doneAction) &&
        g.meuMotivo == null &&
        PEDEM_ACAO.includes(veredito.action)
      ) {
        fila.push({ guardado: g, especie, veredito });
      }
    }

    /* A ordem é a do `PEDEM_ACAO`: descobrir antes de tudo, porque sem IV
       medido os outros vereditos daquele bicho não valem nada. */
    return fila.sort(
      (a, b) => PEDEM_ACAO.indexOf(a.veredito.action) - PEDEM_ACAO.indexOf(b.veredito.action),
    );
  }, [itens, dados, setup.level]);
}
