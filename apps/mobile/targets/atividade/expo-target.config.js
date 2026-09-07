/**
 * A LIVE ACTIVITY dos eventos.
 *
 * ⚠️ O alvo é do tipo `widget` e não existe alvo "live activity" separado: no
 * iOS uma Live Activity É uma WidgetKit extension que declara
 * `ActivityConfiguration` em vez de `StaticConfiguration`. O que a habilita é
 * `NSSupportsLiveActivities` no Info.plist do APP — não no da extensão — e ele
 * entra pelo `app.json`.
 *
 * O identificador vem do bundle do app com `.atividade` no fim, que é o formato
 * que a Apple exige para extensão: o prefixo tem que ser o do app hospedeiro.
 */
module.exports = {
  type: "widget",
  name: "TrainerKitAtividade",
  icon: "../../assets/icon.png",
  deploymentTarget: "16.2",
};
