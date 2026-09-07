import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  fazGigantamax,
  planejarFaxina,
  tetoDePowerUp,
  type BichoFaxina,
  type EspecieFaxina,
} from "@trainerkit/core";
import { remover, restaurar, useColecao, type Guardado } from "../../src/colecao";
import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useSetup } from "../../src/setup";
import { useTema } from "../../src/tema";
import { Selo } from "../../src/Selo";

/**
 * A faxina.
 *
 * ⚠️ O APP NAO TRANSFERE NADA, e isso nao e letra miuda: ele nao fala com o
 * jogo e nao tem como falar. O que acontece aqui e a LISTA — quem transfere e
 * a pessoa, no jogo. Por isso o texto nunca diz "transferir por voce".
 *
 * A metade que parece dispensavel e a dos guardados COM O MOTIVO: uma faxina
 * que nao deixa auditar o que ficou de fora e uma faxina que se usa uma vez.
 */
export default function Faxina() {
  const { t, tm } = useT();
  const { cores } = useTema();
  const { setup } = useSetup();
  const { itens, recarregar } = useColecao();
  const { dados } = useDados();

  const plano = useMemo(() => {
    if (!dados || !itens || itens.length === 0) return null;
    const especies = new Map<string, EspecieFaxina>();
    for (const g of itens) {
      if (especies.has(g.speciesId)) continue;
      const sp = dados.species.find((s) => s.id === g.speciesId);
      if (!sp) continue;
      especies.set(sp.id, {
        id: sp.id,
        baseStats: sp.baseStats,
        evolvesInto: [],
        candyToEvolve: null,
        legendary: sp.legendary ?? false,
        gigantamax: fazGigantamax(sp.id, (dados as never as { dynamax?: never }).dynamax),
      });
    }
    const bichos: BichoFaxina[] = itens.map((g) => ({
      id: g.id,
      speciesId: g.speciesId,
      ivs: g.ivs,
      level: g.level,
      lucky: g.lucky,
      shadow: g.shadow,
      /* PASSA ADIANTE, e nao `false` cravado: um bicho guardado por "Tenho esse"
         nao tem IV medido, e a faxina julgando ele como 0/0/0 manda transferir
         justamente o que ninguem avaliou ainda. */
      ivDesconhecido: g.ivDesconhecido ?? false,
    }));
    return planejarFaxina({
      bichos,
      especies,
      cpm: dados.cpm,
      /*
       * O teto de QUEM ESTA JOGANDO, e nao o do jogo.
       *
       * `version.levelCap` e o teto de quem ja terminou. Para um treinador de
       * nivel 20 o app respondia sobre uma especie que aquela pessoa so
       * consegue levar ao nivel 22 — a mesma correcao que o web ja tinha, e que
       * so pode existir aqui depois de o setup nativo perguntar o nivel.
       */
      levelCap: tetoDePowerUp(setup.level, dados.version.levelCap),
    });
  }, [dados, itens]);

  const nome = (sid: string) => dados?.species.find((s) => s.id === sid);

  /*
   * O QUE ESTÁ MARCADO PARA SAIR.
   *
   * ⚠️ "Sem dúvida" já nasce marcado e "você decide" nasce desmarcado. É a
   * diferença entre as duas classes do core, e ignorá-la faria a tela pedir a
   * mesma atenção para o duplicado óbvio e para a decisão de verdade.
   */
  const marcados = useMemo(() => {
    const m = new Set<string>();
    for (const s of plano?.soltos ?? []) if (s.classe === "semDuvida") m.add(s.id);
    return m;
  }, [plano]);

  const [tirados, setTirados] = useState<Set<string>>(marcados);
  const [confirmando, setConfirmando] = useState(false);
  const [desfazivel, setDesfazivel] = useState<Guardado[] | null>(null);
  const [abrirGuardados, setAbrirGuardados] = useState(false);

  /* A seleção acompanha o plano: mudar de coleção troca a lista inteira. */
  useEffect(() => setTirados(marcados), [marcados]);

  if (!plano) {
    return (
      <View className="flex-1 bg-fundo items-center justify-center px-10">
        <Text className="text-texto3 text-sm text-center leading-6">{t("raid.emptyBody")}</Text>
      </View>
    );
  }

  const total = tirados.size;

  const alternar = (id: string) =>
    setTirados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const executar = async () => {
    /* Guarda o que sai ANTES de sair: é o que o desfazer restaura, e depois de
       `remover` a informação já não existe em lugar nenhum. */
    const saindo = (itens ?? []).filter((g) => tirados.has(g.id));
    for (const g of saindo) await remover(g.id);
    setDesfazivel(saindo);
    setConfirmando(false);
    recarregar();
  };

  const secao = (classe: "semDuvida" | "voceDecide") => {
    const lista = plano.soltos.filter((s) => s.classe === classe);
    if (lista.length === 0) return null;
    return (
      <>
        <Text className="text-texto3 text-legenda mt-6 mb-1">
          {t(classe === "semDuvida" ? "faxina.sure" : "faxina.maybe").toUpperCase()}
        </Text>
        <Text className="text-texto3 text-legenda mb-2 leading-4">
          {t(classe === "semDuvida" ? "faxina.sure.body" : "faxina.maybe.body", {
            count: lista.length,
          })}
        </Text>
        <View className="bg-superficie rounded-cartao overflow-hidden">
          {lista.map((s, i) => {
            const sp = nome(s.speciesId);
            const marcado = tirados.has(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() => alternar(s.id)}
                className="flex-row items-center gap-3 px-4 py-3"
                style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
              >
                {/* A caixa é desenhada, e não um `Switch`: são dezenas de linhas,
                    e um interruptor por linha vira uma parede de controles. */}
                <View
                  className="rounded-chip items-center justify-center"
                  style={{
                    width: 22,
                    height: 22,
                    borderWidth: 1.5,
                    borderColor: marcado ? cores.transferir : cores.linha,
                    backgroundColor: marcado ? cores.transferir : "transparent",
                  }}
                >
                  {marcado && (
                    <Text style={{ color: cores.fundo, fontSize: 13, lineHeight: 16 }}>✓</Text>
                  )}
                </View>
                {sp && <Selo especie={sp} tamanho={36} />}
                <View className="flex-1">
                  <Text className="text-texto text-corpo font-semibold">
                    {sp?.name ?? s.speciesId}
                  </Text>
                  {/* ⚠️ `tm` e não `String(...)`. O motivo é uma `Message` do
                      core, e imprimi-la crua mostrava `[object Object]`. */}
                  <Text className="text-texto3 text-legenda" numberOfLines={2}>
                    {tm(s.motivo)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-fundo"
      contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
    >
      <Text className="text-texto2 text-corpo leading-6">{t("faxina.intro")}</Text>

      {plano.soltos.length === 0 ? (
        <View className="mt-10 items-center">
          <Text className="text-texto text-corpo font-semibold text-center">
            {t("faxina.empty.title")}
          </Text>
          <Text className="text-texto3 text-legenda text-center mt-2 leading-5">
            {t("faxina.empty.body")}
          </Text>
        </View>
      ) : (
        <>
          {secao("semDuvida")}
          {secao("voceDecide")}
        </>
      )}

      {/* ── O QUE FICA, e por quê ──────────────────────────────────────────
          ⚠️ Não é sobra: é metade do produto. Uma tela que só lista o que sai
          deixa a pessoa achando que o app não olhou para o resto. Fechado por
          padrão porque a pergunta do momento é o que sai. */}
      {plano.guardados.length > 0 && (
        <>
          <Pressable
            onPress={() => setAbrirGuardados((v) => !v)}
            className="flex-row items-center justify-between mt-7 py-2"
          >
            <Text className="text-texto3 text-legenda">
              {t(plano.guardados.length === 1 ? "faxina.kept.one" : "faxina.kept.many", {
                count: plano.guardados.length,
              }).toUpperCase()}
            </Text>
            <Text className="text-texto2 text-legenda">
              {t(abrirGuardados ? "verdict.hide" : "verdict.show")}
            </Text>
          </Pressable>
          {abrirGuardados && (
            <View className="bg-superficie rounded-cartao overflow-hidden">
              {plano.guardados.map((g, i) => {
                const sp = nome(g.speciesId);
                return (
                  <View
                    key={g.id}
                    className="flex-row items-center gap-3 px-4 py-3"
                    style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
                  >
                    {sp && <Selo especie={sp} tamanho={32} />}
                    <View className="flex-1">
                      <Text className="text-texto text-corpo">{sp?.name ?? g.speciesId}</Text>
                      <Text className="text-texto3 text-legenda" numberOfLines={2}>
                        {tm(g.motivo)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* ── DESFAZER ───────────────────────────────────────────────────────
          Fica na tela até a pessoa sair: não há servidor, e um aviso que some
          em dois segundos é a mesma coisa que não ter desfazer. */}
      {desfazivel && desfazivel.length > 0 && (
        <View className="bg-superficie rounded-cartao px-4 py-3 mt-6 flex-row items-center">
          <Text className="text-texto2 text-legenda flex-1">
            {t(desfazivel.length === 1 ? "faxina.removed.one" : "faxina.removed.many", {
              count: desfazivel.length,
            })}
          </Text>
          <Pressable
            onPress={() => {
              void restaurar(desfazivel).then(() => {
                setDesfazivel(null);
                recarregar();
              });
            }}
            hitSlop={8}
          >
            <Text className="text-texto text-legenda font-semibold">{t("faxina.undo")}</Text>
          </Pressable>
        </View>
      )}

      {/* ── CONFIRMAR ──────────────────────────────────────────────────────
          ⚠️ Dois passos, e o segundo diz o número. O app NÃO transfere no jogo
          (não existe API para isso) — ele tira da SUA coleção, e é isso que o
          texto de confirmação precisa deixar claro. */}
      {total > 0 && (
        <View className="mt-6">
          <Text className="text-texto3 text-legenda mb-2">
            {t(total === 1 ? "faxina.selected.one" : "faxina.selected.many", { count: total })}
          </Text>
          {confirmando && (
            <Text className="text-texto2 text-legenda mb-2 leading-4">{t("faxina.confirm.body")}</Text>
          )}
          <Pressable
            onPress={() => {
              if (!confirmando) {
                setConfirmando(true);
                return;
              }
              void executar();
            }}
            className="rounded-pilula py-3.5 items-center"
            style={{ borderWidth: 1, borderColor: confirmando ? cores.transferir : cores.linha }}
          >
            <Text
              className="text-corpo font-semibold"
              style={{ color: confirmando ? cores.transferir : cores.texto2 }}
            >
              {t(confirmando ? "faxina.confirm.action" : "faxina.action")}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
