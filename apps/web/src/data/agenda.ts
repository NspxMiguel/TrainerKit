import Dexie, { type Table } from "dexie";
import { useEffect, useState } from "react";

/**
 * O que esta ACONTECENDO, e o que sai de cada ovo.
 *
 * ── Por que isto nao sai do GAME_MASTER ─────────────────────────────────────
 *
 * Todo o resto do app se calcula a partir do `gamedata.json`, que e o proprio
 * arquivo do jogo. Calendario e chocadeira nao estao la: o GAME_MASTER descreve
 * as REGRAS, e evento e chocadeira sao decisao editorial da Niantic, anunciada
 * no blog. Nao ha API publica — e por isso que todo mundo, sem excecao, le do
 * Leek Duck.
 *
 * A fonte e o ScrapedDuck (`bigfoott/ScrapedDuck`, branch `data`), que raspa o
 * Leek Duck e publica JSON. Conferido em 28/08/2026:
 *
 *   events.min.json   53 eventos    30 kB   HTTP 200
 *   eggs.min.json     76 entradas   19 kB   HTTP 200
 *   access-control-allow-origin: *          (o navegador busca direto)
 *
 * ⚠️ E FONTE DE TERCEIRO, e o codigo trata como tal: o app abre sem ela, cada
 * tela diz quando os dados sao velhos, e uma resposta quebrada nao derruba
 * nada. Se o repositorio sumir, as duas telas mostram a ultima copia guardada
 * e dizem a data — nao uma tela em branco.
 *
 * ── O que faz isto ser do TrainerKit, e nao uma copia de lista ───────────────
 *
 * A lista crua qualquer site tem. O que so este app pode fazer e LIGAR:
 *
 *   · cada especie da chocadeira abre a ficha dela — IV, counters, veredito;
 *   · o `combatPower` do choco entra na conta de IV-pelo-PC que o app ja faz
 *     (ovo e nivel 20 com piso 10, ver `encounter.ts`), entao "637" vira
 *     "15/15/15" em vez de um numero solto;
 *   · o nome sai TRADUZIDO, porque quem nomeia e o `gamedata.json` e nao a
 *     fonte — que so fala ingles.
 */

const ORIGEM = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data";
export const FONTE_CREDITO = "Leek Duck · ScrapedDuck";
export const FONTE_LINK = "https://leekduck.com";

/** Um evento do calendario. Campos que a fonte garante; o resto e ignorado. */
export interface EventoAgenda {
  eventID: string;
  name: string;
  eventType: string;
  heading: string;
  link: string;
  image: string;
  /** ISO 8601. Pode faltar em evento sem hora marcada. */
  start?: string;
  end?: string;
}

/** Uma especie que sai de ovo. */
export interface OvoAgenda {
  name: string;
  /** "2 km", "5 km", "7 km", "10 km", "12 km", "1 km". */
  eggType: string;
  isAdventureSync: boolean;
  canBeShiny: boolean;
  isRegional: boolean;
  /** PC do choco. Nivel 20 fixo, entao ele determina o IV. */
  combatPower?: { min: number; max: number };
}

// ─────────────────────────────────────────────────────────────── armazenamento

interface FeedGuardado {
  nome: "eventos" | "ovos";
  dados: unknown;
  em: number;
}

class AgendaDb extends Dexie {
  feeds!: Table<FeedGuardado, string>;
  constructor() {
    super("trainerkit-agenda");
    this.version(1).stores({ feeds: "nome" });
  }
}

const db = new AgendaDb();

async function guardar(nome: FeedGuardado["nome"], dados: unknown): Promise<void> {
  try {
    await db.feeds.put({ nome, dados, em: Date.now() });
  } catch {
    // Modo privado recusa o banco. A tela funciona com o que veio da rede.
  }
}

async function guardado(nome: FeedGuardado["nome"]): Promise<FeedGuardado | null> {
  try {
    return (await db.feeds.get(nome)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Busca com carimbo do dia.
 *
 * Mesmo motivo do dataset (`useDataset.ts`): sem o carimbo a resposta vem do
 * cache HTTP e a agenda ficaria com a cadencia dele. O `raw.githubusercontent`
 * responde `max-age=300`, entao dentro do mesmo dia a URL repete e o cache
 * absorve — a rede so e tocada de verdade uma vez por dia.
 */
function urlDoDia(arquivo: string): string {
  return `${ORIGEM}/${arquivo}?d=${new Date().toISOString().slice(0, 10)}`;
}

async function buscar<T>(arquivo: string): Promise<T[] | null> {
  try {
    const res = await fetch(urlDoDia(arquivo));
    if (!res.ok) return null;
    const dados: unknown = await res.json();
    // Uma resposta que nao e lista nao serve, e nao pode virar `.map` de undefined
    // numa tela. Melhor cair na copia guardada.
    return Array.isArray(dados) ? (dados as T[]) : null;
  } catch {
    return null;
  }
}

export interface EstadoAgenda<T> {
  itens: readonly T[] | null;
  /** Quando esta copia foi baixada. `null` enquanto nada chegou. */
  em: number | null;
  /** `true` quando so ha copia guardada — a tela diz isso em vez de fingir. */
  offline: boolean;
}

const VAZIO = { itens: null, em: null, offline: false } as const;

/**
 * Copia guardada primeiro, rede depois.
 *
 * A tela nunca espera a rede pra aparecer: se ha copia, ela pinta na hora e a
 * versao nova entra quando chegar. E o mesmo desenho do dataset, e pelo mesmo
 * motivo — a agenda tem que abrir no meio da rua, com sinal ruim.
 */
function useFeed<T>(nome: FeedGuardado["nome"], arquivo: string): EstadoAgenda<T> {
  const [estado, setEstado] = useState<EstadoAgenda<T>>(VAZIO);

  useEffect(() => {
    let vivo = true;

    void (async () => {
      const copia = await guardado(nome);
      if (vivo && copia && Array.isArray(copia.dados)) {
        setEstado({ itens: copia.dados as T[], em: copia.em, offline: true });
      }

      const novo = await buscar<T>(arquivo);
      if (!vivo) return;
      if (novo) {
        setEstado({ itens: novo, em: Date.now(), offline: false });
        void guardar(nome, novo);
      } else if (!copia) {
        // Sem rede E sem copia: a tela precisa saber a diferenca entre "vazio"
        // e "nao consegui", entao `itens` fica `null` e nao `[]`.
        setEstado(VAZIO);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [nome, arquivo]);

  return estado;
}

export function useEventos(): EstadoAgenda<EventoAgenda> {
  return useFeed<EventoAgenda>("eventos", "events.min.json");
}

export function useOvos(): EstadoAgenda<OvoAgenda> {
  return useFeed<OvoAgenda>("ovos", "eggs.min.json");
}

// ────────────────────────────────────────────── casar com as especies do app

/**
 * As grafias de forma regional da fonte contra as do GAME_MASTER.
 *
 * ⚠️ MEDIDO, e nao suposto. Casando os 76 ovos pelo nome cru, 65 batiam e 11
 * falhavam — todos regionais, porque a fonte escreve "Galarian Meowth" e o
 * jogo escreve "Meowth (Galarian)". E o jogo nao e consistente consigo mesmo:
 * usa "(Galarian)" num lugar e "(Alola)" — sem o N — noutro. Tentando as duas
 * grafias de cada regiao, o casamento vai a 76 de 76.
 */
const REGIOES: Record<string, readonly string[]> = {
  Alolan: ["Alolan", "Alola"],
  Galarian: ["Galarian", "Galar"],
  Hisuian: ["Hisuian", "Hisui"],
  Paldean: ["Paldean", "Paldea"],
};

/** Os nomes que podem representar esta especie na base do app. */
export function nomesPossiveis(nomeDaFonte: string): string[] {
  const fora = [nomeDaFonte];
  for (const [prefixo, grafias] of Object.entries(REGIOES)) {
    if (!nomeDaFonte.startsWith(`${prefixo} `)) continue;
    const base = nomeDaFonte.slice(prefixo.length + 1);
    for (const g of grafias) fora.push(`${base} (${g})`);
  }
  return fora;
}

/**
 * Uma linha por especie e distancia.
 *
 * ⚠️ A FONTE REPETE, e a repeticao nao e erro dela: Galarian Corsola aparece
 * DUAS vezes em 7 km, uma com `isGiftExchange` e outra sem — sao duas
 * procedencias do mesmo ovo. Na tela isso vira a mesma especie listada duas
 * vezes seguidas, o que qualquer pessoa le como defeito, e de quebra colidia a
 * chave do React.
 *
 * Juntar e a resposta certa em vez de so desempatar a chave: quem abre a
 * chocadeira quer saber DE QUE OVO sai o bicho, e a resposta e uma so. As
 * marcas somam com OU — se qualquer uma das entradas pode ser brilhante, a
 * especie pode ser brilhante.
 */
export function ovosUnicos(lista: readonly OvoAgenda[]): OvoAgenda[] {
  const por = new Map<string, OvoAgenda>();
  for (const o of lista) {
    const chave = `${o.eggType}|${o.name}`;
    const ja = por.get(chave);
    if (!ja) {
      por.set(chave, { ...o });
      continue;
    }
    ja.canBeShiny = ja.canBeShiny || o.canBeShiny;
    ja.isRegional = ja.isRegional || o.isRegional;
    ja.isAdventureSync = ja.isAdventureSync || o.isAdventureSync;
    // O PC nao soma: e o mesmo bicho no mesmo nivel, entao as duas entradas
    // trazem a mesma faixa. Fica a primeira que tiver.
    if (!ja.combatPower && o.combatPower) ja.combatPower = o.combatPower;
  }
  return [...por.values()];
}

/** As distancias, na ordem em que a tela mostra. Fora da ordem alfabetica. */
export const DISTANCIAS = ["2 km", "5 km", "7 km", "10 km", "12 km", "1 km"] as const;

/** Ordena por distancia como o jogo mostra, e nao por texto. */
export function ordemDaDistancia(eggType: string): number {
  const i = DISTANCIAS.indexOf(eggType as (typeof DISTANCIAS)[number]);
  return i === -1 ? DISTANCIAS.length : i;
}

/**
 * Desfaz as entidades HTML do texto da fonte.
 *
 * ⚠️ APARECEU NA TELA: "PokémonXP &amp; 2026 Worlds". A fonte raspa HTML e
 * publica o texto como veio, com as entidades dentro.
 *
 * ⚠️ NAO SE USA `innerHTML` NEM `DOMParser` PARA ISSO. O texto vem de um
 * repositorio de terceiro; jogar num parser de HTML e dar a ele uma superficie
 * que nao precisa existir. Uma tabela fixa resolve as seis entidades que o HTML
 * de verdade produz, e o numerico cobre o resto sem interpretar marcacao
 * nenhuma.
 */
const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

export function semEntidades(texto: string): string {
  return texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (inteiro, corpo: string) => {
    if (corpo.startsWith("#")) {
      const hex = corpo[1] === "x" || corpo[1] === "X";
      const n = Number.parseInt(hex ? corpo.slice(2) : corpo.slice(1), hex ? 16 : 10);
      // Fora da faixa util do Unicode, ou lixo: devolve o texto cru em vez de
      // gerar um caractere que ninguem pediu.
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : inteiro;
    }
    return ENTIDADES[corpo.toLowerCase()] ?? inteiro;
  });
}

/** Eventos que ainda nao acabaram, do mais proximo pro mais distante. */
export function emCartaz(eventos: readonly EventoAgenda[], agora = Date.now()): EventoAgenda[] {
  return eventos
    .filter((e) => {
      // Evento sem `end` fica: nao da pra afirmar que acabou.
      if (!e.end) return true;
      const fim = Date.parse(e.end);
      return Number.isNaN(fim) || fim >= agora;
    })
    .sort((a, b) => {
      const ia = a.start ? Date.parse(a.start) : Infinity;
      const ib = b.start ? Date.parse(b.start) : Infinity;
      return (Number.isNaN(ia) ? Infinity : ia) - (Number.isNaN(ib) ? Infinity : ib);
    });
}

/** `true` quando o evento esta rolando agora. */
export function rolandoAgora(e: EventoAgenda, agora = Date.now()): boolean {
  if (!e.start || !e.end) return false;
  const i = Date.parse(e.start);
  const f = Date.parse(e.end);
  if (Number.isNaN(i) || Number.isNaN(f)) return false;
  return i <= agora && agora <= f;
}
