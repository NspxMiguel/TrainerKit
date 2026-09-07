import { scanAppraisalBars, type IVs, type ScanFailure } from "@trainerkit/core";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { bitmapDoArquivo } from "../../src/print";
import { useTema } from "../../src/tema";
import { Selo } from "../../src/Selo";
import { Titulo } from "../../src/Titulo";

/**
 * O LEITOR DE PRINT — a função que dá nome ao app no site.
 *
 * Ele lê as TRÊS BARRAS da tela de avaliação do jogo e devolve o IV. Toda a
 * conta é a do `packages/core` (`scanAppraisalBars`), a mesma que o app web
 * usa; o que é nativo aqui é só conseguir os pixels — ver `src/print.ts`.
 *
 * ── Por que a galeria e não a câmera ────────────────────────────────────────
 *
 * Ninguém fotografa a própria tela: tira print. Pedir câmera seria pedir uma
 * permissão mais invasiva para um fluxo que ninguém usa. `expo-image-picker`
 * com a galeria pede só acesso a fotos, e o iOS ainda deixa escolher UMA foto
 * sem dar a biblioteca inteira.
 *
 * ── O que ele NÃO faz, e é de propósito ─────────────────────────────────────
 *
 * ⚠️ Ele não adivinha a espécie. As barras dizem o IV; o nome está escrito em
 * texto na mesma tela, e ler texto é OCR — outro problema, com outra taxa de
 * erro. Aqui a pessoa escolhe a espécie depois, com o IV já preenchido, e o
 * app nunca afirma o que não mediu.
 */
const MOTIVO: Record<ScanFailure, string> = {
  "sem-barras": "scan.fail.noBars",
  "barras-insuficientes": "scan.fail.notEnough",
  "barra-curta-demais": "scan.fail.tooShort",
  "larguras-divergentes": "scan.fail.mismatch",
};

export default function Print() {
  const { t } = useT();
  const { cores } = useTema();
  const { dados } = useDados();
  const router = useRouter();

  const [lendo, setLendo] = useState(false);
  const [ivs, setIvs] = useState<IVs | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const escolher = async () => {
    setFalha(null);
    setIvs(null);
    const escolha = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (escolha.canceled || !escolha.assets[0]) return;

    setLendo(true);
    try {
      const bmp = await bitmapDoArquivo(escolha.assets[0].uri);
      const r = scanAppraisalBars(bmp);
      if (r.ok) setIvs(r.ivs);
      else setFalha(t(MOTIVO[r.reason] as never));
    } catch {
      /* Decodificar pode falhar num formato que o manipulator não converta bem.
         Dizer "não consegui ler" é honesto; travar não é. */
      setFalha(t("scan.failed"));
    } finally {
      setLendo(false);
    }
  };

  const total = ivs ? ivs.atk + ivs.def + ivs.hp : 0;
  const candidatas =
    ivs && busca.trim()
      ? (dados?.canonicas ?? [])
          .filter((s) => s.name.toLowerCase().includes(busca.trim().toLowerCase()))
          .slice(0, 8)
      : [];

  return (
    <ScrollView
      className="flex-1 bg-fundo"
      contentContainerStyle={{ padding: 20 }}
      /* Sem isto o titulo grande do header nao reserva espaco e o
         conteudo nasce por baixo dele. */
      contentInsetAdjustmentBehavior="automatic"
    >
      <Titulo>{t("home.quickScan")}</Titulo>
      <Text className="text-texto text-[28px] font-extrabold">{t("scan.prompt")}</Text>
      <Text className="text-texto2 text-[15px] leading-6 mt-2">{t("scan.promptDetail")}</Text>

      <Pressable
        onPress={() => void escolher()}
        disabled={lendo}
        className="rounded-full py-4 items-center mt-6"
        style={{ backgroundColor: cores.texto, opacity: lendo ? 0.6 : 1 }}
      >
        {lendo ? (
          <ActivityIndicator color={cores.fundo} />
        ) : (
          <Text className="text-[17px] font-bold" style={{ color: cores.fundo }}>
            {t("scan.pick")}
          </Text>
        )}
      </Pressable>

      {lendo && <Text className="text-texto3 text-[13px] mt-3">{t("scan.reading")}</Text>}

      {falha && (
        <View className="bg-superficie rounded-3xl p-5 mt-4">
          <Text className="text-texto text-[15px] font-semibold">{t("scan.failed")}</Text>
          <Text className="text-texto2 text-[13px] leading-5 mt-2">{falha}</Text>
        </View>
      )}

      {ivs && (
        <>
          {/*
            ⚠️ SEM cabecalho, e nao por economia: a chave natural (`iv.title`)
            e "IV do meu {name}", e NESTE ponto o app ainda nao sabe a especie —
            as barras nao dizem quem e o bicho. Chamar a chave sem o nome
            imprimia "IV DO MEU {NAME}" na tela.

            O cartao se explica sozinho: o numero grande e a linha que nomeia os
            tres atributos, que e a mesma frase que o app web usa.
          */}
          <View className="bg-superficie rounded-3xl p-5 mt-4">
            <Text className="text-texto text-[34px] font-extrabold">
              {total}
              <Text className="text-texto3 text-[20px]"> / 45</Text>
            </Text>
            <Text className="text-texto2 text-sm mt-1">
              {t("scan.readValues", { atk: ivs.atk, def: ivs.def, hp: ivs.hp })}
            </Text>
          </View>

          {/*
            ⚠️ A ESPÉCIE É ESCOLHIDA À MÃO, e isto não é um passo faltando.
            As barras não dizem quem é o bicho — o nome está em texto na mesma
            tela, e lê-lo é OCR, outro problema com outra taxa de erro. Melhor
            perguntar do que afirmar o que não foi medido.
          */}
          <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
            {t("especies.title").toUpperCase()}
          </Text>
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder={t("especies.searchPlaceholder")}
            placeholderTextColor={cores.texto3}
            autoCorrect={false}
            className="bg-superficie text-texto rounded-2xl px-4 py-3 text-base"
          />

          {candidatas.map((s) => (
            <Pressable
              key={s.id}
              onPress={() =>
                /* O IV lido vai junto: a tela do IV entende `atk/def/hp` e
                   pré-seleciona a faixa de estrelas e os atributos destacados
                   a partir deles — que é exatamente o que as barras diziam.
                   Falta só o PC e o PS, que dão o NÍVEL, e esses as barras não
                   dizem. */
                router.push({
                  pathname: "/iv/[id]",
                  params: {
                    id: s.id,
                    atk: String(ivs.atk),
                    def: String(ivs.def),
                    hp: String(ivs.hp),
                  },
                })
              }
              className="flex-row items-center gap-3 bg-superficie rounded-2xl p-3 mt-2"
            >
              <Selo especie={s} tamanho={40} />
              <Text className="flex-1 text-texto text-[15px] font-semibold">{s.name}</Text>
              <Text className="text-texto3 text-base">›</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}
