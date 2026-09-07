import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ACTION_KEYS,
  degradeDoHeroi,
  misturar,
  tintaDoHeroi,
  veuDoHeroi,
  type Key,
} from "@trainerkit/core";
import { marcarFeito, useColecao } from "../../src/colecao";
import { usePendencias } from "../../src/pendencias";
import type { Action } from "@trainerkit/core";
import type { Guardado } from "../../src/colecao";
import { useDados, type Especie } from "../../src/dados";
import { useT } from "../../src/i18n";
import { useImagens } from "../../src/imagens";
import { arquivoLocal } from "../../src/offline";
import { corDoTipo, Selo, tintaSobre } from "../../src/Selo";
import { DicaDoDia } from "../../src/DicaDoDia";
import { useSetup } from "../../src/setup";
import { useTema } from "../../src/tema";
import { Toque } from "../../src/Toque";

/**
 * O INICIO.
 *
 * Ele nao existia: a saudacao e os atalhos moravam empilhados no topo da lista
 * de especies, junto da busca e da grade de 1.182 tiles. Dava uma tela que
 * fazia cinco coisas e nao respondia a pergunta que a pessoa abre o app pra
 * responder — "no que eu mexo hoje?".
 *
 * A ordem aqui e a do desenho: quem fala primeiro e o DESTAQUE (um bicho, com
 * a cor do tipo ocupando a tela), depois a acao que resolve em um passo
 * (escanear um print), depois os atalhos, e so entao a colecao.
 */
function saudacao(hora: number): Key {
  if (hora < 5) return "home.greeting.lateNight";
  if (hora < 12) return "home.greeting.morning";
  if (hora < 18) return "home.greeting.afternoon";
  return "home.greeting.night";
}

/**
 * A arte da espécie no herói, se houver.
 *
 * ⚠️ Componente à parte porque ele tem estado — a imagem pode falhar, e quando
 * falha o herói volta a ser só o número. Um `useState` dentro do `Heroi` faria
 * o herói inteiro renderizar de novo a cada carga.
 */
function ArteDoHeroi({ especie }: { especie: Especie }) {
  const { fonte, urlDaEspecie } = useImagens();
  const [falhou, setFalhou] = useState(false);
  const local = arquivoLocal(especie.spriteId, fonte);
  const url = falhou ? null : (local ?? urlDaEspecie(especie));
  if (!url) return null;
  return (
    <Image
      source={{ uri: url }}
      onError={() => setFalhou(true)}
      resizeMode="contain"
      style={{ width: "100%", height: 200 }}
    />
  );
}

function Heroi({
  especie,
  linha,
  acao,
  onFeito,
  quantos = 0,
  indice = 0,
  onTrocar,
  alto,
  cabecalho,
}: {
  especie: Especie;
  linha: string;
  /** A palavra do veredito, quando o herói é um bicho que pede decisão. */
  acao?: string;
  /** Marcar como resolvido sem abrir a ficha. */
  onFeito?: () => void;
  /** Quantos destaques existem — vira os pontinhos embaixo do herói. */
  quantos?: number;
  /** Qual deles está à mostra, para o pontinho aceso. */
  indice?: number;
  /** Passar para o próximo destaque. */
  onTrocar?: () => void;
  /** O inset do topo: o herói começa em y=0, ATRÁS da barra de status. */
  alto: number;
  /** A saudação e o avatar, desenhados por cima da cor. */
  cabecalho: ReactNode;
}) {
  const { t } = useT();
  const { cores, escuro } = useTema();
  const cor = corDoTipo(especie.types[0]);
  /*
   * ⚠️ A COR VEM DA ESPÉCIE, e não do TIPO — "as cores tao muito diferente".
   *
   * Medido lado a lado com o site no Charizard: pela cor do tipo as paradas
   * saíam `#512505 → #ce5800 → #ff8225` (luminância 0,031 / 0,201 / 0,374) e
   * pelo site `#603110 → #bd6628 → #d27f44` (0,047 / 0,205 / 0,293). A última
   * do nativo era 28% mais luminosa e saturada até o talo — laranja de néon ao
   * lado do outro.
   *
   * E pelo tipo TODA espécie de Fogo abria a tela com o mesmo laranja. Agora a
   * conta é uma só, no `packages/core`, e o Charmander tem o laranja dele.
   */
  const paradas = degradeDoHeroi(especie.spriteId, cor, escuro);
  const veu = veuDoHeroi(escuro);
  /*
   * ⚠️ A FAIXA DE COR TEM ALTURA PRÓPRIA, e não a do herói.
   *
   * Era isto a outra metade do "as cores tao muito diferente". As paradas já
   * batiam com as do site (medidas: as duas dão `#603110 → #bd6628 → #d27f44`
   * no Charizard), mas o site espalha essa rampa por 332 pontos e o nativo
   * espalhava pelos 529 do herói. Resultado, medido na mesma altura de TELA: a
   * 20% da tela o site pinta `#ce6418` e o nativo pintava `#9e5420` — a mesma
   * receita, um terço mais escura, porque estava esticada.
   *
   * Prendendo a cor a 332 pontos, o que sobra do herói já é o fundo da página
   * — exatamente como no site, onde o botão do herói também fica quase no
   * preto. As posições viram fração da altura real em vez de números soltos.
   */
  const ALTURA_DA_COR = 332;
  const f = (q: number) => (q * ALTURA_DA_COR) / (470 + alto);
  /* A tinta deixou de ser branca cravada: no tema claro as paradas são
     claras de verdade e branco sobre elas é ilegível. */
  const tintaHeroi = tintaDoHeroi(paradas, escuro);
  /* A pílula e o botão redondo acompanham a tinta: sobre fundo claro um
     véu preto de 35% vira uma mancha, e sobre escuro um branco vira. */
  const veuDaPilula = tintaHeroi === "#FFFFFF" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.45)";

  return (
    <Link href={{ pathname: "/especie/[id]", params: { id: especie.id } }} asChild>
      {/* ⚠️ SEM raio e SEM margem: no desenho o herói encosta nas duas bordas e
          na barra de status. Com cantos arredondados ele lê como "mais um
          cartão"; full-bleed ele É a tela. */}
      {/* ⚠️ 470 e não 430: "ta muito pequeno o charizard". Os 40 pontos a mais
          são o que a arte cresceu (150 → 200) sem espremer o nome. */}
      <Pressable className="overflow-hidden" style={{ height: 470 + alto }}>
        {/*
          O GRADIENTE E DO TIPO, e nao uma cor de marca. Foi assim que o violeta
          saiu do app sem a tela ficar cinza: a cor continua existindo, so que
          ela agora SIGNIFICA alguma coisa — Charizard e laranja porque e Fogo.
        */}
        {/*
          O DEGRADÊ QUE SOBE — escuro em cima, a cor no meio, claro embaixo, na
          vertical. Ele estava errado aqui: era diagonal e terminava em
          transparente, o que só apaga a cor. Ele reconheceu de longe.
        */}
        {/*
          ⚠️ QUATRO PARADAS, e a última é o FUNDO DO TEMA.

          É a receita do PWA, que ele apontou como a certa: a cor vive de 0 a
          72% e do 72 ao 100 ela morre dentro do próprio degradê. Antes eu punha
          uma segunda camada por cima para "derreter" o pé — e duas camadas
          interpolando em ritmos diferentes é o que produzia a borda que ele
          continuava vendo.
        */}
        <LinearGradient
          /*
            ⚠️ SEIS PARADAS, e as duas últimas são o fundo.

            "é para ser contínuo, parecer q o roxo vira branco até ficar igual o
            branco de baixo, algo q se conecta."

            Duas coisas faziam a listra que ele fotografou. A primeira: ir da
            cor direto ao fundo passa pelo CINZA — em sRGB o caminho entre um
            roxo saturado e o branco cruza um mauve dessaturado. `misturar` põe
            no meio uma parada que já é quase o fundo mas ainda tem a matiz da
            cor, então o trajeto inteiro continua sendo "a cor clareando".

            A segunda: a última parada caía exatamente na borda do herói, e a
            emenda com a página ficava a um pixel de distância da conversão.
            Chegando ao fundo em 92% e ficando nele até 100%, os últimos 8% já
            SÃO a página — não há emenda para ver.
          */
          colors={[...paradas, misturar(paradas[2], cores.fundo, 0.55), cores.fundo, cores.fundo]}
          /* ⚠️ AS TRÊS PRIMEIRAS presas aos 332 pontos do site — é isso que põe a
             faixa mais forte na altura do bicho. A CAUDA, não: ela desce
             devagar até o pé do herói, senão o nome e a ação caem num preto
             chapado e o herói vira uma tarja colorida com texto embaixo. No
             site a cor também alcança o nome e morre no botão. */
          locations={[f(0), f(0.48), f(0.72), 0.72, 0.88, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        {/*
          O NÚMERO DA DEX como marca d'água — não o monograma.

          ⚠️ É o que o PWA faz, e ele pediu por nome. O monograma repetia as
          duas primeiras letras de um nome que já está escrito em 34px logo
          abaixo; o número é a única coisa da espécie que não aparece em lugar
          nenhum da tela.

          Centrado em 46% da altura, e não colado no topo — "o ET tá pra cima
          dms". 12% de opacidade: abaixo disso ele some no degradê, acima vira
          um número que a pessoa tenta ler, e o assunto da tela é o bicho.
        */}
        <Text
          numberOfLines={1}
          /* ⚠️ `numberOfLines` NÃO é detalhe: sem ele "890" quebrava em "89" e
             "0" em linhas separadas, e o herói ficava com dois algarismos
             gigantes empilhados. Transbordar na horizontal é o certo — é assim
             que ele lê como textura. */
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "46%",
            marginTop: -100,
            textAlign: "center",
            /* ⚠️ O `letterSpacing` negativo do React Native também tira o
               espaço DEPOIS do último algarismo, e isso empurra o centro
               óptico para a esquerda. O `paddingLeft` devolve o que a última
               letra perdeu. */
            paddingLeft: 10,
            /* ⚠️ 200 e não 268: com três algarismos a 268 o número ocupa mais
               que a largura da tela e o corte come dois deles — sobra um "8"
               gigante que não é o número de nada. A 200 os três cabem, com só
               uma lasca de corte nas bordas, que é o que dá a textura. */
            fontSize: 200,
            lineHeight: 200,
            fontWeight: "900",
            letterSpacing: -10,
            color: tintaHeroi,
            opacity: 0.12,
          }}
        >
          {/* ⚠️ TRÊS ALGARISMOS, sempre — "n coloca numero 6, coloca 006, pq da
              pra encher melhor dai". Um "6" sozinho no meio de uma faixa de 200
              pontos não é textura, é um algarismo perdido; "006" ocupa a
              largura e é como o site escreve. */}
          {String(especie.dex).padStart(3, "0")}
        </Text>
        {/*
          O SCRIM VOLTOU, e agora ele é MEDIDO.

          ⚠️ Eu tinha tirado porque ele apagava o pé do degradê — e com isso
          quebrei a legibilidade: o texto do herói é branco cravado, e branco
          sobre a parada clara do Gelo dá **1,49:1**, contra os 4,5:1 que o
          projeto exige. Sobre Elétrico, 1,48:1.

          `0.45` é o menor alfa que passa nos dezoito tipos: medido nas duas
          paradas visíveis de cada um, o pior caso é Elétrico a 4,62:1.
          `contraste-heroi.test.ts` refaz essa conta e falha se alguém mexer na
          saturação, na luz ou neste número.

          ⚠️ Ele começa em 45% da altura, e não no topo: a parte de cima do
          herói não tem texto, e escurecê-la de novo devolveria a cor lavada que
          ele reclamou.
        */}
        {/*
          ⚠️ O SCRIM SOME ANTES DO PÉ, e é isso que tirava a listra cinza.

          Ele terminava em 45% de preto na borda de baixo. No tema claro, 45% de
          preto sobre um fundo quase branco DÁ CINZA — a faixa que ele
          fotografou não era o gradiente da cor, era o véu por cima dele.

          Agora ele existe só na faixa onde há texto (50% a 80% da altura) e
          desaparece antes de o gradiente encontrar a página. Os 4,5:1 continuam
          valendo: o nome e a frase ficam justamente nessa faixa.
        */}
        {/* ⚠️ O VÉU AGORA É O DO SITE, e a diferença é metade do "as cores tao
            muito diferente". O de antes escurecia de 42% a 78% com 45% de preto
            cravado — apagava justamente a faixa onde a cor é mais forte. O do
            site só age na metade de baixo (transparente até 50%), que é onde o
            texto mora, e INVERTE de cor com o tema: preto no escuro, quase
            branco no claro. Aplicar preto nos dois é o que fazia a listra
            cinza. A conta está no `packages/core`, e uma varredura das 1.100+
            espécies confere 4,5:1 nos dois temas. */}
        <LinearGradient
          colors={veu.cores}
          /* O véu acompanha o TEXTO, não a faixa de cor: ele nasce onde o nome
             começa e some antes do pé. */
          locations={[0, 0.45, 0.72, 0.9]}
          style={{ position: "absolute", inset: 0 }}
          pointerEvents="none"
        />

        {/* A SAUDAÇÃO POR CIMA DA COR.

            ⚠️ Ela estava ACIMA do herói, sobre preto, e o laranja começava numa
            linha reta logo abaixo dela. Ele pediu que a cor subisse até o topo —
            e é o que a referência mostra: a cor preenche a tela inteira, a
            saudação flutua nela, e a barra de status fica em cima da cor. */}
        <View style={{ paddingTop: alto + 8 }}>{cabecalho}</View>

        {/* ⚠️ O CONTEÚDO PARA ANTES DO FIM, e a folga não é estética: é o
            espaço em que a cor se dissolve. Colado no pé, o texto ficava sobre
            a parte já opaca do degradê e a faixa terminava numa linha. */}
        {/*
          A FOTO DA ESPÉCIE.

          ⚠️ "kd foto? do charizard" — a tira da coleção já mostrava a arte e o
          herói não. Ele fica sobre o número, no terço de cima, porque é ali que
          o desenho põe o bicho: o nome e a ação ficam embaixo dele.

          ⚠️ Só aparece com uma fonte de imagem LIGADA. Sem ela o app é
          distribuído sem arte nenhuma, e o número continua sendo a textura.
        */}
        {/* ⚠️ 40 e não 110 — "dava pra abaixar o nome e etc". O respiro de 110
            empurrava o bloco inteiro para o meio da faixa; com 40 ele desce, e
            o espaço em que a cor se dissolve continua existindo porque as três
            últimas paradas do degradê já são o fundo da página. */}
        <View className="flex-1 justify-end items-center px-5" style={{ paddingBottom: 40 }}>
          {/* ⚠️ A ARTE ENTRA NA COLUNA, e não flutuando por cima dela. Ela era
              `position: "absolute"` num topo cravado, e o resultado dependia da
              altura do texto embaixo: com o nome e a frase de duas linhas a
              cauda do Charizard cortava o rótulo e o próprio nome. Na coluna,
              o `justify-end` empilha arte, rótulo, nome e ação de baixo pra
              cima e a sobreposição deixa de ser possível. */}
          <View pointerEvents="none" className="w-full">
            <ArteDoHeroi especie={especie} />
          </View>

          <View className="rounded-pilula px-3 py-1 mb-2" style={{ backgroundColor: veuDaPilula }}>
            <Text className="text-legenda" style={{ color: tintaHeroi }}>
              {t("home.today").toUpperCase()}
            </Text>
          </View>
          <Text className="text-saudacao text-center" style={{ color: tintaHeroi }}>
            {especie.name}
          </Text>
          {/* Tipos MAIS o porquê. O desenho põe uma frase aqui — "Fogo · Voador ·
              IV 93 — vale cada grama de poeira hoje" — e só os tipos deixavam o
              herói dizendo o que a pessoa já vê na cor. */}
          <Text
            className="text-corpo mt-1 text-center"
            style={{ color: tintaHeroi, opacity: 0.85 }}
            numberOfLines={2}
          >
            {especie.types.map((x) => t(`type.${x}` as Key)).join(" · ")}
            {linha ? ` — ${linha}` : ""}
          </Text>

          {/*
            A AÇÃO, dentro do herói.

            ⚠️ Ela existe porque o herói é uma PERGUNTA — "no que eu mexo hoje?"
            — e uma pergunta sem resposta ao lado é decoração. O botão redondo
            fecha a pendência sem abrir a ficha: quem já evoluiu não quer
            navegar duas telas para dizer isso.
          */}
          {acao && (
            <View className="flex-row items-center gap-2 mt-4">
              <View className="rounded-pilula px-6 py-3" style={{ backgroundColor: tintaHeroi }}>
                <Text
                  className="text-corpo font-bold"
                  style={{ color: tintaHeroi === "#FFFFFF" ? "#111" : "#FFFFFF" }}
                >
                  {acao}
                </Text>
              </View>
              {onFeito && (
                <Pressable
                  onPress={(e) => {
                    /* Sem isto o toque sobe para o `Link` do herói e a ficha
                       abre por cima da ação que a pessoa acabou de concluir. */
                    e.stopPropagation();
                    onFeito();
                  }}
                  hitSlop={10}
                  accessibilityLabel={t("collection.markDone")}
                  className="rounded-pilula"
                  style={{
                    width: 40,
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: veuDaPilula,
                  }}
                >
                  <SymbolView
                    name="checkmark"
                    size={16}
                    tintColor={tintaHeroi}
                    fallback={<Text style={{ color: tintaHeroi }}>✓</Text>}
                  />
                </Pressable>
              )}
            </View>
          )}

          {/* OS PONTINHOS. Eles dizem quantos ainda esperam decisão — no desenho
              são o que promete que há mais de um assunto. Um só não desenha
              nada: um ponto sozinho não é um carrossel. */}
          {/* Os pontinhos são TOCÁVEIS: é como se passa para o próximo destaque
              sem gesto escondido. O aceso é o que está à mostra. */}
          {quantos > 1 && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onTrocar?.();
              }}
              hitSlop={12}
              accessibilityLabel={t("dex.next")}
              className="flex-row gap-1.5 mt-4 self-center"
            >
              {Array.from({ length: Math.min(quantos, 5) }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === indice % 5 ? 14 : 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: i === indice % 5 ? tintaHeroi : veuDaPilula,
                  }}
                />
              ))}
            </Pressable>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

/** Qual cor do tema pinta cada veredito — a mesma tabela da ficha. */
const COR_DA_ACAO: Record<string, "investir" | "evoluir" | "guardar" | "transferir"> = {
  investir: "investir",
  evoluir: "evoluir",
  guardar: "guardar",
  transferir: "transferir",
  descobrir: "investir",
};

/**
 * OS ATALHOS — e são DOIS.
 *
 * ⚠️ Eram sete, e sete pílulas pequenas viravam uma parede que competia com a
 * ação principal. O desenho põe só estes dois, e os outros cinco continuam
 * alcançáveis: Modo Pokédex e Itens pela aba Pokédex, agenda e chocadeira pela
 * agenda, contas pelo avatar da saudação.
 */
const ATALHOS: { rota: string; rotulo: Key; icone: string }[] = [
  { rota: "/time", rotulo: "team.title", icone: "person.3.fill" },
  { rota: "/ginasio", rotulo: "gym.title", icone: "shield.fill" },
];

export default function Inicio() {
  const { t, tm } = useT();
  const { cores, escuro } = useTema();
  const { pronto, dados } = useDados();
  const { itens, recarregar } = useColecao();
  const router = useRouter();
  const { top: alto, bottom: baixo } = useSafeAreaInsets();
  const [agora] = useState(() => new Date().getHours());
  const { setup } = useSetup();

  const fila = usePendencias(dados);

  /*
   * O DESTAQUE, em ordem de utilidade — e isto é o que o PWA faz.
   *
   * 1. O que PEDE DECISÃO. Se existe um bicho esperando uma escolha, ele é o
   *    assunto do dia: o app existe pra responder "no que eu mexo hoje?".
   * 2. Sem fila, o melhor atacante de raide — o único "hoje" que o app afirma
   *    sem inventar evento.
   *
   * O nativo só fazia o passo 2, então quem tinha a coleção inteira pedindo
   * decisão abria o app e via um bicho que nem é dele.
   */

  /*
   * ⚠️ OS DESTAQUES RODAM. "n é só charizard q fica ai, os pokemons mudam
   * sabia?" — e ele está certo: o herói mostrava sempre o primeiro da fila ou o
   * primeiro do ranking, então abrir o app dez vezes dava dez vezes o mesmo
   * bicho.
   *
   * Roda pela FILA quando há fila (é ela que a pessoa precisa resolver), e pelo
   * topo do ranking de raide quando não há. O índice vem do dia mais o toque
   * nos pontinhos: reabrir o app não vira roleta, mas tocar troca.
   */
  const candidatos = useMemo(() => {
    if (fila.length > 0) return fila.map((p) => p.especie);
    const ids = (dados?.rankings?.raidOverall ?? []).slice(0, 8).map((r) => r.speciesId);
    return ids
      .map((id) => dados?.species.find((s) => s.id === id))
      .filter((s): s is Especie => !!s);
  }, [fila, dados]);

  /*
   * ⚠️ O DIA ENTRA NA SEMENTE, e isto FALTAVA — o comentário acima já dizia
   * "vem do dia mais o toque nos pontinhos" e o código começava cravado em
   * zero. Consequência: toda abertura do app mostrava o MESMO bicho, para
   * sempre. Era exatamente a reclamação: "não é só o Charizard que fica aí".
   *
   * O dia, e não o relógio: reabrir o app não pode virar roleta — quem voltou
   * para tocar no que viu há um minuto precisa achar aquilo ali. Amanhã é
   * outro, e os pontinhos trocam agora.
   */
  const [passo, setPasso] = useState(() => Math.floor(Date.now() / 86_400_000));
  const indice = candidatos.length > 0 ? passo % candidatos.length : 0;
  const destaque = candidatos[indice];
  /*
   * ⚠️ A SAUDAÇÃO TEM TINTA PRÓPRIA, e não a do resto do herói.
   *
   * Ela mora no TOPO da faixa, sobre a primeira parada e sem véu nenhum por
   * cima; o nome mora embaixo, sobre a terceira JÁ com o véu. São dois fundos
   * diferentes, e usar a mesma tinta nos dois deixava "Boa noite, Miguel."
   * branco sobre `#fa964e` no tema claro — 2,2:1, ilegível.
   */
  const tintaDaSaudacao = destaque
    ? tintaSobre(degradeDoHeroi(destaque.spriteId, corDoTipo(destaque.types[0]), escuro)[0])
    : "#FFFFFF";
  const pendenteAtual = fila.length > 0 ? fila[indice] : null;

  /* A frase do herói: o motivo do veredito quando há fila, e a posição no
     ranking quando não há. As duas vêm do core — nada inventado aqui. */
  const linhaDoDestaque = pendenteAtual
    ? tm(pendenteAtual.veredito.reason)
    : t("home.hero.topRaid");

  /*
   * A tira da coleção, com o VEREDITO de cada um.
   *
   * ⚠️ Quem pede decisão vem primeiro. Sem isso a tira mostrava os doze
   * primeiros guardados, em ordem de cadastro, e a pessoa tinha que abrir um
   * por um para descobrir qual deles queria alguma coisa dela.
   */
  const meus = useMemo(() => {
    if (!dados) return [];
    const pendentes = new Set(fila.map((p) => p.guardado.id));
    return (itens ?? [])
      .map((g) => {
        const especie = dados.species.find((s) => s.id === g.speciesId);
        if (!especie) return null;
        const p = fila.find((x) => x.guardado.id === g.id);
        return { g, especie, acao: p?.veredito.action ?? null };
      })
      .filter((x): x is { g: Guardado; especie: Especie; acao: Action | null } => x !== null)
      .sort((a, b) => Number(pendentes.has(b.g.id)) - Number(pendentes.has(a.g.id)))
      .slice(0, 12);
  }, [itens, dados, fila]);

  /*
   * O ESQUELETO, e não um giro no meio da tela.
   *
   * ⚠️ Um `ActivityIndicator` centralizado diz "espere" e some; o esqueleto diz
   * O QUE vai aparecer, e a tela não pula quando o dado chega — que é o defeito
   * que a lista de lançamento do projeto chama pelo nome.
   */
  if (!pronto) {
    return (
      <View className="flex-1 bg-fundo px-4" style={{ paddingTop: alto + 8 }}>
        <View className="rounded-cartao-sm bg-superficie mb-4" style={{ height: 34, width: 180 }} />
        <View className="rounded-cartao-lg bg-superficie" style={{ height: 268 }} />
        <View className="rounded-pilula bg-superficie mt-4" style={{ height: 52 }} />
        <View className="flex-row gap-2 mt-3">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="rounded-pilula bg-superficie"
              style={{ height: 40, flex: 1 }}
            />
          ))}
        </View>
      </View>
    );
  }

  const nome = setup.nome.trim() || t("home.trainer");

  return (
    <ScrollView
      className="flex-1 bg-fundo"
      /* ⚠️ 24 e não 110: a barra agora é a do sistema, e ela ajusta o inset da
         rolagem sozinha. O respiro grande era para a barra flutuante desenhada
         à mão, e com a nativa ele vira um buraco no fim da lista. */
      contentContainerStyle={{ paddingBottom: baixo + 24 }}
      showsVerticalScrollIndicator={false}
      /* ⚠️ O INÍCIO NÃO ROLA. "bloqueia scroll na tela inicio, n tem scroll la"
         — no desenho tudo cabe numa tela, e uma tela inicial que rola convida a
         procurar embaixo o que deveria estar à vista. O que não couber sai
         daqui para a aba certa. */
      scrollEnabled={false}
      /* ⚠️ `never`: com o ajuste automático o iOS empurraria o conteúdo para
         baixo da barra de status, e o herói deixaria de encostar no topo — que
         é justamente o que ele pediu. O inset entra à mão, dentro do herói. */
      contentInsetAdjustmentBehavior="never"
    >
      {/* ⚠️ A COR SOBE ATÉ O TOPO. A saudação é desenhada DENTRO do herói,
          por cima do degradê, e a barra de status fica sobre a cor. Antes ela
          ficava acima, sobre preto, e o laranja começava numa linha reta. */}
      {destaque && (
        <Heroi
          especie={destaque}
          linha={linhaDoDestaque}
          alto={alto}
          cabecalho={
            <View className="px-4 flex-row items-center gap-3">
              {/* UMA LINHA. "Boa tarde, Treinador." quebrava em duas. */}
              <Text
                className="text-saudacao flex-1"
                style={{ color: tintaDaSaudacao }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {t(saudacao(agora))}, {nome}.
              </Text>
              {/* O avatar leva para as contas — hoje o único lugar onde se troca
                  de coleção. Em vidro porque flutua sobre a cor. */}
              <Toque
                onPress={() => router.push("/colecao")}
                accessibilityLabel={t("colecoes.title")}
                className="rounded-pilula items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor:
                    tintaDaSaudacao === "#FFFFFF" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
                }}
              >
                <Text className="text-corpo font-bold" style={{ color: tintaDaSaudacao }}>
                  {nome.slice(0, 1).toUpperCase()}
                </Text>
              </Toque>
            </View>
          }
          quantos={candidatos.length}
          indice={indice}
          onTrocar={() => setPasso((p) => p + 1)}
          {...(pendenteAtual
            ? {
                acao: t(ACTION_KEYS[pendenteAtual.veredito.action] as Key),
                onFeito: () => {
                  void marcarFeito(pendenteAtual.guardado.id, pendenteAtual.veredito.action).then(
                    recarregar,
                  );
                },
              }
            : {})}
        />
      )}

      {/* Sem destaque não há herói, e a saudação precisa existir mesmo assim. */}
      {!destaque && (
        <View className="px-4 flex-row items-center gap-3" style={{ paddingTop: alto + 8 }}>
          <Text
            className="text-saudacao text-texto flex-1"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {t(saudacao(agora))}, {nome}.
          </Text>
        </View>
      )}

      <View className="px-4">
        {/* A ACAO PRINCIPAL, largura cheia e em pilula.
            ⚠️ AZUL e não branca: no desenho ela é a única coisa com COR de
            acento na tela, e é assim que ela se separa dos atalhos. Branca ela
            competia com o herói. */}
        <Link href="/print" asChild>
          <Toque
            className="rounded-pilula py-4 items-center mt-5 flex-row justify-center gap-2"
            style={{
              backgroundColor: cores.evoluir,
              shadowColor: cores.evoluir,
              shadowOpacity: 0.42,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <SymbolView name="viewfinder" size={17} tintColor="#FFFFFF" fallback={<View />} />
            {/* ⚠️ "Escolher print" não dizia PARA QUÊ. "oq seria escolher
                print? na tela de inicio? fica confuso para usuario" — e é: o
                botão nomeava o gesto (escolher um arquivo) em vez do resultado
                (descobrir o IV). `home.quickScan` é a frase que o site usa. */}
            <Text className="text-corpo font-bold" style={{ color: "#FFFFFF" }}>
              {t("home.quickScan")}
            </Text>
          </Toque>
        </Link>

        {/* ⚠️ DOIS atalhos, não sete. O desenho põe só "Monta um time" e
            "Ginásio" — os outros cinco viraram uma parede de pílulas que
            competia com a ação principal. O resto continua alcançável: Modo
            Pokédex e Itens pela Pokédex, agenda e chocadeira pelos eventos. */}
        <View className="flex-row gap-2 mt-3">
          {ATALHOS.map((a) => (
            <Link key={a.rota} href={a.rota as never} asChild>
              <Toque
                estiloExterno={{ flex: 1 }}
                className="bg-superficie rounded-pilula py-3.5 items-center justify-center flex-row gap-2"
              >
                <SymbolView
                  name={a.icone as never}
                  size={15}
                  tintColor={cores.texto3}
                  fallback={<View />}
                />
                <Text className="text-texto text-corpo font-semibold">{t(a.rotulo)}</Text>
              </Toque>
            </Link>
          ))}
        </View>

        {meus.length > 0 && (
          <>
            {/* DUAS LEGENDAS, uma em cada ponta — é o que o desenho põe, e é a
                que está à direita que dá o motivo de olhar a tira. */}
            <View className="flex-row items-baseline justify-between mt-7 mb-3">
              <Text className="text-texto3 text-legenda">
                {t("home.yourCollection").toUpperCase()}
              </Text>
              {fila.length > 0 && (
                <Text className="text-legenda" style={{ color: cores.evoluir }}>
                  {t(fila.length === 1 ? "home.needsDecision.one" : "home.needsDecision.many", {
                    count: fila.length,
                  }).toUpperCase()}
                </Text>
              )}
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={meus}
              keyExtractor={(x) => x.g.id}
              renderItem={({ item }) => (
                <Link href={{ pathname: "/especie/[id]", params: { id: item.especie.id } }} asChild>
                  {/* CÍRCULOS GRANDES: no desenho a tira é a segunda coisa que
                      o olho pega, e um selo de 54 com o nome embaixo lia como
                      lista. 64 com o rótulo colorido é o que a torna varrível. */}
                  <Toque className="items-center mr-4" style={{ width: 68 }}>
                    <Selo especie={item.especie} tamanho={64} />
                    {/* O rótulo do veredito embaixo, na cor dele — é o que o
                        desenho mostra e o que faz a tira valer mais que uma
                        lista de nomes. */}
                    <Text
                      className="text-legenda text-center mt-2"
                      numberOfLines={1}
                      style={{
                        color: item.acao ? cores[COR_DA_ACAO[item.acao] ?? "texto3"] : cores.texto3,
                        fontSize: 9,
                      }}
                    >
                      {item.acao
                        ? t(ACTION_KEYS[item.acao] as Key).toUpperCase()
                        : item.especie.name.toUpperCase()}
                    </Text>
                  </Toque>
                </Link>
              )}
            />
          </>
        )}
        {/* A dica só aparece quando NÃO há pendência: com fila aberta o assunto
            da tela é a fila, e ensinar por cima disso é ruído. */}
        {!pendenteAtual && dados && <DicaDoDia dados={dados} />}
      </View>
    </ScrollView>
  );
}
