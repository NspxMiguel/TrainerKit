/**
 * Procedencia dos dados. Este arquivo existe para ser lido por gente, nao so
 * pelo build: se um dia chegar uma notificacao, a diferenca entre responder em
 * um dia e responder em um mes e ter isto escrito.
 */

export interface Source {
  /** Nome do repositorio ou servico. */
  readonly name: string;
  readonly url: string;
  /** Licenca declarada. `null` = nenhuma, ou seja, todos os direitos reservados. */
  readonly license: string | null;
  readonly notes: string;
}

export const GAME_MASTER_SOURCE: Source = {
  name: "alexelgt/game_masters",
  url: "https://raw.githubusercontent.com/alexelgt/game_masters/master/GAME_MASTER.json",
  license: null,
  notes:
    "Fonte viva do GAME_MASTER: publica a cada 1-3 dias, automatizado. " +
    "O PokeMiners/game_masters, mais conhecido, fica meses atrasado — usa-lo " +
    "como primario daria vereditos velhos parecendo corretos. " +
    "Sem licenca declarada: todos os direitos reservados, com aviso de " +
    "'educational use only'. Dados obtidos por engenharia reversa do cliente.",
};

export const TIMESTAMP_SOURCE = {
  url: "https://raw.githubusercontent.com/alexelgt/game_masters/master/timestamp.json",
  notes:
    "69 bytes. Comparar o batchId antes de baixar os 18 MB do GAME_MASTER.",
} as const;

/**
 * As fontes, como o APP as mostra.
 *
 * Isto vai dentro do proprio `gamedata.json`, e nao fica escrito na interface.
 * O motivo e simples: quem aponta o app pra outra base tem que ver as fontes
 * DAQUELA base, nao as minhas. Procedencia e propriedade do dado, nao do app.
 *
 * `provides` e uma chave de traducao — o dataset nao carrega texto em dez
 * idiomas, carrega a chave e o app resolve.
 */
export interface DeclaredSource {
  readonly name: string;
  readonly url: string;
  readonly provides: string;
}

export const DECLARED_SOURCES: readonly DeclaredSource[] = [
  {
    name: "alexelgt/game_masters",
    url: "https://github.com/alexelgt/game_masters",
    provides: "data.provides.gameMaster",
  },
  {
    name: "PokeMiners/pogo_assets",
    url: "https://github.com/PokeMiners/pogo_assets",
    provides: "data.provides.translations",
  },
  {
    name: "PokéAPI",
    url: "https://pokeapi.co",
    provides: "data.provides.spriteIndex",
  },
];

