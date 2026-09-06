# Componentes e módulos — TrainerKit

## Raiz do monorepo

| Pasta | Papel |
| --- | --- |
| `apps/web/` | PWA React — UI, storage, IA/voz client-side |
| `packages/core/` | Motor de jogo testável (sem DOM) |
| `packages/dataset/` | Download + ETL `GAME_MASTER` → JSON |
| `api/` | Handlers Vercel (projeto separado) |
| `deploy/` | `vercel-web.json` + README de cabeçalhos |
| `scripts/` | `publicar.sh`, utilitários |
| `public-vercel/` | Artefacto estático legado |

## `packages/core/src/`

| Módulo | Responsabilidade |
| --- | --- |
| `cp.ts` | CP, tabela CPM até nível 55 |
| `iv.ts` | Solver IV (espécie + CP + HP + appraisal) |
| `scan.ts` / `ocr.ts` | Leitura de barras (geometria; OCR auxiliar) |
| `appraisal.ts` | Selos / faixas de appraisal |
| `verdict.ts` | Motor de decisão + trace de regras |
| `raid.ts` / `counters.ts` | DPS, TDO, counters da coleção |
| `pvp.ts` / `gym.ts` | Stat product por liga; defesa de ginásio |
| `moves.ts` / `rankings.ts` | Melhores movesets por contexto |
| `team.ts` / `trade.ts` / `faxina.ts` | Equipas, troca, limpeza de coleção |
| `message.ts` | Chaves i18n + payload numérico |
| `types.ts` / `types-chart.ts` | Tipos e tabela de tipos |

## `apps/web/src/` — ecrãs

| Ficheiro | Função |
| --- | --- |
| `screens/HomeScreen.tsx` | Hub, scan, atalhos raid/PvP/coleção |
| `screens/EspeciesScreen.tsx` | Lista Pokédex; modos browse / best / mine |
| `screens/CollectionScreen.tsx` | “Meus” (embutido ou standalone) |
| `screens/SpeciesDetail.tsx` | Ficha, veredito, evolução |
| `screens/IVCalculator.tsx` | Calculadora manual |
| `screens/RaidCounters.tsx` | Counters para boss |
| `screens/TeamBuilder.tsx` / `GymPicks.tsx` | Equipas e defesa |
| `screens/DexMode.tsx` | Câmara + TTS + perguntas |
| `screens/SettingsScreen.tsx` | Entrada para sub-ajustes |
| `screens/AiSettings.tsx` / `VoiceSettings.tsx` | IA e voz |
| `screens/DataSourceSettings.tsx` | URL alternativa de `gamedata.json` |
| `screens/SpriteSettings.tsx` | Fonte de imagens opcional |
| `screens/PrivacyScreen.tsx` | Privacidade por serviço |
| `screens/Chocadeira.tsx` / `Agenda.tsx` / `Faxina.tsx` | Ovos, eventos, limpeza |
| `onboarding/Onboarding.tsx` | Primeira execução |

## `apps/web/src/` — outros módulos

| Pasta | Papel |
| --- | --- |
| `ai/` | `provider`, `ask`, `vision`, `groq`, `local`, `quota`, `dossier`, TTS clients |
| `storage/` | `collection` (Dexie), `persist`, `offline`, `updates`, `wipe` |
| `scan/` | Pipeline screenshot → barras |
| `sprites/` | Cache e prefetch de sprites opcionais |
| `i18n/` | 10 idiomas + testes de paridade |
| `ui/` | `VerdictCard`, `ScanDropzone`, `folha` (modais), ícones, tema |
| `data/` | `useDataset`, fonte built-in vs custom |

## `packages/dataset/src/`

| Ficheiro | Função |
| --- | --- |
| `download.ts` | Fetch `GAME_MASTER` |
| `etl.ts` | Transformação → `gamedata.json` |
| `sources.ts` / `paleta.ts` | Metadados e cores por tipo |

## Testes por área

- Core: fórmulas, scan sintético/realprints, veredito, rankings
- Web: i18n, guarda IA, contraste/paleta, OCR opcional com PNGs locais

Ver também [STRUCTURE.md](./STRUCTURE.md) para árvore completa.
