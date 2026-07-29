/**
 * Manter o app atualizado depois de instalado.
 *
 * O registro que o plugin injetava era uma linha so:
 *
 *   navigator.serviceWorker.register('/TrainerKit/sw.js', { scope: '/TrainerKit/' })
 *
 * E isso deixava duas portas abertas, as duas verificadas no site publicado:
 *
 *   1. Sem `updateViaCache: 'none'`, o navegador busca o proprio `sw.js`
 *      PASSANDO pelo cache HTTP. O GitHub Pages responde `max-age=600`, entao
 *      por dez minutos o navegador nem pergunta se ha versao nova. Medido: a
 *      pagina rodando `index-C_i5DOSg.js` com o servidor ja em
 *      `index-CWTPbAjl.js`, e `registration.update()` voltando sem nada.
 *
 *   2. O service worker novo assume o controle (`clientsClaim`), mas a pagina
 *      JA CARREGADA continua com o JavaScript antigo na memoria. Sem recarregar,
 *      quem deixa o app aberto — que e o normal num app instalado — fica na
 *      versao velha por tempo indeterminado.
 *
 * O efeito pratico dos dois juntos: eu corrijo alguma coisa, publico, e o
 * Miguel abre o app no iPhone e ve exatamente o mesmo defeito de antes.
 *
 * Aqui o registro e nosso, com as tres coisas que faltavam: cache ignorado na
 * checagem, checagem repetida enquanto o app esta em uso, e recarga quando a
 * versao nova entra de fato.
 */

/** De hora em hora. Um `HEAD` condicional de poucos bytes — nao custa nada. */
const INTERVALO_MS = 60 * 60 * 1000;

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  /*
   * Havia controlador ANTES de tudo?
   *
   * Na primeira visita nao ha, e o `controllerchange` dispara assim que o
   * primeiro service worker assume. Recarregar ali seria recarregar a pagina
   * que a pessoa acabou de abrir, sem nenhum motivo — o JavaScript em memoria
   * ja e o mais novo que existe.
   */
  const jaTinhaControlador = Boolean(navigator.serviceWorker.controller);
  let recarregando = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!jaTinhaControlador || recarregando) return;
    recarregando = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        // A peca que faltava: sem isto o `max-age` do servidor manda na
        // frequencia com que o app consegue se atualizar.
        updateViaCache: "none",
      })
      .then((reg) => {
        const checar = () => {
          // `update()` numa aba escondida gasta rede sem ninguem olhando; e ao
          // voltar pro app e justamente quando vale conferir.
          if (document.visibilityState === "visible") void reg.update();
        };

        setInterval(checar, INTERVALO_MS);
        document.addEventListener("visibilitychange", checar);
      })
      .catch(() => {
        // Sem service worker o app continua funcionando online. Falhar aqui nao
        // pode derrubar nada — Safari privado, por exemplo, recusa o registro.
      });
  });
}
