# TrainerKit — pacote de FORMA (cor vem do app)

Tudo que existe para o redesenho, num lugar. Ordem de leitura:

| # | arquivo | para que serve |
| --- | --- | --- |
| 1 | `prints/INDICE.md` + `prints/*.png` | **comece aqui.** 10 telas na paleta atual, e a tabela dizendo quais classes montam cada uma. |
| 2 | `tokens.css` | variáveis que faltam no app: vidro, raio (pílula vs cartão), tipografia por papel, movimento, sombra. **Sem cor.** Importe DEPOIS do `global.css` real. |
| 3 | `componentes.css` | classes prontas (`.tk-tabbar`, `.tk-pilula`, `.tk-veredito`, `.tk-chip`, `.tk-cartao`, `.tk-t-*`). Cor sempre via `rgb(var(--tk-*))` — nenhum hex literal. |
| 4 | `padroes-de-marcacao.md` | HTML de referência por peça: como montar tab bar, veredito, chip, pílula, cartão, escala tipográfica, entrada de tela. |
| 5 | `mockup-navegavel/` | o mockup interativo (`TrainerKit Mockup.dc.html` + `support.js` + `ios-frame.jsx`). Abra no navegador e toque — é a referência de **comportamento**, não de código. |

## Regras que o pacote respeita (e que não podem ser furadas)

1. **Cor não volta atrás.** Nenhum `#9F8BFF`, `#5B3DF5`, `#6E4BFF`, `#8A6BFF`,
   `#0A0C10`. Fundo é preto de verdade (`#000`), "evoluir" é `#4db2ff` no
   escuro / `#0b62c4` no claro — os mesmos hexes de `paleta-atual-tema.tsx`.
   O violeta que aparece nos prints é só a cor canônica dos tipos
   Dragão/Psíquico: conteúdo, não acento.
2. **Contraste medido, não escolhido no olho.** Os pares de veredito já passam
   4,5:1 sobre o cartão de cada tema. Cor nova entra só depois de medir em
   `packages/core/src/tema-nativo.test.ts`.
3. **Pílula é controle, cartão é conteúdo.** `999px` só em botão, chip, tab e
   segmented; `20/26/28px` em superfície de conteúdo.
4. **Veredito nunca é só cor** — sempre palavra + cor + glifo (daltonismo), e
   sempre o primeiro elemento da ficha, em vidro.
5. **Alvo de toque 44px**, uso com uma mão, ação principal no terço inferior.
6. **Movimento Apple puro** — saída sempre mais rápida que a entrada; uma coisa
   se move por vez; overshoot só no veredito e no press; tudo atrás de
   `prefers-reduced-motion`.
7. **Nenhuma arte oficial de Pokémon.** Onde falta imagem, tile com gradiente
   do tipo + monograma de 2 letras. Isso é o desenho final.

## O que fazer primeiro no repo

1. `tokens.css` e `componentes.css` como arquivos novos, importados depois do
   `global.css`.
2. **Tab bar** (`.tk-tabbar` + `.tk-tabbar-item--ativo`) — é o que mais muda a
   sensação do app. No iOS 26 é `GlassView` do `expo-glass-effect` com
   `glassEffectStyle="regular"`, `isInteractive`, e `tintColor` de
   `rgba(evoluir,.16)` no item ativo; a bolha tem 66px numa barra de 58px e
   `margin: -8px 0` — ela TRANSBORDA a barra, não é preenchimento raso.
3. **Cartão de veredito** na ficha (`4-ficha-veredito.png`).
4. Depois o resto, na ordem dos prints.

Se alguma medida não estiver aqui, pergunte em vez de chutar.
