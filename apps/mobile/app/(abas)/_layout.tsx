import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useDados } from "../../src/dados";
import { useT } from "../../src/i18n";
import { usePendencias } from "../../src/pendencias";
import { useTema } from "../../src/tema";

/**
 * A BARRA DE ABAS — e ela é a do SISTEMA, não uma desenhada por mim.
 *
 * ⚠️ Isto é `NativeTabs`, que monta um `UITabBarController` de verdade. É a
 * única forma de ter **Liquid Glass de verdade**: o material, o realce que
 * segue o dedo, a barra que encolhe ao rolar e volta ao topo, o morph entre
 * abas — nada disso é CSS nem `GlassView`, é comportamento que o iOS 26 dá de
 * graça a quem usa a barra dele.
 *
 * A versão anterior era uma `View` com `GlassView` por dentro. Ela tinha o
 * material, e só: ficava parada, não encolhia, não reagia ao toque como as
 * barras do sistema. Ele reparou — *"nao ta com liquid glass de vdd, animações
 * do liquid glass e etc"* — e estava certo.
 *
 * ⚠️ É também o que a regra do projeto já mandava e eu não segui: "chrome padrão
 * do sistema — barra de abas, barra de navegação — não leva `GlassView` nenhum".
 *
 * ⚠️ Os ícones são SF SYMBOLS por nome, e não componentes. A barra é nativa: ela
 * desenha o ícone sozinha, no peso e no tamanho que a Apple escolhe para cada
 * estado. Passar uma `View` aqui devolveria o problema que isto veio resolver.
 */
export default function Abas() {
  const { cores } = useTema();
  const { t } = useT();
  const { dados } = useDados();
  /* O selo de pendências. É a única coisa do app que puxa a pessoa de volta sem
     notificação: quantas decisões estão esperando. */
  const pendentes = usePendencias(dados).length;

  return (
    <NativeTabs
      /* `automatic` é o que faz a barra encolher ao rolar e reaparecer no topo
         — o gesto do iOS 26 que o desenho mostra e que a barra desenhada à mão
         não tinha como imitar. */
      minimizeBehavior="automatic"
      tintColor={cores.texto}
      badgeBackgroundColor={cores.investir}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="pokedex">
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
        />
        <NativeTabs.Trigger.Label>{t("tabs.pokedex")}</NativeTabs.Trigger.Label>
        {/* O selo é do sistema também: ele posiciona, anima e some sozinho. */}
        {pendentes > 0 && (
          <NativeTabs.Trigger.Badge>
            {pendentes > 99 ? "99+" : String(pendentes)}
          </NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ajustes">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>{t("tabs.settings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
