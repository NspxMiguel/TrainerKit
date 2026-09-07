import * as Application from "expo-constants";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { useT } from "../../src/i18n";
import { useImagens } from "../../src/imagens";
import { useFonteDeDados } from "../../src/fonteDados";
import { useIA } from "../../src/ia";
import { useTema } from "../../src/tema";

/**
 * PRIVACIDADE E AVISO DE MARCA — e nao e tela decorativa.
 *
 * Duas coisas obrigam esta tela a existir dentro do app, e nao só no site:
 *
 * · **as lojas** exigem política de privacidade alcançável de dentro. Já quebrou
 *   aqui uma vez, com os endereços respondendo 404;
 * · **o aviso de marca.** O app lê dado do jogo e mostra nome de espécie, e o
 *   `LICENSE` do repositório já diz que nada disso é nosso. Dizer isso só no
 *   README não alcança quem instala.
 *
 * E ela ficou mais necessária no dia em que o app passou a mostrar uma chave
 * Pix: pedir dinheiro sem declarar o que se coleta é a combinação que dá
 * problema.
 *
 * ── POR QUE O TEXTO NÃO É O MESMO DO APP WEB ────────────────────────────────
 *
 * ⚠️ Copiar `PrivacyScreen.tsx` daria uma política FALSA. A do web declara
 * Groq, ElevenLabs, as imagens do GitHub e a hospedagem da Vercel — e o app
 * nativo não tem IA, não tem voz, não tem fonte de imagem e não é hospedado:
 * o dataset vem dentro do binário.
 *
 * Declarar coleta que não acontece é tão errado quanto esconder a que acontece:
 * as duas fazem a política deixar de descrever o produto. Por isso as cinco
 * frases específicas do nativo (`privacy.native.*`) existem separadas.
 *
 * O que o app nativo faz de rede, medido e não suposto — `grep` por `fetch` em
 * `app/` e `src/` devolve UM host: `raw.githubusercontent.com`, de onde vêm as
 * listas de evento e de ovo do ScrapedDuck. Mais nada.
 */
const ATUALIZADA = "2026-09-07";

/** Contato do controlador (LGPD art. 41). Trocar aqui troca nos dez idiomas. */
const CONTATO = "miguel@nspx.dev";

/**
 * RELATAR PROBLEMA — `mailto:`, e não formulário.
 *
 * Formulário exigiria um servidor que recebesse e guardasse o que a pessoa
 * escreve, e a política logo acima diz que não existe servidor nenhum. Um
 * `mailto:` abre o app de e-mail dela: ela vê o que está mandando, e nada passa
 * por aqui no meio.
 *
 * ⚠️ O corpo já vem com aparelho, versão e idioma. É o que decide metade dos
 * defeitos deste app — o leitor de print muda de comportamento por aparelho — e
 * pedir isso num segundo e-mail é como um relato morre.
 */
function abrirEmail(assunto: string, versao: string, idioma: string): void {
  const corpo = [
    "",
    "",
    "---",
    `TrainerKit ${versao}`,
    `${idioma}`,
    `${Platform.OS} ${Platform.Version}`,
  ].join("\n");
  const url =
    `mailto:${CONTATO}?subject=${encodeURIComponent(assunto)}` +
    `&body=${encodeURIComponent(corpo)}`;
  /* Um aparelho sem app de e-mail configurado recusa; falhar calado é melhor
     que derrubar a tela de privacidade por causa de um botão secundário. */
  Linking.openURL(url).catch(() => {});
}

export default function Legal() {
  const { t, idioma } = useT();
  const { cores } = useTema();
  const { fonte } = useImagens();
  const { url: urlDados } = useFonteDeDados();
  const { chave } = useIA();

  const bloco = (titulo: string, corpo: string[]) => (
    <View key={titulo} className="bg-superficie rounded-3xl p-5 mb-3">
      <Text className="text-texto3 text-[11px] tracking-widest">{titulo.toUpperCase()}</Text>
      {corpo.map((p) => (
        <Text key={p} className="text-texto2 text-[13px] leading-5 mt-3">
          {p}
        </Text>
      ))}
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerStyle={{ padding: 20 }}>
      <Text className="text-texto3 text-[12px] mb-3">
        {t("privacy.updated", { date: ATUALIZADA })}
      </Text>

      {bloco(t("privacy.summary.title"), [t("privacy.summary.body")])}
      {bloco(t("privacy.local.title"), [t("privacy.native.local")])}
      {/*
        ⚠️ A LINHA DAS IMAGENS É CONDICIONAL, e tem que ser.
        Com a fonte desligada — o padrão — o app fala com UM host. Declarar o
        segundo assim mesmo faria a política descrever tráfego que não existe; e
        omiti-lo com a fonte ligada faria o contrário, que é pior. A política
        descreve o app configurado como ele está.
      */}
      {/*
        ⚠️ AS TRÊS CONDICIONAIS SEGUEM A MESMA REGRA DE CIMA.
        A Groq só recebe pedido com chave configurada; a FOTO só sai com a
        identificação por imagem, e ela é o único arquivo do aparelho que sai
        daqui — declarar isso não é formalidade, é a diferença entre a política
        ser verdadeira e ser propaganda. E uma fonte própria acrescenta um host
        que EU não escolhi e não posso nomear.
      */}
      {bloco(t("privacy.third.title"), [
        t("privacy.native.network"),
        ...(fonte === "off" ? [] : [t("privacy.native.images")]),
        ...(fonte === "custom" || urlDados ? [t("privacy.native.ownSource")] : []),
        ...(chave ? [t("privacy.third.groq"), t("privacy.third.photo")] : []),
        t("privacy.third.none"),
      ])}
      {bloco(t("privacy.transfer.title"), [t("privacy.native.transfer")])}
      {bloco(t("privacy.rights.title"), [t("privacy.native.rights")])}
      {bloco(t("privacy.minors.title"), [t("privacy.native.minors")])}
      {bloco(t("privacy.controller.title"), [t("privacy.controller.body", { contact: CONTATO })])}

      {/*
        O AVISO DE MARCA fecha a tela, e é a parte que não é sobre privacidade.
        Fica sem cartão de propósito: é a nota de rodapé do app inteiro, não
        mais uma seção da política.
      */}
      <Text
        className="text-texto3 text-[12px] leading-5 mt-4 px-1"
        style={{ borderTopWidth: 0.5, borderTopColor: cores.linha, paddingTop: 16 }}
      >
        {t("settings.disclaimer")}
      </Text>
      <Text className="text-texto3 text-[12px] leading-5 mt-3 px-1">{t("about.solo")}</Text>

      <Pressable
        onPress={() =>
          abrirEmail(
            t("feedback.subject"),
            String(Application.default.expoConfig?.version ?? ""),
            idioma,
          )
        }
        className="rounded-full py-3.5 items-center mt-5"
        style={{ borderWidth: 1, borderColor: cores.linha }}
      >
        <Text className="text-texto text-[15px] font-semibold">{t("feedback.title")}</Text>
      </Pressable>
    </ScrollView>
  );
}
