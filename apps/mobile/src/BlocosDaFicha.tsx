import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import {
  avaliarTroca,
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  topSpreads,
  ULTRA_LEAGUE,
  usos,
  type BaseStats,
  type IVs,
  type Key,
  type League,
  type Message,
} from "@trainerkit/core";

import type { Base, Especie } from "./dados";
import { useT } from "./i18n";
import { Segmented } from "./Segmented";
import { useTema } from "./tema";

/**
 * Os blocos da ficha que existiam SÓ NO PWA.
 *
 * ⚠️ Eles moram aqui e não em `especie/[id].tsx` porque aquela tela já tem
 * quase novecentas linhas: mais três blocos lá dentro e ninguém acha mais nada.
 * O que os une é serem *leituras* — recebem espécie e dataset, devolvem tela, e
 * não guardam estado do resto da ficha.
 */

/** As três ligas, na ordem em que o jogo as apresenta. */
const LIGAS: readonly League[] = [GREAT_LEAGUE, ULTRA_LEAGUE, MASTER_LEAGUE];

const ONDE: Record<string, Key> = {
  raide: "usos.raide",
  great: "usos.great",
  ultra: "usos.ultra",
  master: "usos.master",
};

const NIVEL: Record<string, Key> = {
  topo: "usos.topo",
  bom: "usos.bom",
  serve: "usos.serve",
};

function Titulo({ chave }: { chave: Key }) {
  const { t } = useT();
  return <Text className="text-texto3 text-legenda mt-7 mb-2">{t(chave).toUpperCase()}</Text>;
}

/**
 * PRA QUE SERVE — a posição dela nas listas que importam.
 *
 * ⚠️ O texto diz *"#9 entre os 30 melhores"* e nunca *"#9 de 30"*: o `total` do
 * core é o tamanho da lista PUBLICADA (o ETL corta em 30 e 60), não a população.
 * "de 30" leria como se o jogo tivesse trinta espécies.
 */
export function BlocoUsos({ especie, dados }: { especie: Especie; dados: Base }) {
  const { t } = useT();
  const { cores } = useTema();
  /*
   * ⚠️ As três ligas são NOMEADAS aqui, e não passadas como o `Record<string>`
   * que o dataset traz. O `usos` do core exige as três chaves porque é ele quem
   * garante que nenhuma liga suma em silêncio de uma versão do dataset para a
   * outra — um `Record<string>` compila com zero ligas dentro.
   */
  const lista = useMemo(() => {
    const r = dados.rankings;
    if (!r) return [];
    return usos(especie.id, {
      raidOverall: r.raidOverall,
      statProductByLeague: {
        great: r.statProductByLeague.great ?? [],
        ultra: r.statProductByLeague.ultra ?? [],
        master: r.statProductByLeague.master ?? [],
      },
    });
  }, [especie.id, dados.rankings]);

  /* Sem rankings o bloco NÃO aparece — dataset de terceiro pode não trazer. É
     diferente de trazer e a espécie não entrar em nenhum, que é o `usos.none`. */
  if (!dados.rankings) return null;

  return (
    <>
      <Titulo chave="usos.title" />
      <View className="bg-superficie rounded-cartao px-4 py-3">
        {lista.length === 0 ? (
          <Text className="text-texto2 text-corpo py-1">{t("usos.none")}</Text>
        ) : (
          lista.map((u, i) => (
            <View
              key={u.onde}
              className="flex-row items-center justify-between py-2.5"
              style={i > 0 ? { borderTopWidth: 1, borderTopColor: cores.linha } : undefined}
            >
              <View className="flex-1">
                <Text className="text-texto text-corpo">{t(ONDE[u.onde] ?? "usos.raide")}</Text>
                <Text className="text-texto3 text-legenda mt-0.5">
                  {t("usos.pos", { n: u.posicao, total: u.total })}
                </Text>
              </View>
              <Text className="text-texto2 text-legenda">{t(NIVEL[u.nivel] ?? "usos.serve")}</Text>
            </View>
          ))
        )}
      </View>
    </>
  );
}

/**
 * TROCA — o que uma troca faria com esses IV.
 *
 * ⚠️ Só existe para quem TEM o bicho: a conta é sobre os IV atuais dele. Sem
 * espécie guardada não há "antes" para comparar, e a tela ficaria mostrando a
 * chance de melhorar um IV que ninguém tem.
 */
export function BlocoTroca({
  ivs,
  baseStats,
  lucky,
  shadow,
  tm,
}: {
  ivs: IVs;
  baseStats: BaseStats;
  lucky: boolean;
  shadow: boolean;
  tm: (m: Message) => string;
}) {
  const { t } = useT();
  const { cores } = useTema();
  const troca = useMemo(
    () => avaliarTroca({ ivs, baseStats, lucky, shadow }),
    [ivs, baseStats, lucky, shadow],
  );

  const linhas = [
    { rotulo: t("trade.friend"), c: troca.amigo },
    { rotulo: t("trade.bestFriend"), c: troca.melhorAmigo },
    { rotulo: t("trade.lucky"), c: troca.sortudo, sortudo: true },
  ];

  return (
    <>
      <Titulo chave="trade.title" />
      <View className="bg-superficie rounded-cartao px-4 py-3">
        <Text className="text-texto2 text-corpo">{tm(troca.motivo)}</Text>

        {/* As três chances só aparecem quando a troca VALE. Mostrar a tabela
            junto de "não vale trocar" é o app se contradizendo na mesma tela. */}
        {troca.vale &&
          linhas.map((l, i) => (
            <View
              key={l.rotulo}
              className="flex-row items-center justify-between py-2.5"
              style={{ borderTopWidth: 1, borderTopColor: cores.linha, marginTop: i === 0 ? 10 : 0 }}
            >
              <Text className="text-texto text-corpo">{l.rotulo}</Text>
              <Text className="text-texto2 text-legenda flex-1 text-right ml-3" numberOfLines={2}>
                {l.sortudo
                  ? t("trade.luckyOdds", { media: Math.round(l.c.media) })
                  : t("trade.odds", { media: Math.round(l.c.media) })}
              </Text>
            </View>
          ))}
      </View>
    </>
  );
}

/**
 * OS MELHORES IV POR LIGA.
 *
 * ⚠️ Esta é a tela que desmente a porcentagem do jogo, e é por isso que ela
 * existe: com teto de PC, ataque alto infla o PC e obriga um nível menor, então
 * o topo quase nunca é 15/15/15. Sem essa tabela o app repetiria o número que o
 * jogo mostra em vez de explicar por que ele engana.
 *
 * ⚠️ Espécie que não alcança teto nenhum NÃO ganha seletor: ali toda liga dá a
 * mesma resposta (100% ganha), e um seletor de três abas idênticas é mobília.
 */
export function BlocoSpreads({
  especie,
  dados,
  tetoDeNivel,
}: {
  especie: Especie;
  dados: Base;
  tetoDeNivel: number;
}) {
  const { t } = useT();
  const { cores } = useTema();
  const [liga, setLiga] = useState<League>(GREAT_LEAGUE);

  /* Quais ligas a espécie ALCANÇA. `MASTER_LEAGUE` não tem teto, então ela
     entra sempre; as outras duas só quando o PC máximo passa do limite. */
  const ligas = useMemo(() => {
    const pcMaximo = topSpreads(dados.cpm, especie.baseStats, MASTER_LEAGUE, 1, {
      levelCap: tetoDeNivel,
    })[0]?.cp;
    if (pcMaximo === undefined) return [];
    return LIGAS.filter((l) => l.cpCap == null || pcMaximo > l.cpCap || l.id === "master");
  }, [dados.cpm, especie.baseStats, tetoDeNivel]);

  const ativa = ligas.includes(liga) ? liga : (ligas[0] ?? MASTER_LEAGUE);

  const spreads = useMemo(
    () => topSpreads(dados.cpm, especie.baseStats, ativa, 10, { levelCap: tetoDeNivel }),
    [dados.cpm, especie.baseStats, ativa, tetoDeNivel],
  );

  if (spreads.length === 0) return null;
  const soUma = ligas.length <= 1;

  return (
    <>
      <Titulo chave={soUma ? "spread.titleSimple" : "spread.title"} />

      {!soUma && (
        <View className="mb-3">
          <Segmented
            rotuloAcessivel={t("spread.title")}
            valor={ativa.id}
            opcoes={ligas.map((l) => ({
              valor: l.id,
              rotulo: l.id === "master" ? t("spread.noLimit") : l.name.replace(" League", ""),
            }))}
            onEscolher={(id) => {
              const escolhida = ligas.find((l) => l.id === id);
              if (escolhida) setLiga(escolhida);
            }}
          />
        </View>
      )}

      <View className="bg-superficie rounded-cartao px-4 py-2">
        <View className="flex-row py-2">
          <Text className="text-texto3 text-legenda w-8">{t("spread.rank")}</Text>
          <Text className="text-texto3 text-legenda flex-1">{t("spread.ivs")}</Text>
          <Text className="text-texto3 text-legenda w-14 text-right">{t("spread.level")}</Text>
          <Text className="text-texto3 text-legenda w-14 text-right">{t("spread.cp")}</Text>
        </View>
        {spreads.map((s, i) => (
          <View
            key={`${s.ivs.atk}-${s.ivs.def}-${s.ivs.hp}`}
            className="flex-row py-2"
            style={{ borderTopWidth: 1, borderTopColor: cores.linha }}
          >
            <Text
              className="w-8 text-legenda"
              style={{ color: i === 0 ? cores.texto : cores.texto3 }}
            >
              {s.rank}
            </Text>
            {/* Monoespaçada: coluna de número só alinha em largura fixa, e é
                comparando as três linhas de cima que se decide o que procurar. */}
            <Text
              className="flex-1 text-corpo"
              style={{
                fontFamily: "Menlo",
                color: i === 0 ? cores.texto : cores.texto2,
                fontWeight: i === 0 ? "700" : "400",
              }}
            >
              {s.ivs.atk}/{s.ivs.def}/{s.ivs.hp}
            </Text>
            <Text
              className="w-14 text-right text-corpo"
              style={{ fontFamily: "Menlo", color: cores.texto2 }}
            >
              {s.level}
            </Text>
            <Text
              className="w-14 text-right text-corpo"
              style={{ fontFamily: "Menlo", color: cores.texto2 }}
            >
              {s.cp}
            </Text>
          </View>
        ))}
      </View>

      <Text className="text-texto3 text-legenda mt-2 leading-4">
        {ativa.cpCap == null
          ? t("spread.noCap")
          : t("spread.capped", { cap: ativa.cpCap.toLocaleString() })}
      </Text>
    </>
  );
}
