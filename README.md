# TrainerKit

Um app de Pokémon GO que **decide** em vez de só mostrar números.

Já existem calculadoras demais. Você anexa o print da avaliação, aparece
"96,4%", e a pergunta continua sem resposta: *e daí?* Vale investir? Vale
evoluir? Dá pra transferir sem se arrepender?

O TrainerKit responde isso — e mostra por quê.

**[Abrir o app →](https://spxmiguel.github.io/TrainerKit/)**

PWA offline-first. Sem conta, sem servidor, sem dado saindo do aparelho.

---

## O que ele faz

**Lê o print da avaliação.** As três barras são geometria, não texto — o app
conta os blocos preenchidos e devolve o IV **exato**. Não é OCR, então não
existe "quase certo": ou ele leu, ou diz que não conseguiu. Validado em 26
prints reais, de 240p a 4K.

**Dá um veredito.** Investir, evoluir, guardar ou transferir, com uma frase de
motivo e uma barra de confiança que é literalmente o quanto as regras concordam
entre si. Quando duas puxam pra lados opostos, ela cai — e deve cair.

**Mostra o rastro.** Todo veredito abre em regras nomeadas com peso:

```
decide(machamp)
├─ evolucao.pendente..... +0.70
├─ pvp.rank.............. +0.90
└─ veredito.............. 0.56
```

Isso não é enfeite: o motor foi construído para ser explicável. Um app que manda
você confiar sem poder conferir é só mais um app.

**Melhores ataques por objetivo** — raide, PvP, uso geral e Rocket. O contexto
Rocket recomenda um *par*: os líderes bloqueiam seus dois primeiros carregados,
então a resposta é isca barata + finalizador forte.

**Counters de raide da sua coleção.** Não "os melhores do jogo" — os **seus**.
Se ele disser que precisa de três pessoas, é porque precisa.

**Rankings** dos melhores do jogo por tipo de ataque. A lista de PvP é rotulada
como o que é: stat product, não tier list.

## Rodando localmente

```bash
pnpm install
pnpm --filter @trainerkit/dataset refresh   # baixa o GAME_MASTER e gera o dataset
pnpm --filter ./apps/web dev
```

O `refresh` leva ~15s e precisa de rede. O app sobe em `http://localhost:5273` e
escuta na rede local, então dá pra abrir no celular pelo IP da máquina.

| Comando | O que faz |
|---|---|
| `pnpm -r typecheck` | Checagem de tipos nos três pacotes |
| `pnpm -r test` | 116 testes |
| `pnpm --filter ./apps/web build` | Build de produção + auditoria do bundle |
| `pnpm --filter ./apps/web icons` | Regera os ícones a partir dos tokens |

## Como está organizado

```
packages/core/      TypeScript puro, zero DOM. Toda a matemática e as regras.
packages/dataset/   ETL: GAME_MASTER → JSON compacto + rankings pré-calculados.
apps/web/           O PWA (Vite + React 19).
```

`packages/core` não importa React, `window` nem `fetch`. Recebe dados, devolve
resultados. É o que o torna testável de verdade — e o que faz a matemática
sobreviver a uma eventual troca de plataforma.

O core também **não escreve texto**: devolve chave de tradução mais os números.
Quem monta a frase é a interface, que sabe o idioma. São 10 idiomas, e o
compilador quebra o build se algum esquecer uma chave.

## Matemática conferida contra o jogo, não contra si mesma

- PC máximo no nível 40 com IV perfeito, para espécies cujo valor é público
  (Machamp 3056, Dragonite 3792, Tyranitar 3834, Rhydon 3179…).
- Os stats base são validados por um caminho **independente** — a conversão que
  o Pokémon GO faz a partir da série principal
  (`baseStamina = floor(1.75 × HP + 50)`). Sem isso, um erro no ETL passaria
  despercebido por continuar internamente consistente.
- O nível máximo é **55**, não 50. A tabela de CPM tem 55 entradas e termina em
  `0.8653`; meios níveis vêm de média quadrática, não aritmética.
- O PC de chefe de raide reproduz o do jogo: Mewtwo tier 5 dá 54.148.

## Imagens e dados são seus

O app **não embarca arte de Pokémon**. Por padrão cada espécie aparece com um
selo na cor do tipo e as iniciais.

Se quiser imagens, aponta uma fonte nos Ajustes — um link de manifesto ou um
`.zip`. O mesmo vale para os **dados do jogo**: dá pra apontar outro
`gamedata.json`, conferido antes de valer. Assim o app não fica preso a mim — se
eu parar de atualizar a base, você troca a fonte e segue.

## Assistente com IA (opcional)

Dá pra ligar uma chave da [Groq](https://console.groq.com) nos Ajustes. Ela fica
no seu aparelho e vai direto pro provedor: não há servidor no meio e não há
cobrança.

Ele **não analisa nada** — o veredito já foi calculado aqui, com o rastro de
regras. O modelo só reescreve em linguagem natural. Isso é desenho, não
limitação: um modelo que recebesse só "Machamp 96%" inventaria a análise.

## Licença

Código sob [MIT](LICENSE).

Os dados do jogo têm outra origem e outra situação. **[DATA.md](DATA.md)**
documenta a procedência de cada um, incluindo o que este projeto
deliberadamente não redistribui.

## Aviso

TrainerKit é um app independente feito por fãs e não é afiliado, patrocinado ou
endossado por Scopely Explore (ex-Niantic), The Pokémon Company, Nintendo,
Creatures Inc. ou GAME FREAK. Pokémon, Pokémon GO e os nomes de personagens são
marcas de seus respectivos titulares.

O app funciona exclusivamente por leitura de capturas de tela fornecidas pelo
usuário e **não acessa, modifica ou se comunica com os servidores do jogo**.
Não é monetizado.
