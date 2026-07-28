# TrainerKit

App auxiliar de Pokémon GO que **decide** em vez de só exibir números. Para cada
Pokémon da sua coleção ele responde uma pergunta por vez — vale investir,
evoluir, guardar ou transferir — e sempre mostra o porquê.

PWA offline-first. Sem conta, sem servidor, sem dado saindo do aparelho.

## Como rodar

```bash
pnpm install
pnpm --filter @trainerkit/dataset refresh   # baixa o GAME_MASTER e gera o dataset
pnpm dev
```

O app sobe em `http://localhost:5273`. O servidor escuta na rede local, então dá
para abrir no celular pelo IP da máquina e instalar na tela de início.

## Estrutura

```
packages/core      TS puro, zero DOM. Toda a matemática e as regras.
packages/dataset   ETL que transforma o GAME_MASTER cru no dataset do app.
apps/web           O PWA (Vite + React).
```

`packages/core` não importa React, `window` nem `fetch`. Isso é deliberado: se um
dia o app virar nativo, a matemática vai junto sem reescrita.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe o PWA em modo desenvolvimento |
| `pnpm build` | Build de produção de todos os pacotes |
| `pnpm test` | Testes do core |
| `pnpm typecheck` | Checagem de tipos |
| `pnpm --filter @trainerkit/dataset refresh` | Atualiza o dataset do jogo |
| `pnpm --filter @trainerkit/web exec node scripts/make-icons.ts` | Regera os ícones |

## Dados do jogo

O dataset vem do GAME_MASTER, publicado pela comunidade em
[`alexelgt/game_masters`](https://github.com/alexelgt/game_masters) — que atualiza
a cada 1–3 dias. O repositório mais conhecido (`PokeMiners/game_masters`) costuma
ficar meses atrasado; usá-lo daria vereditos velhos parecendo corretos.

O `fetch` compara o `batchId` antes de baixar os 18 MB, e o ETL **falha alto** se
um campo esperado sumir — melhor quebrar o build do que deixar `undefined`
atravessar o app e reaparecer como veredito errado na tela.

Nada disso entra em runtime: o ETL roda no build e o app carrega um JSON de
~1 MB que fica no precache do service worker.

Procedência e licenças estão em `packages/dataset/src/sources.ts`.

## Matemática

O núcleo é conferido contra a realidade do jogo, não contra si mesmo:

- PC máximo no nível 40 com IV perfeito, para espécies cujo valor é público
  (Machamp 3056, Dragonite 3792, Tyranitar 3834, Rhydon 3179…).
- Os stats base são validados por um caminho **independente** — a conversão que o
  Pokémon GO usa a partir da série principal (`baseStamina = floor(1.75 × HP + 50)`).
  Sem isso, um erro no ETL passaria despercebido por continuar internamente
  consistente.
- O nível máximo é **55**, não 50. A tabela de CPM tem 55 entradas e termina em
  `0.8653`; meios níveis são derivados por média quadrática, não aritmética.

## Aviso

TrainerKit é um app independente feito por fãs e não é afiliado, patrocinado ou
endossado por Scopely Explore (ex-Niantic), The Pokémon Company, Nintendo,
Creatures Inc. ou GAME FREAK. Pokémon, Pokémon GO e os nomes de personagens são
marcas de seus respectivos titulares.

O app funciona exclusivamente por leitura de capturas de tela fornecidas por você
e não acessa, modifica ou se comunica com os servidores do jogo.
