/**
 * O tema escolhido — lido e aplicado NO IMPORT, antes do primeiro render.
 *
 * ⚠️ Isto existe por causa de um defeito que ficou meses em pé: o tema salvo só
 * era aplicado dentro da tela de Ajustes.
 *
 * O `applyTheme` vivia num `useEffect` do `SettingsScreen`, e `SettingsScreen`
 * só monta quando alguém abre a aba. Resultado: você escolhia "Claro", fechava
 * o app, reabria — e ele voltava a seguir o SISTEMA. Aí bastava tocar em
 * Ajustes pra ver o app inteiro trocar de cor na sua frente, o que parece bug
 * mas era o primeiro momento em que a sua escolha era lida.
 *
 * Foi achado por um varredor de interface: ele reportou contraste 1,10:1 num
 * chip, eu fui medir na mão e deu 4,64. A diferença era o `data-tk` não existir
 * ainda no momento da varredura — o app estava escuro com o `localStorage`
 * dizendo claro.
 *
 * Aqui o efeito colateral acontece no import, como em `i18n/language.ts`, que
 * já resolvia o idioma da mesma forma e pelo mesmo motivo.
 */

export type Tema = "sistema" | "claro" | "escuro";

export const CHAVE_TEMA = "tk:tema";

/**
 * localStorage que não derruba o app.
 *
 * O Safari em navegação privada LANÇA ao gravar, e este módulo roda no import —
 * uma exceção aqui deixaria a tela branca antes do primeiro render.
 */
function ler(): Tema {
  try {
    const v = globalThis.localStorage?.getItem(CHAVE_TEMA);
    return v === "claro" || v === "escuro" ? v : "sistema";
  } catch {
    return "sistema";
  }
}

export function aplicarTema(tema: Tema): void {
  const el = globalThis.document?.documentElement;
  if (!el) return;
  /*
   * "sistema" REMOVE o atributo em vez de escrever um valor.
   *
   * Os tokens têm um bloco `@media (prefers-color-scheme: light)` que só vale
   * quando não há `[data-tk]`. Escrever `data-tk="system"` mataria esse bloco e
   * prenderia o app no escuro — que é o padrão do `:root`.
   */
  if (tema === "sistema") el.removeAttribute("data-tk");
  else el.setAttribute("data-tk", tema === "claro" ? "light" : "dark");
}

export function temaSalvo(): Tema {
  return ler();
}

export function salvarTema(tema: Tema): void {
  try {
    globalThis.localStorage?.setItem(CHAVE_TEMA, tema);
  } catch {
    /* preferência não persistida vale mais que app quebrado */
  }
  aplicarTema(tema);
}

// Aplica agora, no import — antes de o React montar qualquer coisa.
aplicarTema(ler());
