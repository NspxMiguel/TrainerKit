/// <reference types="vite/client" />

/**
 * Quando este build saiu, em UTC. Substituido no build por `define`.
 *
 * Serve pra uma coisa: olhar os Ajustes e SABER se o app atualizou. A versao
 * do `package.json` nao muda a cada correcao, entao ela nunca respondia isso.
 */
declare const __TK_BUILD__: string;
/** A versao do `package.json` da raiz, injetada pelo Vite. Ver `vite.config.ts`. */
declare const __TK_VERSAO__: string;

/**
 * URL da funcao que guarda a chave compartilhada da IA.
 *
 * Vazia por padrao: sem ela o app nao oferece a opcao "gratis". Definida no
 * build (Vercel ou GitHub Actions), aponta pra `/api/ai`.
 */
interface ImportMetaEnv {
  readonly VITE_TK_AI_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
