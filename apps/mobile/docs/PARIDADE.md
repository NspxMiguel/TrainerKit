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

## O QUE FALTA NO NATIVO

### 1. Modo Pokédex (`DexMode.tsx`) — o maior buraco

Câmera aberta, voz lendo a espécie, contador de vistos, e a lista dos
capturados. É a tela que o desenho chama de `5-modo-pokedex.png`, e é a que
carrega a frase dele: *"quero q pareça muito com uma pokedex, até em aparencia,
em funcionalidades"*.

O nativo tem as PEÇAS (`src/voz.ts` fala, `expo-camera` não está instalado, a
lente já existe dentro da ficha) — falta a tela.

### 2. Coleções nomeadas (`Colecoes.tsx`)

O PWA cria, renomeia, apaga e troca de coleção (`criarColecao`, `listarColecoes`,
`trocarColecao`, `contarPorColecao`). O nativo tem UMA coleção só.

### 3. Contador de vistos (`storage/seen.ts`)

`markSeen`, `seenIds`, `useSeenCount`, `wasSeen` — não existe no nativo. É o que
faz a Pokédex ter progresso.

### 4. `FeedbackScreen`

O canal pra avisar que algo está errado. Não existe no nativo.

### 5. `SpeciesPicker`

O seletor de espécie que a coleção e o time usam no PWA. No nativo cada tela
resolve do seu jeito.
