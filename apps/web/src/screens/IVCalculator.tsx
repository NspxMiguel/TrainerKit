import { useEffect, useMemo, useRef, useState } from "react";
import { useFolha } from "../ui/folha.ts";
import { createPortal } from "react-dom";

import {
  GREAT_LEAGUE,
  MASTER_LEAGUE,
  ULTRA_LEAGUE,
  computeCPAtLevel,
  ivPercentOf,
  ivTotalOf,
  fazGigantamax,
  levelsMatchingHp,
  rankOf,
  solveLevel,
  badgeFor,
  type IVs,
} from "@trainerkit/core";

import type { LeituraOcr } from "../scan/ocr.ts";

import { tetoObservavel, type Dataset, type DatasetSpecies } from "../data/useDataset.ts";
import { useT } from "../i18n/t.ts";
import { tetoDePowerUp, useSetup } from "../onboarding/setup.ts";
import { IVBar } from "../ui/IVBar.tsx";
import { addPokemon, type OwnedPokemon } from "../storage/collection.ts";
import { AmongYours } from "../ui/AmongYours.tsx";
import { AssistantCard } from "../ui/AssistantCard.tsx";
import { BetaBadge } from "../ui/BetaBadge.tsx";
import { VerdictCard } from "../ui/VerdictCard.tsx";
import { ScanDropzone } from "../ui/ScanDropzone.tsx";
import { SpeciesTile } from "../ui/SpeciesTile.tsx";

interface Props {
  species: DatasetSpecies;
  data: Dataset;
  onClose: () => void;
  /**
   * O Pokemon salvo, quando a tela e aberta pela Colecao.
   *
   * Sem isto o app pedia pra escanear DE NOVO um bicho que ja estava salvo com
   * IV, PC e nivel — o dado estava no IndexedDB e a tela abria em branco.
   */
  owned?: OwnedPokemon | undefined;
}

const LEAGUES = [GREAT_LEAGUE, ULTRA_LEAGUE, MASTER_LEAGUE];

export function IVCalculator({ species, data, onClose, owned }: Props) {
  /* A folha sai animada: quem segura o no durante a saida e o `useFolha`. Todo
     caminho de fechamento passa por `fechar`, nunca pelo `onClose` cru — um que
     escape volta a piscar, e so aquele. */
  const { saindo, ref: refFolha, fechar } = useFolha(onClose);

  // Vindo da Colecao, ja nasce com o IV salvo. Sem dono, `null` ate o print ser
  // lido — sem print nao ha o que mostrar.
  const [ivs, setIvs] = useState<IVs | null>(owned?.ivs ?? null);
  // Caminho de recuperacao: so aparece depois de o print falhar. Ate la a tela
  // fica no fluxo que o Miguel pediu — anexa e pronto.
  const setup = useSetup();
  const { t, language } = useT();
  const [manual, setManual] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cp, setCp] = useState(owned?.cp != null ? String(owned.cp) : "");
  const [hp, setHp] = useState(owned?.hp != null ? String(owned.hp) : "");
  // Ja esta na colecao: nao ha o que salvar de novo.
  const jaSalvo = owned !== undefined;

  /*
   * O print acabou de ser lido — e o `ivs` do React ainda pode nao ter chegado.
   *
   * O `onNumeros` do ScanDropzone dispara logo depois do `onRead`, e nesse
   * instante o estado do React ainda pode estar na renderizacao anterior. A
   * conferencia do OCR precisa do IV EXATO daquele print, entao ele vai por
   * referencia, que e sincrona.
   */
  const ivsDoPrint = useRef<IVs | null>(null);
  const [lidoPeloPrint, setLidoPeloPrint] = useState(false);
  /** O OCR leu algo, mas a conta provou que nao podia ser. Ver `aceitarNumeros`. */
  const [numerosRecusados, setNumerosRecusados] = useState(false);

  /**
   * ⚠️ NUMERO LIDO SO ENTRA SE A MATEMATICA CONFIRMAR.
   *
   * Este e o ponto onde o app decide se confia no reconhecimento de texto, e a
   * resposta e "so quando ha prova". Medindo nos 26 prints reais, o leitor
   * acertou 11 de 11 PC e 21 de 21 PS em captura nativa de celular — mas em
   * print de mockup (a tela do celular DENTRO de uma janela de computador) ele
   * devolveu "10" pra um PC de quatro digitos, e "10" passa em qualquer teste
   * de formato que se escreva.
   *
   * A prova sai de graca: com o IV exato vindo das barras, PC e PS
   * sobredeterminam o nivel. Se nenhum nivel produz aquele par, os numeros nao
   * existem juntos — e ai um deles foi lido errado. Descartar e a resposta
   * honesta, e os campos continuam la pra digitar.
   *
   * Sem PC, o PS sozinho ainda vale: ele tambem tem que corresponder a algum
   * nivel, e ja estreita bastante o intervalo.
   *
   * ⚠️ O teto aqui e o OBSERVAVEL, nao o de power-up. Ver `tetoObservavel`:
   * usar o de power-up recusaria o print de um Melhor Amigo, que e legitimo e
   * esta um nivel acima do que se pode comprar.
   */
  const aceitarNumeros = (numeros: LeituraOcr) => {
    const base = ivsDoPrint.current;
    if (!base) return;
    const cap = tetoObservavel(data.version);

    if (numeros.pc !== null && numeros.ps !== null) {
      const possiveis = solveLevel(data.cpm, species.baseStats, base, {
        cp: numeros.pc,
        hp: numeros.ps,
      }, cap);
      if (possiveis.length > 0) {
        setCp(String(numeros.pc));
        setHp(String(numeros.ps));
        setNumerosRecusados(false);
        return;
      }
      setNumerosRecusados(true);
      return;
    }

    if (numeros.ps !== null) {
      if (levelsMatchingHp(data.cpm, species.baseStats, base, numeros.ps, cap).length > 0) {
        setHp(String(numeros.ps));
        return;
      }
      setNumerosRecusados(true);
    }
  };

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);


  const cpNum = Number(cp);
  const hpNum = Number(hp);
  const hasNumbers =
    Number.isInteger(cpNum) && cpNum >= 10 && Number.isInteger(hpNum) && hpNum >= 10;

  // As barras dao o IV; PC e PS servem so pra descobrir o NIVEL, que a
  // avaliacao nao mostra.
  const levels = useMemo(() => {
    if (!ivs || !hasNumbers) return null;
    return solveLevel(data.cpm, species.baseStats, ivs, { cp: cpNum, hp: hpNum });
  }, [ivs, hasNumbers, cpNum, hpNum, data.cpm, species.baseStats]);

  const ranks = useMemo(() => {
    if (!ivs) return null;
    return LEAGUES.map((league) => ({
      league,
      ranked: rankOf(data.cpm, species.baseStats, ivs, league),
    }));
  }, [ivs, data.cpm, species.baseStats]);

  const total = ivs ? ivTotalOf(ivs) : 0;
  const badge = ivs ? badgeFor(total) : null;

  return createPortal(
    <div
      /*
        Sem print, a tela inteira e um convite.

        Antes o botao de anexar ficava num cartao la em cima e sobrava meia
        tela de nada embaixo — a acao mais importante da tela parecendo um
        detalhe de rodape invertido. Com IV lido a tela volta a ser uma lista
        que rola, porque ai ha o que ler.
      */
      ref={refFolha}
      className={`tk-sheet-full${ivs ? "" : " tk-sheet-full--empty"}`}
      data-saindo={saindo || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={t("iv.title", { name: species.name })}
    >
      <header className="tk-sheet-head">
        <button type="button" className="tk-sheet-close" onClick={fechar} aria-label={t("common.back")}>
          ‹
        </button>
        <BetaBadge />
      </header>
      <h1 className="tk-h1">{t("iv.title", { name: species.name })}</h1>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
        <SpeciesTile
          spriteId={species.spriteId}
          dex={species.dex}
          speciesId={species.id}
          name={species.name}
          types={species.types}
          size={72}
        />
        {ivs && badge ? (
          <div style={{ minWidth: 0 }}>
            {/*
              A palavra IV, do tamanho que ela merece.

              O numero grande estava sozinho: "22 / 45" nao diz do que e. E IV e
              justamente o termo que o jogador ja conhece de fora do app — nao
              usar a palavra e trocar o nome que ele procura por um numero
              anonimo. Agora e IV primeiro, valor depois.
            */}
            <div className="tk-iv-label">IV</div>
            {/* Numero inteiro: IV e contagem, nao medida. "48,9%" sugere uma
                precisao que nao existe — o que existe sao 22 pontos de 45. */}
            <div className="tk-iv-total">
              {total}
              <span>/ 45</span>
            </div>
            <AmongYours
              species={species}
              ivs={ivs}
              allSpecies={data.species}
              alreadySaved={saved}
            />
            <div className="tk-caption">
              {Math.round(ivPercentOf(ivs))}% ·{" "}
              <span style={badge.pink ? { color: "var(--tk-dang)" } : undefined}>
                {"★".repeat(badge.litStars)}
                {"☆".repeat(3 - badge.litStars)}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ font: "700 17px var(--tk-font)" }}>{species.name}</div>
            <div className="tk-caption">#{String(species.dex).padStart(3, "0")}</div>
          </div>
        )}
      </div>

      {/* Quem veio da Colecao ja tem o IV: reescanear e opcional, nao o caminho.
          Por isso o convite so aparece pra quem chegou sem nada. */}
      {!jaSalvo && (
      <div className={ivs ? undefined : "tk-empty-slot"}>
        <ScanDropzone
          onRead={(read) => {
            setIvs(read);
            setManual(false);
            ivsDoPrint.current = read;
            setLidoPeloPrint(true);
            setNumerosRecusados(false);
          }}
          onFail={() => {
            setManual(true);
            setIvs((v) => v ?? { atk: 0, def: 0, hp: 0 });
            // Sem IV exato nao ha com o que conferir o que o OCR ler.
            ivsDoPrint.current = null;
            setLidoPeloPrint(false);
          }}
          onNumeros={aceitarNumeros}
        />
      </div>
      )}

      {ivs && (
        <>
      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {manual ? t("iv.enterByHand") : t("iv.whatItRead")}
      </div>
      <section className="tk-card" style={{ marginTop: 10, display: "grid", gap: 18 }}>
        <IVBar
          label={t("common.attack")}
          value={ivs.atk}
          {...(manual ? { onChange: (atk: number) => setIvs((v) => ({ ...v!, atk })) } : {})}
        />
        <IVBar
          label={t("common.defense")}
          value={ivs.def}
          {...(manual ? { onChange: (def: number) => setIvs((v) => ({ ...v!, def })) } : {})}
        />
        <IVBar
          label={t("common.stamina")}
          value={ivs.hp}
          {...(manual ? { onChange: (hp: number) => setIvs((v) => ({ ...v!, hp })) } : {})}
        />
      </section>


      <div style={{ marginTop: 20 }}>
        <VerdictCard
          owned={owned}
          name={species.name}
          baseStats={species.baseStats}
          ivs={ivs}
          level={levels?.[0]?.level ?? 20}
          cpm={data.cpm}
          levelCap={tetoDePowerUp(setup.level, data.version.levelCap)}
          evolvesInto={species.evolvesInto}
          candyToEvolve={
            species.evolvesInto[0]
              ? (species.candyToEvolve[species.evolvesInto[0]] ?? null)
              : null
          }
          gigantamax={fazGigantamax(species.id, data.dynamax)}
        />
      </div>

      {setup.mode === "colecao" && !jaSalvo && (
        <button
          type="button"
          className="tk-btn tk-btn--primary tk-btn--block"
          style={{ marginTop: 12 }}
          disabled={saved}
          onClick={() => {
            void addPokemon({
              speciesId: species.id,
              nickname: null,
              ivs,
              level: levels?.[0]?.level ?? null,
              cp: hasNumbers ? cpNum : null,
              hp: hasNumbers ? hpNum : null,
              lucky: false,
              shadow: false,
              doneAction: null,
            }).then(() => setSaved(true));
          }}
        >
          {saved ? t("iv.savedToCollection") : t("iv.saveToCollection")}
        </button>
      )}

      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {t("iv.findLevel")}{" "}
        <span style={{ textTransform: "none" }}>{t("common.optional")}</span>
      </div>

      {/*
        Por que os campos vieram preenchidos — ou por que NAO vieram.

        Sem uma linha explicando, os dois casos sao confusos do mesmo jeito: um
        numero que aparece sozinho parece bug, e um campo vazio depois de "li o
        seu print" parece descaso. Aqui o app diz o que fez.
      */}
      {lidoPeloPrint && numerosRecusados && (
        <div className="tk-banner tk-banner--warn" style={{ marginTop: 10 }} role="status">
          <div className="tk-banner-text">
            <div className="tk-banner-title">{t("scan.numbersRefused.title")}</div>
            <p className="tk-banner-body">{t("scan.numbersRefused.body")}</p>
          </div>
        </div>
      )}
      {lidoPeloPrint && !numerosRecusados && cp !== "" && hp !== "" && (
        <p className="tk-caption" style={{ marginTop: 8 }}>
          {t("scan.numbersFromPrint")}
        </p>
      )}

      <section className="tk-card" style={{ marginTop: 10, display: "flex", gap: 12 }}>
        <label className="tk-field">
          <span className="tk-caption">{t("common.cp")}</span>
          <div className="tk-search">
            <input
              type="number"
              inputMode="numeric"
              placeholder="3566"
              value={cp}
              onChange={(e) => setCp(e.target.value)}
              aria-label={t("common.cp")}
            />
          </div>
        </label>
        <label className="tk-field">
          <span className="tk-caption">{t("common.stamina")}</span>
          <div className="tk-search">
            <input
              type="number"
              inputMode="numeric"
              placeholder="172"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              aria-label={t("common.stamina")}
            />
          </div>
        </label>
      </section>

      {levels && (
        <div style={{ marginTop: 10 }}>
          {levels.length === 0 ? (
            <div className="tk-banner tk-banner--warn" role="alert">
              <div className="tk-banner-text">
                <div className="tk-banner-title">{t("iv.impossible.title")}</div>
                <p className="tk-banner-body">
                  {t("iv.impossible.body", {
                    cp: cpNum.toLocaleString(language),
                    hp: hpNum,
                    name: species.name,
                  })}
                </p>
              </div>
            </div>
          ) : (
            <section className="tk-card">
              <div className="tk-row">
                <span className="tk-row-label">{t("iv.levelIs")}</span>
                <span className="tk-row-value">
                  {levels.map((l) => l.level).join(` ${t("iv.or")} `)}
                </span>
              </div>
              <div className="tk-row">
                <span className="tk-row-label">{t("iv.cpAt40")}</span>
                <span className="tk-row-value">
                  {computeCPAtLevel(data.cpm, species.baseStats, ivs, 40).toLocaleString(language)}
                </span>
              </div>
              <div className="tk-row">
                <span className="tk-row-label">
                  {t("iv.cpAtCap", { level: data.version.levelCap })}
                </span>
                <span className="tk-row-value">
                  {computeCPAtLevel(
                    data.cpm,
                    species.baseStats,
                    ivs,
                    data.version.levelCap,
                  ).toLocaleString(language)}
                </span>
              </div>
            </section>
          )}
        </div>
      )}

      {setup.assistant && (
        <AssistantCard
          name={species.name}
          baseStats={species.baseStats}
          cpm={data.cpm}
          levelCap={tetoDePowerUp(setup.level, data.version.levelCap)}
          ivs={ivs}
        />
      )}

      <div className="tk-overline" style={{ display: "block", marginTop: 26 }}>
        {t("iv.pvpPosition")}
      </div>
      <section className="tk-card" style={{ marginTop: 10 }}>
        {ranks?.map(({ league, ranked }) => (
          <div className="tk-row" key={league.id}>
            <span className="tk-row-label">{league.name}</span>
            <span className="tk-row-value">
              {ranked
                ? `#${ranked.rank.toLocaleString(language)} · ${(ranked.percent * 100).toFixed(1)}%`
                : t("iv.notEligible")}
            </span>
          </div>
        ))}
      </section>

      {/*
        Sair pelo fim da pagina.

        O unico jeito de fechar era o "‹" la em cima. Depois de ler o veredito,
        as ligas e o nivel, voltar exigia rolar a tela inteira de novo — e uma
        tela longa que so tem saida no topo prende quem chegou ate o fim, que e
        justamente quem leu tudo.

        Fica DENTRO do bloco que so existe com IV lido: sem print a tela cabe
        inteira, o "‹" esta a um dedo de distancia, e um segundo botao de
        fechar seria so mais uma coisa pra ler.
      */}
      <button
        type="button"
        className="tk-btn tk-btn--secondary tk-btn--block"
        style={{ marginTop: 28 }}
        onClick={fechar}
      >
        {t("common.done")}
      </button>
        </>
      )}
    </div>,
    document.body,
  );
}
