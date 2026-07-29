# Procedência dos dados

Este arquivo existe por um motivo prático: se um dia chegar uma notificação,
a diferença entre responder em um dia e responder em um mês é ter isto escrito.

Cada dado que o TrainerKit usa está listado abaixo com de onde veio, sob qual
licença, e o que o projeto faz com ele.

---

## O que este repositório **não** contém

**Nenhuma arte de Pokémon.** Nem sprite, nem render, nem ícone do jogo. O
`.gitignore` bloqueia os caminhos e `apps/web/scripts/audit-bundle.ts` roda no
build e **falha o deploy** se alguma imagem não autorizada aparecer.

As únicas imagens publicadas são `icon-*.png`, `favicon-*.png` e
`apple-touch-icon.png` — arte própria, gerada por código em
`apps/web/scripts/make-icons.ts` a partir dos tokens de cor do app.

**Nenhum dado bruto do jogo.** O `GAME_MASTER.json` (18 MB) não é versionado.
O dataset processado também não: é gerado no build.

---

## Dados do jogo

| O quê | Origem | Licença | Uso |
|---|---|---|---|
| `GAME_MASTER.json` | [`alexelgt/game_masters`](https://github.com/alexelgt/game_masters) | **sem licença declarada** | Baixado no build, transformado, descartado |
| Traduções de golpes | [`PokeMiners/pogo_assets`](https://github.com/PokeMiners/pogo_assets) — `Texts/Latest APK/JSON` | **sem licença declarada** | Nome oficial do golpe em 10 idiomas |
| Índice de espécies | [PokeAPI](https://pokeapi.co) | [PokeAPI License](https://github.com/PokeAPI/pokeapi#license) | Só o `id` numérico, para montar URL de sprite |

**Sobre "sem licença declarada":** significa todos os direitos reservados. Os
dois repositórios carregam aviso de *educational use only*. Ambos obtêm o
conteúdo por engenharia reversa do cliente do jogo, o que o §6 dos termos da
Scopely Explore proíbe expressamente.

Não existe caminho 100% limpo aqui, e este documento não finge que existe. O
que existe é uma faixa em que apps como PvPoke, Poke Genie e Calcy IV operam há
cerca de dez anos sem nenhum caso de *enforcement* conhecido. O TrainerKit se
posiciona no lado mais defensável dela:

- não acessa, modifica nem se comunica com os servidores do jogo;
- não faz varredura de mapa nem de spawns;
- não redistribui arte;
- **não é monetizado** — o §6 proíbe uso comercial, e não há nenhum aqui;
- não imita o layout nem a paleta do Pokémon GO (o design é autoral);
- não usa "Pokémon" no nome, no domínio nem no identificador do app.

## Constantes que **não** estão no GAME_MASTER

Estas foram fixadas no código porque o jogo as mantém no cliente. Cada uma tem
comentário explicando a origem e, onde foi possível, um teste que a ancora.

| Constante | Onde | Como foi validada |
|---|---|---|
| Cores das barras de avaliação | `packages/core/src/scan.ts` | Medidas em prints reais. A cor publicada pelo GoIV (`#EE9219`) estava defasada; a real é `#F3A74C` |
| Ordem do enum de tipos | `packages/dataset/src/etl.ts` | Travada por teste — se derrapar, todo ranking fica errado em silêncio |
| Vida e CPM por tier de raide | `packages/core/src/counters.ts` | A vida está ancorada: a fórmula de PC de chefe a usa, e Mewtwo tier 5 reproduz os 54.148 do jogo |
| Escudos dos líderes da Rocket | `packages/core/src/moves.ts` | Confirmado em duas fontes independentes |

## Código de terceiros

A lógica de dano de PvP foi conferida contra o
[pvpoke](https://github.com/pvpoke/pvpoke), que é **MIT**. A licença cobre o
código deles, não os dados — e este projeto não usa os dados deles.

---

## Se você é titular de direitos

Abra uma issue ou entre em contato pelo perfil do dono do repositório. O
conteúdo apontado será removido sem discussão. Não há receita envolvida e não
há interesse em disputa.
