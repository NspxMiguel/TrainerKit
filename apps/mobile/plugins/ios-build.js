const { withPodfileProperties } = require("expo/config-plugins");

/**
 * React Native COMPILADO DA FONTE no iOS.
 *
 * ⚠️ Sem isto o app NÃO LINKA. O React Core pré-compilado que o Expo baixa não
 * exporta `facebook::react::Sealable::Sealable()`, e três pods compilados da
 * fonte referenciam esse símbolo — `react-native-gesture-handler`,
 * `react-native-reanimated` e `react-native-screens`. O erro sai como
 * "Undefined symbols for architecture arm64" no `Ld` do alvo principal, sem
 * dizer que a causa é o pré-compilado.
 *
 * Medido em 06/09/2026: com `DerivedData` NOVO o erro se repete, então não é
 * cache velho — é incompatibilidade entre os cabeçalhos da fonte e o binário
 * pronto. Compilar da fonte custa alguns minutos no primeiro build e resolve.
 *
 * Isto vive num plugin, e não editado à mão no `Podfile.properties.json`,
 * porque aquele arquivo é REGERADO por todo `expo prebuild` — foi exatamente
 * assim que a propriedade se perdeu na primeira vez.
 */
module.exports = function iosBuild(config) {
  return withPodfileProperties(config, (cfg) => {
    cfg.modResults["ios.buildReactNativeFromSource"] = "true";
    return cfg;
  });
};
