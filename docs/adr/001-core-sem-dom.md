# ADR 001 — Motor em `packages/core` sem DOM

**Estado:** aceite  
**Data:** implícito no desenho do monorepo (documentado 2026-08-31)

## Contexto

TrainerKit precisa de fórmulas de jogo testáveis, reutilizáveis e independentes de React, `window` ou `fetch`.

## Decisão

Toda a lógica numérica e de regras vive em `@trainerkit/core`. A PWA importa funções puras; testes Vitest correm em Node sem jsdom.

O core devolve **chaves i18n + números** (`message.ts`), nunca strings de UI.

## Consequências

- Testes rápidos e determinísticos (~240 casos)
- Possível port para outra shell (native, CLI) reutilizando o mesmo pacote
- Duplicação evitada entre scan server-side (testes) e client-side

## Alternativas rejeitadas

- Lógica dentro dos componentes React — dificulta teste e tradução
- Escrever texto PT no core — quebraria os 10 idiomas
