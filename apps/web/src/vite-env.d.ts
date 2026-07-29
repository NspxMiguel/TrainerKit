/// <reference types="vite/client" />

/**
 * Quando este build saiu, em UTC. Substituido no build por `define`.
 *
 * Serve pra uma coisa: olhar os Ajustes e SABER se o app atualizou. A versao
 * do `package.json` nao muda a cada correcao, entao ela nunca respondia isso.
 */
declare const __TK_BUILD__: string;
