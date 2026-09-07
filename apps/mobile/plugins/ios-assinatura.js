const { withEntitlementsPlist, withXcodeProject } = require("expo/config-plugins");

/**
 * O TIME DE ASSINATURA, em UM lugar só.
 *
 * ⚠️ Ele não morava em lugar nenhum: o `project.pbxproj` saía do `prebuild` sem
 * `DEVELOPMENT_TEAM`, e todo archive precisava do time digitado na linha de
 * comando (`DEVELOPMENT_TEAM=… xcodebuild archive`). Quem esquecesse levava
 * "Signing for 'TrainerKit' requires a development team", que não diz o que
 * fazer — e o `prebuild` seguinte apagaria qualquer correção feita à mão no
 * projeto do Xcode.
 *
 * Aqui o time é dado de configuração: o plugin escreve nas duas configurações
 * (Debug e Release) de todos os alvos, e publica o mesmo valor em
 * `extra.appleTeamId` para o que precisar dele em runtime. Time cravado em dois
 * lugares falha CALADO — é a lição do LootFlow, onde o grupo de chaveiro
 * derivava de um Team ID que ninguém lembrava de atualizar junto.
 *
 * O time atual é o da conta de organização (`SW36PU2B3T`). Trocar de conta é
 * trocar esta linha e rodar `expo prebuild` — não é caçar o valor em quatro
 * arquivos.
 */
const TIME = "SW36PU2B3T";

module.exports = function iosAssinatura(config) {
  config.extra = { ...(config.extra ?? {}), appleTeamId: TIME };

  /*
   * FORA O `aps-environment`.
   *
   * ⚠️ O `expo-notifications` declara a permissão de push só por estar
   * instalado, e o TrainerKit não manda push NENHUM: os avisos de evento são
   * LOCAIS, agendados no aparelho (`src/avisos.ts`), sem servidor e sem token.
   *
   * Com a permissão declarada, o archive falha inteiro — "Provisioning profile
   * doesn't include the Push Notifications capability" — porque o perfil de
   * time com curinga não concede push. Tirar a linha é o correto e não uma
   * gambiarra: o app não usa o recurso.
   *
   * ⚠️ ORDEM IMPORTA. No `plugins` do app.json, quem aparece PRIMEIRO executa
   * por ÚLTIMO — então este plugin tem que estar no COMEÇO da lista para o
   * `aps-environment` que o expo-notifications escreve já ter sido escrito
   * quando ele apagar.
   */
  config = withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    return cfg;
  });

  return withXcodeProject(config, (cfg) => {
    const projeto = cfg.modResults;
    const configs = projeto.pbxXCBuildConfigurationSection();

    for (const chave of Object.keys(configs)) {
      const bloco = configs[chave];
      /* As entradas de comentário (`… _comment`) não são configurações. */
      if (!bloco || typeof bloco !== "object" || !bloco.buildSettings) continue;
      bloco.buildSettings.DEVELOPMENT_TEAM = `"${TIME}"`;
      /* Automático, e não manual: sem conta paga o perfil é regerado toda
         semana, e perfil escolhido à mão vence em 7 dias sem avisar. */
      bloco.buildSettings.CODE_SIGN_STYLE = "Automatic";
    }

    return cfg;
  });
};
