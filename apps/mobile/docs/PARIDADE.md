# Paridade PWA → app nativo

Levantado em 06/09/2026 comparando `apps/web/src/screens/` com `apps/mobile/app/`.
O alvo dele é "igual ou melhor que o PWA".

## O que já existe nos dois

| PWA | nativo |
| --- | --- |
| `HomeScreen` | `(abas)/index` |
| `EspeciesScreen` | `(abas)/pokedex` |
| `SpeciesDetail` | `especie/[id]` |
| `IVCalculator` | `iv/[id]` |
| `RaidCounters` | `raide/[id]` |
| `Chocadeira` | `chocadeira` |
| `Agenda` | `agenda` |
| `Faxina` | `faxina` |
| `TeamBuilder` | `time` |
| `GymPicks` | `ginasio` |
| `CollectionScreen` | `colecao` |
| `SettingsScreen` + `AiSettings` + `SpriteSettings` + `VoiceSettings` + `DataSourceSettings` | `(abas)/ajustes` |
| `PrivacyScreen` | `legal` |

## O que o nativo tem e o PWA não

- `print/index` — leitor de print da tela de avaliação (o PWA lê pelo mesmo core,
  mas o nativo tem o seletor do rolo de câmera)
- `encontro/[id]` — IV pelo PC antes de capturar
- `itens/index` — o guia de itens que ele pediu em 06/09

## O QUE FALTAVA NO NATIVO — fechado em 06/09/2026

### 1. Modo Pokédex (`DexMode.tsx`) — ✅ feito (`app/dex/index.tsx`)

Câmera aberta, voz lendo a espécie, contador de vistos, e a lista dos
capturados. É a tela que o desenho chama de `5-modo-pokedex.png`, e é a que
carrega a frase dele: *"quero q pareça muito com uma pokedex, até em aparencia,
em funcionalidades"*.

O nativo tem as PEÇAS (`src/voz.ts` fala, `expo-camera` não está instalado, a
lente já existe dentro da ficha) — falta a tela.

### 2. Coleções nomeadas (`Colecoes.tsx`) — ✅ feito (`src/colecao.ts`)

O PWA cria, renomeia, apaga e troca de coleção (`criarColecao`, `listarColecoes`,
`trocarColecao`, `contarPorColecao`). O nativo tem UMA coleção só.

### 3. Contador de vistos (`storage/seen.ts`) — ✅ feito (`src/vistos.ts`)

`markSeen`, `seenIds`, `useSeenCount`, `wasSeen` — não existe no nativo. É o que
faz a Pokédex ter progresso.

### 4. `FeedbackScreen` — ✅ já existia, no fim de `legal/index.tsx`

O canal pra avisar que algo está errado. Não existe no nativo.

### 5. `SpeciesPicker` — decidido que NÃO é lacuna

O seletor de espécie que a coleção e o time usam no PWA. No nativo cada tela
resolve do seu jeito, e isso não tira função nenhuma de quem usa: a busca
existe na Pokédex, no Modo Pokédex e onde mais precisa. Unificar num componente
é refatoração interna — vale quando a terceira tela pedir a mesma busca, não
antes.


## O que o nativo passou a ter e o PWA não

- **Live Activity** dos eventos, na tela de bloqueio e na Ilha Dinâmica
- **Notificação local** de evento (`src/avisos.ts`)
- **Barra de abas de vidro** e tela de Início com herói na cor do tipo
- **Modo Pokédex com câmera de verdade** — o PWA depende da câmera do navegador


## 07/09/2026 — segunda rodada

Pedido dele: *"quero todas as funcoes, tudo igual ou melhor, todas as funções do
wpa, com o desing do claude desing, tudo igual, tudo funcionando"*.

### O degradê

O herói e o cabeçalho da ficha usavam um degradê **diagonal de duas paradas**
terminando em transparente — que só apaga a cor. O pacote usa **três paradas
verticais** (escuro, a cor, claro) em `0% / 46% / 72%`, e é isso que dá a
sensação de luz subindo. Está em `degradeDoTipo()` no core, com teste que trava
a relação (a luz sobe, a matiz não anda) em vez dos hexadecimais.

### A ficha, bloco a bloco

Faltavam sete blocos que o PWA tem, e a ordem era outra. Agora segue a do web:
troca → pra que serve → atributos → tetos de PC → Batalha Max → lente →
sombroso → melhores golpes (segmented) → melhores IV por liga → evolução.

Entraram: **troca**, **pra que serve**, **melhores IV por liga com seletor**,
**"Eu tenho esse"**, **tirar da coleção em dois passos**, **seletor de contexto
de golpe** e a **nota de cada moveset**.

### O resto

| O que | Onde |
| --- | --- |
| Fila de pendências (as 3 condições do web) | `src/pendencias.ts` |
| Herói mostra o que pede decisão, com ação e "feito" | `app/(abas)/index.tsx` |
| Selo de pendências na aba | `app/(abas)/_layout.tsx` |
| Busca no Início, dica do dia, esqueleto | `app/(abas)/index.tsx` |
| Todos/Meus com contagem, grade/lista, 9 ordens | `app/(abas)/pokedex.tsx` |
| Marcar veredito como feito na lista | idem |
| Faixa da faxina, condicional | idem |
| Importar backup | `src/colecao.ts`, `app/colecao/index.tsx` |
| Ajustes: dado do jogo, sobre, apagar tudo | `app/(abas)/ajustes.tsx` |
| Modo Pokédex: ficha inteira, folhear, voz persistente | `app/dex/index.tsx` |
| Movimento: entrada em cascata, mola, transição | `src/movimento.ts` e cia. |

### Duas armadilhas que custaram tempo

- **`createAnimatedComponent(Pressable)` do Reanimated não entrega o toque.** A
  grade inteira ficou muda, sem erro nenhum. O `Animated` do próprio React
  Native resolve, e é o suficiente para uma mola de escala.
- **`UIVisualEffectView` dentro de view com `opacity` animada perde o vidro.**
  O cartão do veredito sumia ao entrar na cascata. A `Entrada` larga a camada
  animada quando termina.


## 07/09/2026 — terceira rodada, achada por varredura de chave

Método: toda chave `t("…")` usada em `apps/web/src` que não aparecia em
`apps/mobile`. Sete buracos reais, todos fechados:

| O que faltava | Onde entrou |
| --- | --- |
| **Discordo** — o veredito para de cobrar, sem sumir | `app/especie/[id].tsx` |
| **Faxina de verdade** — selecionar, confirmar, desfazer, o que ficou | `app/faxina/index.tsx` |
| **"Você consegue?"** na raide — solar, sem chance, quantos treinadores | `app/raide/[id].tsx` |
| **Objetivo do time** — raide ou liga, e o que falta caçar | `app/time/index.tsx` |
| **IV impossível** — diz o que conferir em vez de "não achei" | `app/iv/[id].tsx` |
| **Entre os seus** — a posição dele na sua família | `src/EntreOsSeus.tsx` |
| **Ovo regional** | `app/chocadeira/index.tsx` |

De passagem: `useColecao` passou a memoizar a lista filtrada. Sem isso ela era
um array novo a cada render, e a Faxina entrou em laço infinito
(*Maximum update depth exceeded*).


## 07/09/2026 — a rodada de comparar print a print

Ele mandou *"ta longe de fica parecido ein"* depois da primeira comparação lado
a lado, e estava certo. Montar as duas telas uma ao lado da outra achou seis
diferenças no Início e seis na ficha que eu não tinha visto olhando só o app —
está tudo em `DESIGN.md`.

⚠️ **A busca do Início SAIU.** O PWA tem, o desenho não — e ela empurrava o
herói para fora da primeira dobra. A Pokédex está a um toque e tem a busca
inteira, com filtro e ordem. Isso é a única coisa em que o nativo deixou de
seguir o PWA de propósito, e o motivo é o desenho.
