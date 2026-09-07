import * as Clipboard from "expo-clipboard";
import { Link } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  LANGUAGES,
  MAX_POWERUP_LEVEL,
  BITCOIN_ADDRESS,
  TRAINER_LEVELS,
  checarUrl,
  partirUrl,
  tetoDePowerUp,
  validarDataset,
  validarManifesto,
  type Key,
  type SpriteManifest,
} from "@trainerkit/core";
import { SymbolView } from "expo-symbols";

import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { apagarTudo } from "../../src/apagar";
import { emMegabytes, medirArmazenamento, useOffline } from "../../src/offline";
import { useTraducao } from "../../src/traducao";
import { useVozLigada } from "../../src/vozLigada";
import { FONTES, SPRITE_SOURCE_KEYS, useImagens } from "../../src/imagens";
import { useFonteDeDados } from "../../src/fonteDados";
import { useIA } from "../../src/ia";
import { useSetup } from "../../src/setup";
import { useTema, type Escolha } from "../../src/tema";

/**
 * Ajustes.
 *
 * Hoje: tema, idioma e os atalhos que nao cabiam no topo da Especies.
 *
 * O tema comeca em "sistema" — iPhone em claro nao significa que ele quer o app
 * claro, mas e o palpite menos errado quando ninguem escolheu ainda. As tres
 * opcoes ficam salvas; ver `src/tema.tsx`.
 */
/* A mesma legenda das quatro faixas que o setup usa. */
const FAIXA: Record<number, Key> = {
  20: "onb.level.start",
  30: "onb.level.mid",
  40: "onb.level.high",
  /* "OU MAIS" desceu do 50 pro 80: com as faixas novas ele passou a ser o
     ULTIMO da lista, e "50 ou mais" ao lado de um 60 e um 80 e mentira. */
  80: "onb.level.max",
};

/**
 * Em que aparelhos isto foi realmente testado.
 *
 * ⚠️ A lista é curta e fica curta. "Testado em iOS" quando foi um aparelho é
 * promessa que o app não pode cumprir; nomear o aparelho é o que dá para
 * afirmar.
 *
 * ⚠️ O Poco X3 Pro saiu: ele é do teste do PWA, e este é um app de iPhone.
 * Citar um Android aqui promete uma plataforma que este binário não roda.
 */
const APARELHOS_TESTADOS = ["iPhone 17 Pro"];

const TEMAS: { valor: Escolha; chave: Key }[] = [
  { valor: "sistema", chave: "settings.theme.system" },
  { valor: "claro", chave: "settings.theme.light" },
  { valor: "escuro", chave: "settings.theme.dark" },
];


/**
 * UMA LINHA DE AJUSTES — ícone, nome e o VALOR DE AGORA.
 *
 * ⚠️ É o print 9. A tela era uma parede de opções abertas: os três temas, os
 * dez idiomas e as três fontes de imagem sempre à mostra, o que fazia rolar
 * três telas para chegar em "Apagar tudo". Aqui cada assunto é uma linha que
 * diz o estado atual e abre só quando a pessoa quer mudar.
 *
 * ⚠️ O VALOR À DIREITA não é enfeite: é o que responde "em que idioma está?"
 * sem abrir nada, que é a pergunta que traz alguém aos Ajustes na maioria das
 * vezes.
 */
function Linha({
  icone,
  cor,
  titulo,
  valor,
  aberta,
  onAlternar,
  children,
}: {
  icone: string;
  cor: string;
  titulo: string;
  valor?: string;
  aberta: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  const { cores } = useTema();
  return (
    <View className="bg-superficie rounded-cartao overflow-hidden mt-3">
      <Pressable onPress={onAlternar} className="flex-row items-center gap-3 px-4 py-3.5">
        <View
          className="items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: cor }}
        >
          <SymbolView name={icone as never} size={14} tintColor="#FFFFFF" fallback={<View />} />
        </View>
        <Text className="text-texto text-corpo flex-1">{titulo}</Text>
        {valor ? (
          <Text className="text-texto3 text-legenda" numberOfLines={1}>
            {valor}
          </Text>
        ) : null}
        <Text className="text-texto3 text-base ml-1">{aberta ? "⌄" : "›"}</Text>
      </Pressable>
      {aberta && (
        <View className="px-4 pb-4" style={{ borderTopWidth: 1, borderTopColor: cores.linha }}>
          {children}
        </View>
      )}
    </View>
  );
}

/**
 * BUSCA UM JSON E DIZ O QUE DEU ERRADO — em chave, não em frase.
 *
 * ⚠️ Devolve `string` quando falhou e o objeto quando deu certo. Parece torto e
 * é de propósito: o chamador precisa distinguir "não chegou" de "chegou e não
 * serve", e as duas coisas viram a MESMA linha vermelha na tela.
 */
/** Só o host, para caber na linha fechada dos Ajustes. */
function dominioDe(url: string): string {
  return partirUrl(url)?.host ?? url;
}

async function buscarJson(url: string): Promise<unknown> {
  try {
    const r = await fetch(url);
    if (!r.ok) return "source.err.network";
    return (await r.json()) as unknown;
  } catch {
    return "source.err.network";
  }
}

/**
 * O CAMPO DE ENDEREÇO de uma fonte própria.
 *
 * `aoConfirmar` devolve a CHAVE do erro, ou `null` quando aceitou — assim toda
 * a validação (endereço, rede, formato) mora em um lugar só e a tela cuida
 * apenas de mostrar. Enquanto confere, o botão vira texto: um endereço lento
 * sem retorno visual parece botão quebrado.
 */
function CampoDeFonte({
  marca,
  inicial,
  aoConfirmar,
  aoLimpar,
}: {
  marca: string;
  inicial: string;
  aoConfirmar: (url: string) => Promise<string | null>;
  aoLimpar?: () => void;
}) {
  const { t } = useT();
  const { cores } = useTema();
  const [texto, setTexto] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);

  return (
    <View className="mt-3">
      <TextInput
        value={texto}
        onChangeText={(v) => {
          setTexto(v);
          setErro(null);
        }}
        placeholder={marca}
        placeholderTextColor={cores.texto3}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        className="bg-fundo rounded-2xl px-3 py-2.5 text-[13px]"
        style={{ color: cores.texto, borderWidth: 0.5, borderColor: cores.linha }}
      />
      <View className="flex-row items-center gap-3 mt-2">
        <Pressable
          disabled={conferindo || texto.trim() === ""}
          onPress={() => {
            setConferindo(true);
            setErro(null);
            void aoConfirmar(texto.trim())
              .then(setErro)
              .finally(() => setConferindo(false));
          }}
          hitSlop={8}
        >
          <Text
            className="text-[13px] font-semibold"
            style={{ color: texto.trim() === "" ? cores.texto3 : cores.evoluir }}
          >
            {t(conferindo ? "source.checking" : "source.check")}
          </Text>
        </Pressable>
        {aoLimpar && (
          <Pressable
            onPress={() => {
              setTexto("");
              setErro(null);
              aoLimpar();
            }}
            hitSlop={8}
          >
            <Text className="text-texto3 text-[13px]">{t("source.clear")}</Text>
          </Pressable>
        )}
      </View>
      {erro && (
        <Text className="text-[12px] leading-4 mt-1.5" style={{ color: cores.guardar }}>
          {t(erro as Key)}
        </Text>
      )}
    </View>
  );
}

export default function Ajustes() {
  const { t, idioma, trocar } = useT();
  const { cores, escolha, definir } = useTema();
  const { setup, definir: definirSetup } = useSetup();
  const { fonte, definir: definirFonte, manifesto, manifestoUrl, definirManifesto } =
    useImagens();
  const { chave, definir: definirChave } = useIA();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  /* ⚠️ UMA seção aberta por vez. Com várias abertas a tela volta a ser a parede
     de opções que isto veio resolver. */
  const [secao, setSecao] = useState<string | null>(null);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const { dados } = useDados();
  const { url: urlDados, definir: definirUrlDados } = useFonteDeDados();
  /* ⚠️ A fonte própria não entra no download offline: um manifesto pode
     apontar cada espécie para um host diferente. Ela chega aqui como "off",
     que é o estado honesto — não há o que baixar em lote. */
  const off = useOffline(fonte === "custom" ? "off" : fonte);
  const { mostrar: traduzir, alternar: alternarTraducao } = useTraducao();
  const { ligada: vozLigada, alternar: alternarVoz } = useVozLigada();
  /* ⚠️ Medido a cada abertura da tela, e não guardado: o número muda
     quando se baixa ou apaga imagem, e um valor em cache mentiria
     exatamente no momento em que a pessoa foi conferir. */
  const [espaco, setEspaco] = useState({ base: 0, imagens: 0, total: 0 });
  /*
   * ⚠️ ASSÍNCRONO, e não um `useMemo`. Em desenvolvimento o asset do dataset
   * ainda não tem caminho local — ele chega pelo Metro — e medir sem esperar o
   * `downloadAsync` devolvia 0 MB para uma base de 2 MB. Zero não é "ainda não
   * sei", é um número errado com cara de certo.
   */
  useEffect(() => {
    void medirArmazenamento().then(setEspaco);
  }, [off.estado.guardadas]);

  const alto = useSafeAreaInsets().top;

  return (
    <ScrollView
      className="flex-1 bg-fundo"
      /* +110 embaixo: a barra de abas FLUTUA sobre o conteudo, entao sem folga
         a ultima linha de Ajustes fica atras do vidro e nao da pra tocar. */
      contentContainerStyle={{ padding: 20, paddingTop: alto + 12, paddingBottom: 32 }}
    >
      <Text className="text-titulo-tela text-texto mb-1">{t("settings.title")}</Text>

      <Linha
        icone="circle.lefthalf.filled"
        cor="#3B82F6"
        titulo={t("settings.appearance")}
        valor={t(TEMAS.find((x) => x.valor === escolha)?.chave ?? "settings.theme.system")}
        aberta={secao === "tema"}
        onAlternar={() => setSecao((v) => (v === "tema" ? null : "tema"))}
      >
      <View className="bg-superficie rounded-3xl overflow-hidden mb-7">
        {TEMAS.map((op, i) => (
          <Pressable
            key={op.valor}
            onPress={() => definir(op.valor)}
            className="flex-row items-center px-4 py-3.5"
            style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
          >
            <Text
              className={`flex-1 text-[15px] ${op.valor === escolha ? "text-texto font-bold" : "text-texto2"}`}
            >
              {t(op.chave)}
            </Text>
            {op.valor === escolha && <Text className="text-texto text-base">✓</Text>}
          </Pressable>
        ))}
      </View>

      </Linha>

      <Linha
        icone="globe"
        cor="#8B5CF6"
        titulo={t("settings.language")}
        valor={LANGUAGES.find((l) => l.code === idioma)?.label ?? idioma}
        aberta={secao === "idioma"}
        onAlternar={() => setSecao((v) => (v === "idioma" ? null : "idioma"))}
      >
      <View className="bg-superficie rounded-3xl overflow-hidden">
        {LANGUAGES.map((l, i) => (
          <Pressable
            key={l.code}
            onPress={() => trocar(l.code)}
            className="flex-row items-center px-4 py-3.5"
            style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
          >
            <Text className="text-[17px] mr-3">{l.flag}</Text>
            <Text
              className={`flex-1 text-[15px] ${l.code === idioma ? "text-texto font-bold" : "text-texto2"}`}
            >
              {l.label}
            </Text>
            {l.code === idioma && <Text className="text-texto text-base">✓</Text>}
          </Pressable>
        ))}
      </View>

      {/*
        O NÍVEL DO TREINADOR mora aqui também, e não só no setup.

        Ele é o único ajuste do app que muda VEREDITO — quem sobe de nível no
        jogo e não tem onde corrigir isso continua recebendo resposta calculada
        com o teto antigo, sem nenhum jeito de descobrir por quê. Um setup que
        roda uma vez não pode ser o único lugar de um valor que muda com o
        tempo.
      */}
      {/*
        A IA — a chave é DELA, e só existem duas opções.

        "app a pessoa coloca a ia dela, key dela, nada free, free so o site". A
        opção "grátis com limite" do PWA sai do bolso dele e por isso não está
        aqui. Sem chave = desligado; com chave = ligado. Não há terceiro estado,
        então não há seletor: o campo é o interruptor.
      */}
      </Linha>

      <Linha
        icone="sparkles"
        cor="#EC4899"
        titulo={t("ai.title")}
        valor={t(chave ? "ai.provider.groq" : "ai.off")}
        aberta={secao === "ia"}
        onAlternar={() => setSecao((v) => (v === "ia" ? null : "ia"))}
      >
      <View className="bg-superficie rounded-3xl px-4 py-4">
        <Text className="text-texto2 text-[13px] leading-5">
          {t(chave ? "onb.ai.groq" : "onb.ai.off")}
        </Text>
        <TextInput
          value={rascunho ?? chave ?? ""}
          onChangeText={setRascunho}
          onEndEditing={() => {
            definirChave(rascunho);
            setRascunho(null);
          }}
          placeholder="gsk_…"
          placeholderTextColor={cores.texto3}
          autoCapitalize="none"
          autoCorrect={false}
          /* `secureTextEntry` não: quem digita uma chave de 56 caracteres num
             teclado de celular precisa ver o que digitou. Ela não é senha de
             ninguém — é um token que a própria pessoa revoga num clique. */
          className="text-texto text-[13px] mt-3 font-mono"
          style={{ borderTopWidth: 0.5, borderTopColor: cores.linha, paddingTop: 12 }}
        />
        <Text className="text-texto3 text-[12px] leading-4 mt-2">{t("onb.ai.groqDetail")}</Text>
      </View>

      {/*
        IMAGENS — desligado por padrão, e a tela de Privacidade depende disso.
        Ligar acrescenta um segundo host que recebe pedido do app, e é por isso
        que a política declara esse host condicionado a esta escolha.
      */}
      </Linha>

      <Linha
        icone="photo"
        cor="#10B981"
        titulo={t("sprites.title")}
        valor={
          fonte === "custom"
            ? (manifesto?.name ?? t("source.img.custom"))
            : t((SPRITE_SOURCE_KEYS[fonte]?.title ?? "sprites.none") as Key)
        }
        aberta={secao === "imagens"}
        onAlternar={() => setSecao((v) => (v === "imagens" ? null : "imagens"))}
      >
      <View className="bg-superficie rounded-3xl overflow-hidden">
        {FONTES.map((f, i) => (
          <Pressable
            key={f}
            onPress={() => definirFonte(f)}
            className="px-4 py-3.5"
            style={i > 0 ? { borderTopWidth: 0.5, borderTopColor: cores.linha } : undefined}
          >
            <View className="flex-row items-center">
              <Text
                className={`flex-1 text-[15px] ${f === fonte ? "text-texto font-bold" : "text-texto2"}`}
              >
                {t(SPRITE_SOURCE_KEYS[f].title as Key)}
              </Text>
              {f === fonte && <Text className="text-texto text-base">✓</Text>}
            </View>
            <Text className="text-texto3 text-[12px] leading-4 mt-1">
              {t(SPRITE_SOURCE_KEYS[f].detail as Key)}
            </Text>
          </Pressable>
        ))}
        {/* A QUARTA: o manifesto de quem usa. Ela não entra em `FONTES` porque
            não é uma escolha seca — precisa de um endereço para existir. */}
        <View
          className="px-4 py-3.5"
          style={{ borderTopWidth: 0.5, borderTopColor: cores.linha }}
        >
          <View className="flex-row items-center">
            <Text
              className={`flex-1 text-[15px] ${fonte === "custom" ? "text-texto font-bold" : "text-texto2"}`}
            >
              {manifesto?.name ?? t("source.img.custom")}
            </Text>
            {fonte === "custom" && <Text className="text-texto text-base">✓</Text>}
          </View>
          <Text className="text-texto3 text-[12px] leading-4 mt-1">
            {t("source.img.customDetail")}
          </Text>
          <CampoDeFonte
            marca={t("source.img.hint")}
            inicial={manifestoUrl ?? ""}
            aoConfirmar={async (url) => {
              const erro = checarUrl(url, false);
              if (erro) return erro;
              const bruto = await buscarJson(url);
              if (typeof bruto === "string") return bruto;
              const ruim = validarManifesto(bruto);
              if (ruim) return ruim;
              definirManifesto(url, bruto as SpriteManifest);
              return null;
            }}
          />
        </View>
      </View>

      </Linha>

      {/*
        A BASE DO JOGO — logo abaixo das imagens porque é a mesma ideia: o app
        aponta, não hospeda. Vem depois delas por ser a mais rara de trocar.
      */}
      <Linha
        icone="cylinder.split.1x2"
        cor="#6366F1"
        titulo={t("source.data.title")}
        valor={urlDados ? t("source.ok", { name: dominioDe(urlDados) }) : t("source.data.builtin")}
        aberta={secao === "base"}
        onAlternar={() => setSecao((v) => (v === "base" ? null : "base"))}
      >
        <View className="bg-superficie rounded-3xl px-4 py-3.5">
          <Text className="text-texto3 text-[12px] leading-4">{t("source.data.body")}</Text>
          <CampoDeFonte
            marca={t("source.data.hint")}
            inicial={urlDados ?? ""}
            aoLimpar={() => definirUrlDados(null)}
            aoConfirmar={async (url) => {
              const erro = checarUrl(url, false);
              if (erro) return erro;
              const bruto = await buscarJson(url);
              if (typeof bruto === "string") return bruto;
              const ruim = validarDataset(bruto);
              if (ruim) return ruim;
              definirUrlDados(url);
              return null;
            }}
          />
        </View>
      </Linha>

      <Linha
        icone="figure.walk"
        cor="#F59E0B"
        titulo={t("onb.level.title")}
        valor={String(setup.level)}
        aberta={secao === "nivel"}
        onAlternar={() => setSecao((v) => (v === "nivel" ? null : "nivel"))}
      >
      <View className="flex-row flex-wrap gap-2">
        {TRAINER_LEVELS.map((n) => (
          <Pressable
            key={n}
            onPress={() => definirSetup({ level: n })}
            className="items-center rounded-cartao-sm py-3"
            /* Sete faixas nao cabem numa linha: 22% de base faz quatro por
               linha e o `flexGrow` fecha a sobra da segunda. */
            style={{
              flexBasis: "22%",
              flexGrow: 1,
              backgroundColor: cores.superficie,
              borderWidth: 1,
              borderColor: n === setup.level ? cores.texto : "transparent",
            }}
          >
            <Text
              className={`text-[19px] font-extrabold ${n === setup.level ? "text-texto" : "text-texto2"}`}
            >
              {n}
            </Text>
            <Text className="text-texto3 text-[10px] tracking-widest mt-0.5">
              {FAIXA[n] ? t(FAIXA[n]!).toUpperCase() : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="text-texto3 text-[12px] leading-5 mt-2">
        {t("onb.level.what", {
          nivel: setup.level,
          teto: tetoDePowerUp(setup.level, MAX_POWERUP_LEVEL),
        })}
      </Text>

      </Linha>

      <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
        {t("faxina.title").toUpperCase()}
      </Text>
      <Link href="/ginasio" asChild>
        <Pressable className="bg-superficie rounded-3xl px-4 py-4 mb-2">
          <Text className="text-texto text-[15px]">{t("gym.title")}</Text>
        </Pressable>
      </Link>
      <Link href="/time" asChild>
        <Pressable className="bg-superficie rounded-3xl px-4 py-4 mb-2">
          <Text className="text-texto text-[15px]">{t("team.open")}</Text>
        </Pressable>
      </Link>
      <Link href="/faxina" asChild>
        <Pressable className="bg-superficie rounded-3xl px-4 py-4">
          <Text className="text-texto text-[15px]">{t("faxina.open")}</Text>
        </Pressable>
      </Link>

      {/*
        APOIAR fica aqui também, e não só no setup.

        O setup roda uma vez, na abertura, antes de o app ter provado que serve
        pra alguma coisa. Quem decide que valeu decide no terceiro mês — e nessa
        hora precisa de um lugar pra achar a chave.
      */}
      <Text className="text-texto3 text-[11px] tracking-widest mt-7 mb-2">
        {t("support.title").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-3xl px-4 py-4">
        <Text className="text-texto2 text-[13px] leading-5 mb-3">{t("support.body")}</Text>
        <Text className="text-texto3 text-[11px] tracking-widest mb-1.5">
          {t("support.address").toUpperCase()}
        </Text>
        <Text selectable className="text-texto text-[13px] leading-5 font-mono">
          {BITCOIN_ADDRESS}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          Clipboard.setStringAsync(BITCOIN_ADDRESS)
            .then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            })
            .catch(() => {});
        }}
        className="rounded-full py-3.5 items-center mt-3"
        style={{ borderWidth: 1, borderColor: cores.linha }}
      >
        <Text className="text-texto text-[15px] font-semibold">
          {copiado ? t("support.copied") : t("support.copy")}
        </Text>
      </Pressable>
      <Text className="text-texto3 text-[12px] leading-5 mt-3">{t("support.note")}</Text>

      {/* ── O DADO DO JOGO ─────────────────────────────────────────────────
          De quando é o arquivo que o app está usando. Dataset velho é a
          explicação mais comum para um número que não bate com o jogo, e sem
          esta linha não havia como a pessoa desconfiar disso. */}
      {/* ⚠️ Só aparece FORA do inglês: em inglês não há segunda linha para
          mostrar, e um interruptor que não muda nada é mobília. */}
      {idioma !== "en" && (
        <>
          <Text className="text-texto3 text-legenda mt-7 mb-2">
            {t("settings.showTranslation").toUpperCase()}
          </Text>
          <Pressable
            onPress={alternarTraducao}
            className="bg-superficie rounded-cartao px-4 py-4 flex-row items-center"
          >
            <View className="flex-1">
              <Text className="text-texto text-corpo">{t("settings.showTranslation")}</Text>
              <Text className="text-texto3 text-legenda mt-1 leading-4">
                {t("settings.showTranslationDetail")}
              </Text>
            </View>
            <Text className="text-texto text-base ml-3">{traduzir ? "✓" : ""}</Text>
          </Pressable>
        </>
      )}

      {/* ── QUANTO ISTO OCUPA ──────────────────────────────────────────────
          ⚠️ Medido no disco, não estimado. O app promete funcionar sem rede, e
          essa promessa custa espaço — dizer quanto é parte de fazê-la honesta.
          A base não some porque vem no pacote; as imagens, sim, e o botão de
          apagar está logo abaixo. */}
      <Text className="text-texto3 text-legenda mt-7 mb-2">
        {t("settings.storage").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-cartao px-4 py-4">
        <View className="flex-row items-center">
          <Text className="text-texto2 text-corpo flex-1">{t("settings.gameData")}</Text>
          <Text className="text-texto3 text-legenda">{emMegabytes(espaco.base, idioma)}</Text>
        </View>
        <View className="flex-row items-center mt-2">
          <Text className="text-texto2 text-corpo flex-1">{t("sprites.title")}</Text>
          <Text className="text-texto3 text-legenda">
            {off.estado.guardadas} · {emMegabytes(espaco.imagens, idioma)}
          </Text>
        </View>
        <View
          className="flex-row items-center mt-3 pt-3"
          style={{ borderTopWidth: 0.5, borderTopColor: cores.linha }}
        >
          <Text className="text-texto text-corpo font-semibold flex-1">
            {t("settings.spaceUsed")}
          </Text>
          <Text className="text-texto text-corpo font-semibold">
            {emMegabytes(espaco.total, idioma)}
          </Text>
        </View>
      </View>

      {/* ── A VOZ DO MODO LENTE ────────────────────────────────────────────
          ⚠️ O interruptor existia SÓ dentro do modo lente, e quem desligou lá
          não tem por que lembrar onde religar. Preferência de acessibilidade
          mora nos Ajustes; o botão de lá continua existindo, porque é durante o
          uso que se quer calar. */}
      <Text className="text-texto3 text-legenda mt-7 mb-2">
        {t("voice.title").toUpperCase()}
      </Text>
      <Pressable
        onPress={alternarVoz}
        className="bg-superficie rounded-cartao px-4 py-4 flex-row items-center"
      >
        <View className="flex-1">
          <Text className="text-texto text-corpo">{t("voice.enabled")}</Text>
          <Text className="text-texto3 text-legenda mt-1 leading-4">{t("voice.lensDetail")}</Text>
        </View>
        <Text className="text-texto text-base ml-3">{vozLigada ? "✓" : ""}</Text>
      </Pressable>

      {/* ── AS IMAGENS NO APARELHO ─────────────────────────────────────────
          ⚠️ Só aparece com uma fonte LIGADA: sem imagem escolhida não há o que
          baixar, e um botão de download que não baixa nada é promessa falsa. */}
      {fonte !== "off" && (
        <>
          <Text className="text-texto3 text-legenda mt-7 mb-2">
            {t("prefetch.title").toUpperCase()}
          </Text>
          <View className="bg-superficie rounded-cartao px-4 py-4">
            <Text className="text-texto2 text-corpo leading-5">
              {off.estado.baixando
                ? `${off.estado.feitas} / ${off.estado.total}`
                : t("prefetch.stored", { count: off.estado.guardadas })}
            </Text>
            {off.estado.baixando && (
              <View
                className="rounded-pilula mt-3 overflow-hidden"
                style={{ height: 5, backgroundColor: cores.linha }}
              >
                <View
                  className="rounded-pilula"
                  style={{
                    height: 5,
                    width: `${Math.round((off.estado.feitas / Math.max(1, off.estado.total)) * 100)}%`,
                    backgroundColor: cores.investir,
                  }}
                />
              </View>
            )}
            <Text className="text-texto3 text-legenda mt-2 leading-4">
              {t("prefetch.warning")}
            </Text>
          </View>
          <View className="flex-row gap-2 mt-3">
            <Pressable
              onPress={() => {
                if (off.estado.baixando) return;
                void off.baixar((dados?.canonicas ?? []).map((e) => e.spriteId));
              }}
              className="rounded-pilula py-3.5 items-center flex-1"
              style={{ borderWidth: 1, borderColor: cores.linha }}
            >
              <Text className="text-texto text-corpo font-semibold">
                {off.estado.baixando
                  ? t("prefetch.background")
                  : t("prefetch.start", { count: (dados?.canonicas ?? []).length })}
              </Text>
            </Pressable>
            {off.estado.guardadas > 0 && !off.estado.baixando && (
              <Pressable
                onPress={off.apagar}
                className="rounded-pilula py-3.5 items-center flex-1"
                style={{ borderWidth: 1, borderColor: cores.linha }}
              >
                <Text className="text-texto2 text-corpo font-semibold">
                  {t("prefetch.clear")}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      <Text className="text-texto3 text-legenda mt-7 mb-2">
        {t("settings.gameData").toUpperCase()}
      </Text>
      <View className="bg-superficie rounded-cartao px-4 py-4">
        <Text className="text-texto text-corpo">
          {dados?.version.generatedAt
            ? t("settings.buildOf", {
                date: new Date(dados.version.generatedAt).toLocaleDateString(idioma),
              })
            : t("common.unknown")}
        </Text>
        {dados?.version.generatedAt && (
          <Text className="text-texto3 text-legenda mt-1">
            {t("settings.dataAge", {
              n: Math.max(
                0,
                Math.floor(
                  (Date.now() - Date.parse(dados.version.generatedAt)) / 86_400_000,
                ),
              ),
            })}
          </Text>
        )}
      </View>

      {/* ── SOBRE ──────────────────────────────────────────────────────────
          Quem fez, e em que aparelhos isto foi testado de verdade. A lista é
          curta de propósito: dizer "testado em iOS" quando foram dois aparelhos
          é promessa que o app não pode cumprir. */}
      <Text className="text-texto3 text-legenda mt-7 mb-2">{t("about.title").toUpperCase()}</Text>
      <View className="bg-superficie rounded-cartao px-4 py-4">
        <Text className="text-texto2 text-corpo leading-5">{t("about.solo")}</Text>
        <Text className="text-texto3 text-legenda mt-3 leading-4">
          {t("about.devices", { aparelhos: APARELHOS_TESTADOS.join(" · ") })}
        </Text>
      </View>

      {/* ── APAGAR TUDO ────────────────────────────────────────────────────
          ⚠️ NÃO EXISTE SERVIDOR: o que sumir aqui sumiu. Por isso são dois
          toques e um aviso do que exatamente vai embora — e por isso a coleção
          se exporta na tela dela antes. */}
      <Text className="text-texto3 text-legenda mt-7 mb-2">{t("wipe.title").toUpperCase()}</Text>
      <View className="bg-superficie rounded-cartao px-4 py-4">
        <Text className="text-texto2 text-corpo leading-5">{t("wipe.noServer")}</Text>
        {(["wipe.item.collection", "wipe.item.settings", "wipe.item.cache"] as const).map((k) => (
          <Text key={k} className="text-texto3 text-legenda mt-2 leading-4">
            • {t(k)}
          </Text>
        ))}
      </View>
      <Pressable
        onPress={() => {
          if (!confirmandoApagar) {
            setConfirmandoApagar(true);
            return;
          }
          void apagarTudo().then(() => setConfirmandoApagar(false));
        }}
        className="rounded-pilula py-3.5 items-center mt-3"
        style={{ borderWidth: 1, borderColor: confirmandoApagar ? cores.transferir : cores.linha }}
      >
        <Text
          className="text-corpo font-semibold"
          style={{ color: confirmandoApagar ? cores.transferir : cores.texto2 }}
        >
          {t(confirmandoApagar ? "wipe.confirm" : "wipe.action")}
        </Text>
      </Pressable>

      {/* ⚠️ FEEDBACK NO NÍVEL DE CIMA, e não enterrado no fim da tela de
          privacidade. "adiciona botao de sla, feedback e etc" — quem quer avisar
          que algo quebrou não vai procurar isso dentro do texto legal. */}
      <Pressable
        onPress={() => {
          const corpo = [
            "",
            "---",
            `${Platform.OS} ${Platform.Version}`,
            `${t("settings.language")}: ${idioma}`,
          ].join("\n");
          void Linking.openURL(
            `mailto:miguel@nspx.dev?subject=${encodeURIComponent("TrainerKit")}&body=${encodeURIComponent(corpo)}`,
          );
        }}
        className="bg-superficie rounded-cartao px-4 py-4 mt-3 flex-row items-center"
      >
        <Text className="text-texto text-corpo flex-1">{t("feedback.title")}</Text>
        <Text className="text-texto3 text-base">›</Text>
      </Pressable>

      {/* Privacidade e aviso de marca. As lojas exigem que seja alcançável de
          DENTRO do app, e o aviso de marca precisa chegar a quem instala — o
          README não alcança essa pessoa. */}
      <Link href="/legal" asChild>
        <Pressable className="bg-superficie rounded-3xl px-4 py-4 mt-7">
          <Text className="text-texto text-[15px]">{t("privacy.title")}</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}
