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
 * Campos com prefixo `ob` sao nomes OFUSCADOS pela Niantic/Scopely: a
 * comunidade nao determinou o significado deles e eles mudam de nome sem aviso.
 * Nunca dependa de um campo `ob*` — o ETL deve falhar alto se um campo que
 * importa sumir, em vez de silenciosamente produzir dado errado.
 */
export const OBFUSCATED_FIELD_PREFIX = "ob";
