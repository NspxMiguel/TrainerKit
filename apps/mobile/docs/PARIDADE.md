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
