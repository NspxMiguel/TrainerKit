import { useMemo } from "react";
import { Text, View } from "react-native";

import { GREAT_LEAGUE, topSpreads, type Key } from "@trainerkit/core";

import type { Base } from "./dados";
import { useT } from "./i18n";

/**
 * A DICA DO DIA.
 *
 * Existe porque um app que só responde quando perguntado nunca ensina nada — e
 * quase tudo que o TrainerKit sabe é contraintuitivo. Que o 100% costuma ser
 * PIOR em liga com teto, que ataque 15 vale mais que IV total em raide, que o
 * líder da Rocket bloqueia os dois primeiros carregados: isso muda como se
 * joga, e ficava enterrado em telas que a pessoa só abre depois de já ter
 * decidido errado.
 *
 * ⚠️ Todas saem de DADO REAL, calculado na hora. Nenhuma é frase decorativa —
 * seria a coisa mais fácil e a mais fora do espírito do app.
 *
 * ⚠️ Uma por dia, ESTÁVEL. Reabrir o app dez vezes não vira roleta: o índice
 * vem do número do dia, não de sorteio.
 */
export function DicaDoDia({ dados }: { dados: Base }) {
  const { t, idioma } = useT();

  const dica = useMemo(() => {
    const dia = Math.floor(Date.now() / 86_400_000);

    /* O exemplo do teto de PC é CALCULADO, não escrito: a espécie muda com o
       dia e o IV sai do próprio ranking da liga. */
    const vitrine = ["azumarill", "medicham", "skarmory", "bastiodon", "umbreon"];
    const escolhida = vitrine[dia % vitrine.length]!;
    const sp = dados.species.find((s) => s.id === escolhida);
    const melhor = sp ? topSpreads(dados.cpm, sp.baseStats, GREAT_LEAGUE, 1)[0] : undefined;

    const dicas: Array<{ chave: Key; params?: Record<string, string | number> }> = [
      ...(sp && melhor
        ? [
            {
              chave: "tip.capped" as Key,
              params: {
                name: sp.name,
                atk: melhor.ivs.atk,
                def: melhor.ivs.def,
                hp: melhor.ivs.hp,
              },
            },
          ]
        : []),
      { chave: "tip.raidAttack" },
      { chave: "tip.shadow" },
      { chave: "tip.rocket" },
      { chave: "tip.bars" },
      { chave: "tip.lucky" },
      {
        chave: "tip.species",
        params: {
          count: dados.canonicas.length.toLocaleString(idioma),
        },
      },
    ];

    return dicas[dia % dicas.length]!;
  }, [dados, idioma]);

  return (
    <View className="bg-superficie rounded-cartao px-4 py-4 mt-6">
      <Text className="text-texto3 text-legenda mb-2">{t("tip.title").toUpperCase()}</Text>
      <Text className="text-texto2 text-corpo leading-5">{t(dica.chave, dica.params)}</Text>
    </View>
  );
}
