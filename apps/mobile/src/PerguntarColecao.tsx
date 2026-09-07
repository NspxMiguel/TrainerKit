import { GROQ_MODEL, groqChat, type Key } from "@trainerkit/core";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useT } from "./i18n";
import { useIA } from "./ia";
import { useTema } from "./tema";
import type { Guardado } from "./colecao";
import type { Especie } from "./dados";

/** As três que a tela oferece — as mesmas perguntas do app web. */
const SUGESTOES: Key[] = ["ask.s1", "ask.s2", "ask.s3"];

/**
 * PERGUNTAR SOBRE A COLEÇÃO INTEIRA.
 *
 * A ficha já deixava perguntar sobre UMA espécie. O que faltava é a pergunta
 * que só faz sentido com a coleção na mesa — "qual dos meus", "o que eu posso
 * transferir", "em qual eu invisto primeiro" — e essa não cabe numa ficha,
 * porque a resposta compara um bicho com os outros.
 *
 * ⚠️ OS FATOS SÃO MONTADOS AQUI, e o modelo é proibido de lembrar. Um modelo
 * pequeno inventa stat base com a mesma voz com que acerta, e a diferença entre
 * as duas é invisível para quem pergunta. O que ele recebe é a lista real: IV,
 * nível e tipo de cada um.
 *
 * ⚠️ E ela só existe COM CHAVE. Um botão que abrisse "configure a IA" seria
 * propaganda ocupando o lugar de quem não pediu — a mesma regra da ficha.
 */
export function PerguntarColecao({ itens, especies }: { itens: Guardado[]; especies: Especie[] }) {
  const { t, idioma } = useT();
  const { cores } = useTema();
  const { chave } = useIA();
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const [resposta, setResposta] = useState<string | null>(null);

  if (!chave || itens.length === 0) return null;

  const enviar = (texto: string) => {
    if (texto.trim() === "") return;
    setPensando(true);
    setResposta(null);
    /*
     * ⚠️ TETO DE 60. A coleção pode ter centenas, e mandar todas estoura o
     * contexto do modelo — a resposta volta truncada, ou não volta. Sessenta
     * cabem e já respondem "qual dos meus", que é a pergunta.
     */
    const linhas = itens.slice(0, 60).map((g) => {
      const sp = especies.find((e) => e.id === g.speciesId);
      const iv = g.ivDesconhecido ? "IV nao medido" : `IV ${g.ivs.atk}/${g.ivs.def}/${g.ivs.hp}`;
      return `${sp?.name ?? g.speciesId} (${sp?.types.join("/") ?? "?"}) nivel ${g.level}, ${iv}${g.shadow ? ", sombroso" : ""}${g.lucky ? ", sortudo" : ""}`;
    });
    const cortados = itens.length - linhas.length;

    groqChat(
      chave,
      GROQ_MODEL,
      [
        {
          role: "system",
          content:
            `Voce responde sobre Pokemon GO em ${idioma}, em no maximo 4 frases curtas. ` +
            `Use SOMENTE a colecao abaixo; se a resposta nao estiver nela, diga que nao sabe. ` +
            `Nao invente numero nem bicho que nao esteja na lista.\n\n` +
            `Colecao (${itens.length} no total${cortados > 0 ? `, mostrando ${linhas.length}` : ""}):\n` +
            linhas.join("\n"),
        },
        { role: "user", content: texto.trim() },
      ],
      { maxTokens: 260 },
    )
      .then(setResposta)
      /* A mensagem da Groq (401, 429, modelo fora do catalogo) diz o que fazer;
         um "deu erro" nosso nao diz. */
      .catch((e: Error) => setResposta(e.message))
      .finally(() => setPensando(false));
  };

  return (
    <View className="bg-superficie rounded-cartao px-4 py-3.5 mt-3">
      <Pressable
        onPress={() => setAberto((v) => !v)}
        className="flex-row items-center justify-between"
      >
        <Text className="text-texto text-corpo font-semibold">{t("ask.title")}</Text>
        <Text className="text-texto3 text-legenda">{aberto ? "✕" : "＋"}</Text>
      </Pressable>

      {aberto && (
        <>
          <TextInput
            value={pergunta}
            onChangeText={setPergunta}
            onSubmitEditing={() => enviar(pergunta)}
            returnKeyType="send"
            placeholder={t("ask.placeholder")}
            placeholderTextColor={cores.texto3}
            className="bg-fundo rounded-2xl px-3 py-2.5 text-[14px] mt-3"
            style={{ color: cores.texto, borderWidth: 0.5, borderColor: cores.linha }}
          />
          {/* AS TRÊS SUGERIDAS. Elas não são enfeite: quem abre a caixa não sabe
              o que dá para perguntar, e uma caixa em branco é a resposta errada
              para essa dúvida. */}
          <View className="flex-row flex-wrap gap-2 mt-2.5">
            {SUGESTOES.map((chaveSugestao) => (
              <Pressable
                key={chaveSugestao}
                onPress={() => {
                  const texto = t(chaveSugestao);
                  setPergunta(texto);
                  enviar(texto);
                }}
                className="rounded-pilula px-3 py-1.5"
                style={{ borderWidth: 0.5, borderColor: cores.linha }}
              >
                <Text className="text-texto2 text-[12px]">{t(chaveSugestao)}</Text>
              </Pressable>
            ))}
          </View>
          {pensando && <Text className="text-texto3 text-legenda mt-3">{t("ask.thinking")}</Text>}
          {resposta && !pensando && (
            <Text className="text-texto2 text-corpo leading-6 mt-3">{resposta}</Text>
          )}
        </>
      )}
    </View>
  );
}
