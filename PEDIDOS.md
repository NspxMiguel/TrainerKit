# Pedidos pendentes — TrainerKit

## [ABERTO] TrainerKit — "app pra pc bem bugado ainda, da uma revisada"

**Pedido em:** 03/08/2026

**Palavras dele:** "app pra pc bem bugado ainda, da uma revisada... https://nspxmiguel.github.io/TrainerKit/"

**Contexto:** mandou print da versão desktop (tela larga) com a tela de detalhe do
Bulbasaur. Problemas visíveis no print: card vazio no topo da coluna direita,
campo de busca sem conteúdo/label, metade esquerda da tela totalmente vazia,
cards cortados na parte de baixo.

**Repo:** `/Users/miguel/Documents/Claude/Projetos/TrainerKit` (clone de NspxMiguel/TrainerKit)

**Status:** consertado e verificado no navegador (390 / 899 / 900 / 1440 / 1920 px),
typecheck e 174 testes passando. Mexe em `App.tsx`, `ui/folha.ts` e `styles/design.css`.
**Falta:** commitar e decidir se publica no GitHub Pages — não fiz nem um nem outro
sem ele pedir.

**Apagar este item só quando estiver commitado (e publicado, se ele quiser).**

### Pedidos novos da mesma conversa (03/08/2026)

1. ~~**"modo pokedex nem faz sentido no computador..."**~~ — FEITO. O cartão só
   aparece fora de `desktop` (PokedexScreen.tsx). iPad continua tendo.
2. ~~**"dispara varios haikus para testar o app..."**~~ — FEITO. Seis agentes,
   por classe de aparelho. Três acharam a mesma causa raiz sozinhos.
3. ~~**"...recria a interface para se encaixar perfeitamente no computador..."**~~
   — FEITO na parte de encaixe: largura passou a decidir a forma. Verificado em
   1920, 1366, 1024, 900/899, 844×390, 820, 800, 673, 390 e 344 — zero
   transbordo, abas alinhadas à coluna em todos.
4. ~~**"no setup nao pediu idioma"**~~ — FEITO. Passo de idioma é o primeiro.
5. ~~**"nem puxo o idioma correto"**~~ — FEITO. `detect()` lê a fila inteira de
   `navigator.languages`, e o setup pergunta em vez de adivinhar.

**Commitado e publicado** em 03/08/2026 (3 commits em `main`, Actions rodou, Pages no ar).

## [ABERTO] TrainerKit — redesenho do zip "Liquid Glass Pokédex Design"

**Pedido em:** 03/08/2026

**Palavras dele:** "Quero trocar a interface pelo redesenho que está no pacote
anexo." Ordem pedida: tokens → tab bar → chip/cartão de veredito → Início →
Pokédex/ficha/folhas → Ajustes → setup → animações. "Comece pelos tokens e pela
tab bar, me mostre rodando."

**⚠️ ACHADO ANTES DE COMEÇAR:** o pacote é a ORIGEM do desenho atual, não um
desenho novo. Tokens idênticos já em `tokens.css`, `VerdictCard.tsx` existe,
"handoff" citado 37× nos comentários — incluindo pontos onde ele mandou desviar
("50px, e nao os 58px do handoff"; "liquid glass somente em dispositivos apple").
Reimplementar ao pé da letra desfaz decisões dele e o trabalho de 03/08.

**Novo de verdade no pacote:** nível do treinador (20/30/40/50) no setup, cartão
de dump offline com progresso real, ícone do ovo chocando (SVG pronto no
PROMPT-PARA-O-CLAUDE.md).

**Escopo decidido por ele:** aplicar o pacote ao pé da letra, MENOS a barra de
abas (fica como está: 50px, vidro só no Apple). Depois refinou: "só mexe no
design, de coisas q n tem no design, funções que a gente colocou q n tem no
design, o resto deixa igual" — ou seja, aplicar onde o desenho fala e não apagar
o que foi acrescentado depois.

**Feito:**
1. **Tokens** — já estavam 1:1 com o README. Três valores desviam de propósito
   (`--tk-text-2`, `--tk-text-3`, topo do `--tk-ultra`); testei os do pacote e
   quebram 8 testes de contraste, violando a regra 3 do próprio pacote. Mantidos.
2. **Nível do treinador** — commit `87fef5e`, no ar. Ligado no cálculo:
   `levelCap = min(nível+2, teto do jogo)` nos dez pontos de veredito.

3. **Cartão de offline** — commit `684f162`, no ar. Ele MEDE o `CacheStorage` em
   vez de fingir progresso: quatro dos cinco itens do handoff não têm o que
   baixar (já estão no pré-cache do SW). O único que falta são as imagens, e
   reaproveita o download que já existia em Ajustes → Imagens.
4. **Cor da tela de abertura** — commit `e570240`, no ar.

**⚠️ O PLANO MUDOU em 03/08:** "vou eu mesmo importar a nova interface, vc só dps
revisa, e adiciona algumas funcoes... pq nao vai tar perfeito, talvez faltando
algumas funcoes q no app original tem... mas dai vc analiza tudo, adiciona as
coisa q falta e dale."

Ou seja: **ele importa, eu reviso depois e reponho o que faltar.** Não continuar
implementando o pacote por conta própria.

**Feito para preparar a revisão:** `REVISAO-POS-IMPORT.md` na raiz do repo — a
checklist de regressão, tirada dos 393 avisos `⚠️` e das 90 falas dele citadas no
código, com "como conferir" item a item.

~~**Pendente do pacote:** ícone do ovo chocando.~~ — FEITO, commit `0e5ade6`.
Caminho escolhido dos três: redesenhado em SDF, sem rasterizador e sem
dependência nova. O `make-icons.ts` continua desenhando a marca proceduralmente.

**Apagar quando a revisão pós-import estiver entregue.**

## [ABERTO] TrainerKit — "esperando ficar igual" ao desenho de desktop

**Pedido em:** 06/08/2026

**Palavras dele:** "acho q ta igual o q te mandei nao" → "n está igual.
esperando ficar igual. só para quando tiver igual/melhor" → "mas ainda ta bem
diferente po, app desktop, animações e etc" → "mockup. animacoes urgente plss".

**Regra que vale pra tudo aqui:** "só mexe no desing, de coisas q n tem no
desing, funções que a gente colocou q n tem no desing, o resto deixa igual".
E: **o celular está pronto e não se mexe.**

**Feito (todos no ar):**
1. Casca de desktop própria, barra lateral com FERRAMENTAS, ficha como segunda
   coluna da Pokédex — `3307b2b`, `c5c04ec`, `919e38e`.
2. Busca no cabeçalho da Pokédex, ficha em duas sub-colunas, rótulos do
   desenho — `b9dd2b8`.
3. Coleção da home em cartões na tela larga, hero compacto — `b57c469`,
   `5285c3a`.
4. As oito animações do documento — `05b45ba`, `088b119`, `6064a66`.
5. Selo de pendências na aba Pokédex — `b66ada7`.
6. Ícone do ovo chocando — `0e5ade6`.
7. **Busca "Buscar na coleção" no cabeçalho da home** — `89ab9e1`. Era o último
   buraco contra o mockup. Ela não filtra a home (a home não lista nada): a
   primeira tecla leva pra Pokédex com o termo junto, e lá o campo já nasce com
   o texto e o foco. Rótulo e destino andam juntos — com coleção vai pra "Meus",
   sem coleção vai pra "Todos".

**Consertado no caminho (bugs do celular, achados ao conferir 375×812):**
- `a02bdf2` — o hero pintava por cima do convite de instalar: 26px do aviso
  sumiam debaixo do degradê.
- `d7b8a32` — o cartão de números do PC vazava no celular como três linhas de
  texto solto. Bug meu, de quando a grade de desktop nasceu.

**Rodada de 07/08/2026 — barra lateral e cartões da coleção:**
8. Seis cartões preenchem a grade de seis colunas. O "VER MAIS" saiu do fim da
   fila e virou "Ver tudo →" à direita do título da seção, como no documento.
9. Barra lateral igual ao documento: marca encostada à esquerda, linhas de 40px
   com raio 11, a pílula violeta `rgba(159,139,255,.14)` no item ativo (ela
   **nunca tinha aparecido** — `[data-platform=…] .tk-tab[aria-current]` de
   `design.css:4008` vence por especificidade quem estiver dentro do `@media`),
   legenda FERRAMENTAS apagada e ferramentas em 38px/13,5px.
10. Os símbolos do veredito nos cartões (`↑ INVESTIR`, `✦ EVOLUIR`,
    `◆ GUARDAR`, `→ TRANSFERIR`), só na tela larga.

**Como está agora:** typecheck limpo, 174 testes passando. Conferido no
navegador em 1440×900 e 375×812 — no celular os quatro itens acima não chegam:
rótulo sem símbolo, cabeçalho sem link, cartão "VER MAIS" de volta, barra de
abas deitada de 63px.

**Três coisas que precisam da palavra dele antes de eu mexer** (regra dele: "Se
algo do desenho conflitar com o código existente, me pergunte em vez de
improvisar"):
- **Poeira estelar** — é a 4ª linha do cartão de números no desenho, e o app não
  guarda esse número em lugar nenhum. Só ele pode dizer quanto tem, e pedir isso
  seria campo novo no setup, que é do celular.
- **Chip do hero** — no desenho o "✦ EVOLUIR" carrega a decisão e o botão é
  neutro ("Ver a conta"); no app quem carrega é o botão ("Power up"). Pôr os
  dois é dizer a mesma coisa duas vezes.
- **Cor dos selos** — o desenho pinta por TIPO (Garchomp sai violeta porque
  Dragão é violeta). O app pinta pela ESPÉCIE, e isso foi **pedido dele**: "mesmo
  sem sprite… tem q aparecer a cor do pokemon", justamente porque o "MW" do
  Mewtwo saía rosa. Igualar ao desenho desfaz o pedido — deixei como está.

**Apagar quando ele disser que ficou igual.** Enquanto ele não disser, o pedido
segue aberto — a régua é a dele, não a minha.

## [ABERTO] `publicar.sh` ficou desatualizado depois da migração de conta

**Achado em:** 07/08/2026, publicando a busca da home. Não é pedido dele — é um
problema que apareceu no caminho e que ele precisa decidir.

**O que o script acha que existe:** dois projetos na Vercel, `trainerkit` (o app,
em `trainerkit.vercel.app`) e `trainerkit-ia` (as funções, em
`trainerkit-ia.vercel.app`, "com as chaves nos cofres dele").

**O que existe de verdade na conta nova (time `nspx`):** UM projeto só,
`trainerkit`. E nem `trainerkit.vercel.app` nem `trainerkit-ia.vercel.app`
pertencem a este time — `vercel inspect trainerkit.vercel.app` responde "Can't
find the deployment under the context nspx". São da conta antiga. O endereço
real do app hoje é **`trainerkit-zeta.vercel.app`**.

**A consequência, medida:** o script faz dois deploys, e o segundo (o da raiz,
que era pra ser a API) cai no MESMO projeto do app e vira a produção. Depois de
rodar, `trainerkit-zeta.vercel.app` estava servindo a landing "TrainerKit · IA"
no lugar do app. Repus com `vercel promote` no deploy do app — o app está no ar
e com o bundle certo (`index-BihipxOU.js`, com a busca nova dentro).

**As três linhas do fim do script ("no ar: …") estão mentindo:** são `echo`
fixos, não leem o que a Vercel devolveu.

**Decisão que é dele:** criar o projeto `trainerkit-ia` na conta nova e mover as
chaves pra lá, ou servir app e API do mesmo projeto (um `vercel.json` só). Não
mexi no arranjo de hospedagem sem ele mandar.

**RESPONDIDO em 07/08/2026** — palavras dele: *"pode faze tudo ai, criar vercel
e etc"*. Ou seja: criar o projeto na conta nova e deixar o `publicar.sh`
funcionando de ponta a ponta. **Limite que continua valendo:** não digito chave
em campo nenhum — se faltar segredo, ele mesmo põe, ou vai CLI→CLI sem o valor
passar por mim.

**Feito em 07/08/2026:**
1. Projeto `trainerkit-ia` criado no time `nspx` e a API publicada nele.
   Responde: `{"error":"GROQ_API_KEY nao configurada no servidor"}` com 503 —
   que é a mensagem que o próprio `api/ai.ts` escreveu pra este caso. A função
   está de pé, só falta a chave.
2. **Os dois deploys agora fixam o projeto pelo nome.** A `.vercel/` é ignorada
   pelo git, então o vínculo da raiz dependia do que tinha rodado antes na
   máquina — era isso que fazia a API derrubar o app da produção.
3. **Endereço público ≠ endereço óbvio.** `trainerkit-ia-nspx.vercel.app`
   responde **401 "Protected deployment"** (Deployment Protection); o que serve
   é `trainerkit-ia-gules.vercel.app`. Como a URL vai gravada DENTRO do build do
   app, esse 401 não apareceria no deploy — apareceria em cada pedido de IA do
   usuário. Está anotado no script e no cabeçalho do `api/ai.ts`.
4. Endereços corretos hoje: app `trainerkit-zeta.vercel.app`, API
   `trainerkit-ia-gules.vercel.app/api/ai`.

**"pega no meu chrome, contas logadas" (07/08/2026)** — conferido: o Chrome está
logado em `miguel-6729`, o MESMO usuário do CLI, e `vercel teams ls` só lista
`Nspx`. Não havia segunda conta pra onde passar. Os endereços velhos
(`trainerkit.vercel.app`, `trainerkit-ia.vercel.app`) estão numa conta que não
está logada ali.

**FECHADO em 07/08/2026.** Ele pôs as duas chaves, redeployei a API e rodei o
`pnpm publicar`. Estado final, tudo medido:
- app `trainerkit-zeta.vercel.app`, bundle `index-c1LyeuTU.js`, apontando pra
  `trainerkit-ia-gules.vercel.app/api/ai`;
- API respondendo de verdade (`{"text":"ok"}` num prompt real do Groq);
- **a produção do app sobreviveu ao deploy da API** — que era o bug. O conserto
  do `publicar.sh` se provou sozinho.

**⚠️ FALTA ELE ROTACIONAR A CHAVE DO GROQ.** No primeiro `vercel env add` a
chave foi colada no campo do NOME da variável, não no valor: a variável nasceu
chamada `gsk_...`. **Nome de variável não é criptografado** — aparece em
listagem, painel e log, e essa apareceu no meu terminal também. Removi a
variável malformada, mas remover não desvaza: a chave tem que ser considerada
queimada.

**Medido em 07/08/2026, e a ordem importa:** a chave que está EM PRODUÇÃO agora
é a queimada — a `TrainerKit` / `gsk_...CJlW` do console, criada no mesmo dia.
Ele corrigiu a variável, mas repôs o mesmo valor. Então **apagar a chave no
console antes de trocar o valor na Vercel derruba a IA do app.**

Como medi, já que não dá pra ler o valor: `vercel env pull` devolve
`[REDACTED: SENSITIVE]` (a variável está marcada como Sensitive), então comparar
prefixo não prova nada — foi por aí que eu errei antes. O que prova é disparar
chamadas pelo proxy e ver qual linha do `console.groq.com/keys` conta: subiu a
da `gsk_...CJlW`, a `gsk_...IMcj` ficou parada.

Ordem certa, então — criar a nova ANTES de apagar a velha:

1. `console.groq.com/keys` → **Create API Key** (não apagar nada ainda);
2. trocar o valor e redeployar:

```
vercel link --project trainerkit-ia --yes
vercel env rm GROQ_API_KEY production
vercel env add GROQ_API_KEY production
vercel deploy --prod --yes
```

3. conferir que a IA responde:

```
curl -s -X POST https://trainerkit-ia-gules.vercel.app/api/ai \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"responda exatamente: ok"}],"maxTokens":10}'
```

4. **só então** apagar a `gsk_...CJlW` no console (lixeira vermelha na linha).

Não precisa republicar o app — a chave vive só no servidor.

**DECIDIDO POR ELE em 07/08/2026: fica como está.** Primeiro "nao precisa apaga,
deixa ai, dps eu faço", depois, já sabendo que a chave em produção é a queimada:
*"ta cara, fodase, deixa, eu quero q continue vazada. so continua"*. Avisei duas
vezes, ele decidiu duas vezes — assunto encerrado, não levantar de novo. O passo
a passo acima fica escrito só pro dia em que ele mudar de ideia.

**Detalhe menor, pré-existente:** o build da API na Vercel cospe `TS2835` em
`api/ai.ts:49` (import sem extensão). É de propósito — o comentário acima da
linha explica que cada lado fala a língua do seu empacotador — o `tsconfig.api.json`
local passa e o deploy completa. Só barulho no log.

## [ABERTO] TrainerKit — celular no iPhone de verdade: scroll quebrado e sem safe area

**Pedido em:** 07/08/2026

**Palavras dele:** "nossa, tudo bugado irmao. scroll em diversas partes do site.
ta bem bugado e bem diferent do claude desing, sem safearea e etc"

**Contexto:** ele abriu o servidor de desenvolvimento no iPhone dele
(`http://10.0.0.72:5273/`), no Safari **e** instalado na tela de início. Mandou
quatro prints. O que dá pra ver neles:

1. **Safari, home** — "Boa noite, Treinador." colado no topo, o bloco do
   cabeçalho aparece **cortado em cima**, com **faixa preta à esquerda e à
   direita** e **barra de rolagem própria** no lado direito. Ou seja: caixa com
   `overflow` e altura presa onde não devia ter.
2. **Instalado, ficha do Metapod** — o sprite entra **por baixo da Ilha
   Dinâmica**, sem respiro, e tem um **retângulo verde claro** aparecendo atrás
   dele (parece caixa de placeholder que ficou visível).
3. **Instalado, home** — essa é a que está mais perto do certo.

**Por que eu não peguei antes:** eu só conferi em 375×812 no navegador do Mac.
Ali não existe entalhe, não existe Ilha Dinâmica, `env(safe-area-inset-*)` é
tudo zero e o scroll do iOS se comporta diferente. Emulação de largura **não
substitui** aparelho de verdade — anotar isso e usar o simulador de iOS daqui
pra frente.

**Cuidado:** "o celular está pronto e não se mexe" continua valendo pro
**desenho**. Isto aqui é conserto de bug, não redesenho.

### O que era, de fato (07/08/2026)

Dois defeitos separados, os dois medidos — não deduzidos.

**1. `animation-fill-mode: both` fazia a coluna virar uma tela dentro da tela.**
Esta é a causa do "scroll em diversas partes do site".

`.tk-main > *` e `.tk-home > *` animavam com `animation: tk-in-up … both`. O
`both` mantém a animação valendo **pra sempre** depois que ela acaba, e o valor
que sobra aplicado **não é `none`**: é a identidade, `matrix(1,0,0,1,0,0)`.
Qualquer transform, inclusive a identidade, faz o elemento virar **bloco
continente** de todo `position: fixed` que mora dentro dele. Medido no Chromium:
`.tk-home` computava `transform: matrix(1, 0, 0, 1, 0, 0)`.

Consequência, e bate print a print com o que ele mandou:

- a faixa de cor do topo (`.tk-home-topo::before`, `fixed`) parava de valer a
  TELA e passava a valer a COLUNA — virava o **retângulo azul com moldura preta
  em volta** do print 1, começando na saudação em vez da borda de cima;
- toda folha cheia aberta pela home (ficha de espécie, calculadora de IV,
  contra-ataques, monta um time) é `position: fixed; inset: 0`. Presa dentro do
  `.tk-home`, deixava de cobrir a tela e o `overflow-y` dela passava a rolar uma
  caixa do tamanho errado. **Esse é o scroll bugado**, e é também a barra de
  rolagem própria que apareceu no lado direito.

O diagnóstico já estava escrito no `design.css`, em `.tk-fax-bar` — naquele dia
foi contornado com `sticky` num lugar só e a causa ficou de pé pro resto.

Conserto: `both` → **`backwards`** nas regras de cascata. Mesma entrada (o quadro
`from` vale durante o atraso), e no fim o elemento volta pro estilo dele, que já
é `opacity: 1; transform: none` — nenhum destes keyframes tem `to`.

**2. O hero cancelava um `max()` com um número fixo.** Essa é a "falta de safe
area". A `.tk-main` empurrava por `max(52, env(safe-area-inset-top) + 12)` e o
`.tk-hero` puxava de volta **52px fixos**. Num aparelho sem entalhe os dois dão
52 e batem — que é exatamente por que isso passou por toda a conferência feita
em aba de navegador. No iPhone dele: 71 contra 52, sobravam **19px** de faixa
entre a Ilha Dinâmica e a arte, e o cabeçalho caía por cima do hero.

Conserto: token único `--tk-respiro-topo`, lido nos dois lados — mesmo remédio
que o `--tk-folha-topo` da folha cheia já usava. Passaram a ler o token a
`.tk-main`, a `.tk-onb`, a `.tk-dex`, o `margin-top` negativo do hero, a altura
da faixa de cor e as três paradas do gradiente dela.

**Conferido no simulador de iPhone 17 Pro, no app instalado** (é o único lugar
onde `env(safe-area-inset-top)` vale 59 de verdade): a arte do hero sobe até a
borda de cima sem emenda e sem moldura; a folha de espécie cobre a tela inteira
e rola de ponta a ponta; a lista da Pokédex rola normal. `typecheck` limpo,
174 testes passando.

**O que NÃO era bug:** o "retângulo esverdeado" atrás do sprite do Metapod é o
`.tk-hero-numero`, o número da dex em marca-d'água gigante. Pro "11" ele lê como
uma barra vertical. Não mexi.

**Apagar quando ele disser que parou de bugar no aparelho dele.**

---

## [ABERTO] TrainerKit — degradê no topo, atrás da barra de status

**Pedido em:** 08/08/2026

**Palavras dele:** "degrade c pa fica legal ne? deixa o app perfeito po, deixa
bonitao"

**O que ele está respondendo:** eu tinha perguntado, no fim do conserto do
iPhone, se ele queria o degradê em cima também. Quando a lista da Pokédex ou uma
folha longa rolam, o texto passa por trás da barra de status e **encosta no
relógio** — dá pra ver "Subir os Ma…" em cima de "7:39". A barra de baixo já tem
remédio pra isso (`.tk-scroll-edge`, citando a HIG da Apple: *"obscuring content
that scrolls beneath them"*); em cima não tinha nada.

**A parte delicada:** o desenho manda a cor subir até o topo, **inclusive por
trás da barra de status** — é o que faz o hero ficar bonito. Um degradê fixo ali
escureceria a arte do hero o tempo todo. Então tem que ser um degradê que **só
aparece quando rolou**, como o iOS faz: com o hero no lugar, nada por cima; assim
que o conteúdo sobe pra debaixo do relógio, ele entra.

### Como ficou (08/08/2026)

`.tk-topo-edge`, uma faixa presa no topo da tela, fora do `.tk-main` de propósito
— o `.tk-main` remonta a cada troca de aba e o vidro não pode piscar junto.

Três decisões que valem estar escritas:

1. **É vidro, não é degradê de `--tk-bg`.** O irmão de baixo (`.tk-scroll-edge`)
   pode ser chapado porque o trabalho dele é apagar o conteúdo pouco antes da
   barra de abas, que é quem de fato cobre. Aqui não há barra nenhuma embaixo do
   efeito — ele *é* a barra. E na home ele cai justo sobre a faixa de cor da
   espécie: chapado viraria mancha escura sobre o azul; o vidro assume a cor do
   que passa por trás. O desbote (`mask-image`) é o degradê que ele pediu.
2. **A altura deriva do recorte, não é número escolhido:**
   `calc(env(safe-area-inset-top) * 1.7)`. Esse `env` é literalmente "quanto de
   sistema há por cima do meu conteúdo": 59px no iPhone com entalhe, 20px num sem
   entalhe instalado, e **zero** em aba de navegador e no PC. Então a peça
   aparece só onde faz falta e some sozinha onde não faz — sem media query, sem
   `[data-platform]`, sem lista de aparelhos.
3. **Só acende depois que rolou** (`useRolouDoTopo`), que era a parte delicada
   acima. O ouvinte é de **captura**, porque `scroll` não borbulha e neste app
   rolam duas coisas: a janela e cada `.tk-sheet-full`.

Um efeito colateral achado e consertado junto: o balão do selo BETA (`.tk-beta-pop`)
nasce colado embaixo do selo. Com o Modo Pokédex rolado, o selo sobe pro alto e o
balão nascia por volta dos 48pt — **dentro** da parte opaca do vidro, saindo
borrado. Subiu de `z-index: 30` pra `46`. A regra que decide os dois lados: passa
por baixo o que **rola**, passa por cima o que a pessoa **acabou de abrir**.

**Conferido no iPhone 17 Pro (PWA instalado, que é o único lugar onde o
`safe-area-inset-top` é 59 de verdade):** hero parado com o vidro apagado e a arte
inteira até a borda; lista da Pokédex rolada com o vidro aceso e o relógio legível;
folha da espécie rolando por conta própria também acende; abrir a folha **apaga** o
vidro mesmo com a janela rolada atrás; voltar ao topo apaga de volta. `pnpm -r
typecheck` limpo e `pnpm -r test` em 180 passando | 7 pulados (eram 174 — as 6
novas são do `useRolouDoTopo.test.tsx`).

Esse teste existe porque **conferir isto dirigindo o navegador não funciona**: a
aba em segundo plano não roda quadro nenhum. Medido, uma `window.scrollTo` levou o
`scrollY` de 700 pra 900 e o contador de eventos ficou em **zero** — sem quadro não
há evento de `scroll` nem `requestAnimationFrame`. O hook parecia quebrado e estava
parado. A foto do simulador responde por uma tela; o teste responde pelas quatro
saídas do filtro (janela, folha, coisa que rola de lado, pedaço no meio da tela).

**Apagar quando ele confirmar que ficou bonito no aparelho dele.**

---

## [ABERTO] TrainerKit — o vidro da barra de abas ficou estranho nos dois modos

**Pedido em:** 08/08/2026

**Palavras dele:** "nao gostei da aplicacao do liquid glass aq.... esse preto ali
fico estranho dms. modo claro tbm estranho..."

Veio com duas fotos lado a lado da **barra de abas**: a do app no escuro e a do
desenho no claro. No escuro a nossa barra é um retângulo **preto chapado**; no
desenho ela é azul-marinho translúcida, com a aba escolhida num comprimido azul
que se lê como vidro. No claro ele também não gostou.

**Feito em 08/08/2026, esperando ele conferir.** A barra ganhou vidro próprio
(`--tk-barra-vidro`), com um piso de opacidade — antes ela dependia de sorte com
o que estava atrás, e sobre o `--tk-bg` preto o desfoque não tinha material. No
claro a tinta da espécie passou a ser misturada com o texto antes de entrar na
barra, senão o acento cru virava um pastel bege dele mesmo.

**Apagar quando ele disser que a barra ficou boa nos dois modos.**

---

## [ABERTO] TrainerKit — a home está "pra cima dms" e falta coisa embaixo

**Pedido em:** 08/08/2026

**Palavras dele:** "eu sinto q ta pra cima dms, ta faltando coisa ali em baixo tbm"

Na foto do aparelho dele sobra um vazio grande entre os dois cartões de baixo
(Monta um Time / Ginásio) e a barra de abas.

**Feito em 08/08/2026, esperando ele conferir.** Entrou a tira "melhores de
raide" no pé da home de consulta, que era onde estava o buraco de ~450px.

**Achei o resto da causa em 09/08/2026** (ele pediu uma análise: *"mais algo q vc
acha legal implementar, ou q ta faltando?"*). A tira encheu o miolo, mas o vazio
colado na barra era outra coisa: a `.tk-main` reservava `84px + área segura` =
118pt no rodapé, e a barra termina aos 68. Eram 50pt de preto sem dono — sobra de
reserva, não falta de conteúdo — e tinha acabado de piorar, porque a barra desceu
e o 84 ficou parado. Agora a reserva é medida pela própria barra
(`--tk-barra-teto + 12`). O hero come a sobra e o Pokémon ficou grande sozinho.
Conferido no aparelho: sem scroll, e a Pokédex continua passando por baixo do
vidro sem cortar item.

**Apagar quando ele disser que a home encheu.**

---

## [ABERTO] TrainerKit — sugestão de pra que usar o Pokémon (raide, PvP e etc)

**Pedido em:** 08/08/2026

**Palavras dele:** "coloca nos pokemon tbm, sujestao para oq usar, reid, pvp e etc"

Ou seja: na ficha da espécie, dizer **pra que aquele Pokémon serve** — raide,
PvP, ginásio — e não só os números.

**Feito em 08/08/2026, esperando ele conferir.** Bloco "pra que usar" na ficha,
lendo a POSIÇÃO nos rankings que o ETL já calcula (`packages/core/src/usos.ts`) —
não o formato dos stats, que mente. Diz "#9 entre os 30 melhores" ao lado, e
"Não briga em nada. Só Pokédex." quando é verdade.

**Apagar quando ele disser que ficou bom.**

---

## [ABERTO] TrainerKit — os ícones novos não estão aplicados corretamente

**Pedido em:** 08/08/2026

**Palavras dele:** "kd novos icones? os icones novos do app ainda n estao
aplicados corretamente"

**Feito em 08/08/2026, esperando ele conferir.** Eram duas coisas: o
`apple-touch-icon` claro no `index.html` (o iOS copia UM arquivo na hora de
instalar, então quem instalasse de dia ficava com o quadrado branco pra sempre) e
a marca DENTRO do app, que ainda era o desenho velho de três barrinhas com seta
verde — no setup e na barra lateral. Agora as duas são o ovo do handoff.

**Apagar quando ele vir o ícone novo no lugar certo.**

---

## [ABERTO] TrainerKit — tirar o aviso de PWA deixa a tela "mt pra cima"

**Pedido em:** 08/08/2026

**Palavras dele:** "acabei de descobrir, quando vc tira a msg de pwa q fica assim
estranho, mt pra cima"

Descoberta dele: é **fechar o aviso de instalar o PWA** que empurra o conteúdo
pra cima e deixa a tela estranha. Provavelmente é o mesmo sintoma do item de
cima, com a causa achada.

**Feito em 08/08/2026, esperando ele conferir.** Ele achou o gatilho, mas não
era a causa: o aviso estava TAPANDO o vazio do pé da home, e fechá-lo só mostrava
o buraco que já existia. Resolvido junto com o item de cima.

**Apagar quando ele disser que fechar o aviso não estraga mais nada.**

---

## [ABERTO] TrainerKit — a arte do Pokémon passa por baixo do notch

**Pedido em:** 08/08/2026

**Palavras dele:** "bug... ultramassando o notch"

Foto do iPhone na ficha do **Weedle**: o desenho do bicho sobe até a Dynamic
Island e some por baixo dela. A cabeça do Weedle fica atrás do recorte.

**Feito em 08/08/2026, esperando ele conferir.** O `margin-top` negativo do hero
da ficha levava o hero INTEIRO pra borda de cima — a intenção era só o degradê, mas
a arte é a primeira faixa da grade e subia junto. Agora a faixa da arte devolve o
recuo (`--tk-folha-topo`, o mesmo token da seta de voltar) e a altura do hero soma
o mesmo valor, pra o bicho não encolher: o fundo continua começando na borda, a
silhueta começa abaixo do entalhe. `styles/design.css`, `.tk-hero--ficha`.

**Conferido no aparelho em 09/08/2026.** Quando ele abriu o PWA no simulador do
iPhone 17 Pro deu pra ver com Ilha Dinâmica de verdade, o que não dava aqui
(`env(safe-area-inset-top)` é 0 no Safari do simulador e no pane). Ficha do
Regigigas: o degradê continua indo até a borda de cima e a arte começa ~136pt
abaixo dela, livre da ilha.

**Apagar quando ele disser que a arte parou de entrar no notch.**

---

## [ABERTO] TrainerKit — a barra de abas tapa a fileira de raide

**Pedido em:** 09/08/2026

Print da home no iPhone, sem texto; ele apontou o defeito escolhendo entre as
opções que ofereci. A fileira **BEST RAID ATTACKERS** fica com os tiles cortados
ao meio pela barra flutuante de Home/Pokédex/Ajustes, e sobra branco embaixo da
barra.

**Feito em 09/08/2026, esperando ele conferir.** A causa era o hero nunca ter
sido elástico no celular: o `.tk-home-linha1` (embrulho que nasceu pra grade de
duas colunas do PC) quebrava calado todas as regras `.tk-home > .tk-hero`, então
a coluna tinha altura fixa — sobrava vazio nas telas altas e transbordava por
baixo da barra nas baixas. Agora o embrulho é uma coluna flexível e o hero cresce
e encolhe com a tela. Medido a 402×874 e 402×740: fileira inteira acima da barra,
sem vazio e sem rolagem.

**Apagar quando ele disser que a fileira aparece inteira acima da barra.**

---

## [ABERTO] TrainerKit — faixa azul sólida no topo da home

**Pedido em:** 09/08/2026

No mesmo print: acima do hero há uma tira de cor chapada, com corte reto, antes
de o degradê começar. Parece bloco a mais ou o degradê começando no lugar errado.

**Feito em 09/08/2026, esperando ele conferir.** A tira eram 38px de layout que a
saudação ocupava e o hero cobria: a saudação ficava invisível atrás do hero, e o
que sobrava à vista era o meio da rampa de cor do `.tk-home-topo::before`, que só
termina 104px abaixo do topo — daí o corte reto. A saudação agora flutua sobre o
degradê (ela já tem tinta escolhida pela luminância do topo), o hero começa em
y=0 e a rampa não aparece mais sozinha. A arte do Pokémon desce o tanto da faixa
da saudação, pra cara continuar livre. Com aviso de PWA na tela a saudação volta
pra fila, e no PC ela continua sendo a primeira linha da coluna, como no
documento.

**Apagar quando ele disser que o topo da home não tem mais aquela tira.**

---

## [ABERTO] TrainerKit — no PWA do iPhone, "Language" cola na lista de escolhas

**Pedido em:** 09/08/2026

Palavras dele: *"olha o simulador de iphone... consegui abrir pwa pra vc testar,
ja vi primeiro bug na tela principal, olha language colado nas escolhas"*.

Primeira tela do onboarding no PWA instalado (iPhone 17 Pro). O título
**Language** encosta no cartão da lista — a borda de cima do cartão passa em cima
do rabo das letras, sem respiro nenhum entre o título e "English".

**Feito em 09/08/2026, conferido no PWA do iPhone.** O `.tk-onb-title` nao tem
margem embaixo de proposito — quem afasta e o bloco de baixo, e todos eles trazem
o proprio `margin-top`. A lista de idiomas era a unica excecao: ela e a MESMA
lista de Ajustes, e la vive dentro de uma secao que ja dava o respiro. Agora
`.tk-onb-body > .tk-card` tem 20px de topo, sem tocar na lista de Ajustes.

**Apagar quando ele disser que o título tem folga acima da lista.**

---

## [ABERTO] TrainerKit — dois idiomas somem da lista do setup

**Achado por mim em:** 09/08/2026, testando o PWA no iPhone 17 Pro logo depois do
bug do título colado.

`LANGUAGES` tem dez idiomas. No PWA aparecem **oito**: 한국어 e Русский são
cortados, e a tela não rola pra alcançar. Quem fala coreano ou russo não consegue
escolher o próprio idioma no setup.

**Feito em 09/08/2026, conferido no PWA do iPhone.** Não era corte: item de
coluna flex encolhe por padrão, e a lista ainda tem `overflow: hidden` (é o que
faz os cantos arredondados cortarem as linhas). Então ela não transbordava — ela
**espremia** e comia as duas últimas linhas por dentro. O corpo via um filho que
cabia e nunca criava rolagem, apesar de o `.tk-onb-body` ter `overflow-y: auto`.
Com `flex: none` nos filhos do corpo o cartão fica com a altura das dez linhas e
a rolagem acontece. Conferido rolando até Русский no aparelho.

**Apagar quando ele disser que a lista chega até Русский.**

---

## [ABERTO] TrainerKit — a barra de abas some na ficha do Pokémon

**Pedido em:** 09/08/2026

**Palavras dele:** *"a barrinha com liquid glass poderia continuar aparecendo ali
po. até mais simples de ir pra tela inicial."*

Print da ficha do Regigigas no PWA: a barra Home/Pokédex/Ajustes não aparece
enquanto a ficha está aberta. Ele quer ela ali, como atalho pra voltar pra home.

**Feito em 09/08/2026, conferido no PWA do iPhone — esperando ele conferir.**
A barra aparece na ficha e tocar numa aba fecha a ficha e leva pra aba (sem isso
o botão trocaria a aba por baixo e pareceria não funcionar). Só na ficha: as
folhas com rodapé próprio (Faxina, seleções em massa) ficariam com duas barras no
mesmo canto. **Isto contraria o handoff**, que manda a barra sumir com folha
aberta — está escrito no código que a decisão é dele.

**Apagar quando ele disser que a barra aparece na ficha.**

---

## [ABERTO] TrainerKit — a barra de abas está feia

**Pedido em:** 09/08/2026

**Palavras dele:** *"essa barra tbm ta muito ruim e feia. melhora ai, claude desing
ta lindona, e essa ai horrivel."*

Comparando com o resto do app (que ele acha bonito), a barra flutuante da home
destoa.

**Feito em 09/08/2026, conferido no PWA do iPhone (escuro e claro) — esperando
ele conferir.**
Havia DUAS barras de vidro pintando o mesmo elemento: o `App.css` continuava
desenhando os pseudo-elementos antigos (um anel borrado de 10px em cada borda,
mais brilho e reflexo até 76%) por cima do desenho novo — numa barra de 50px
isso deixava 30px de miolo entre duas bordas gordas, que é o efeito de plástico
da captura. Os pseudo antigos foram desligados e o reflexo virou um fio de luz no
topo. A lente da aba ativa era mais ESCURA que a barra no modo escuro (parecia
borrão); agora acende — filme claro, sem sombra projetada, com folga maior nas
laterais pra não colar na borda da barra na curva. O texto da aba ativa desceu de
74% pra 45% da cor da espécie, senão perderia contraste contra a lente clara.

**Apagar quando ele disser que a barra ficou bonita.**

---

## [ABERTO] TrainerKit — a barra de abas está muito pra cima

**Pedido em:** 09/08/2026

**Palavras dele:** *"tbm ela ta mt pra cima"*

No print da home no PWA sobra uma faixa preta grande embaixo da barra, entre ela e
a borda de baixo da tela.

**Feito em 09/08/2026, conferido no PWA do iPhone — esperando ele conferir.**
A conta somava a área segura ao respiro (`18px + área segura`), o que dava 52pt e
deixava ~58pt de preto embaixo da barra — mais vazio do que a altura dela. A área
segura não se soma ao respiro, ela SUBSTITUI parte dele:
`max(12px, área segura - 8px)`, que dá 26pt no iPhone (o handoff pede 24) e 12px
onde não há área segura. A bolha da IA subiu junto, senão cruzaria a barra por
16px agora que a barra aparece na ficha.

**Ele pediu de novo em 09/08/2026: "deixa mais pra baixo".** Desceu pra
`max(10px, área segura - 16px)`, 18pt no iPhone. **Esse é o piso**: os ~13pt de
baixo são do indicador de início (o risquinho branco), e cobrir ele põe um botão
em cima de onde começa o gesto de sair do app. Pra descer mais, teria que ser
diminuindo a altura da barra, não o respiro.

**Apagar quando ele disser que a barra desceu.**

---

## [ABERTO] TrainerKit — "mais algo q vc acha legal implementar, ou q ta faltando? analiza ai"

**Pedido em:** 09/08/2026

**Palavras dele:** *"n sei mais nada. mais algo q vc acha legal implementar, ou q
ta faltando? analiza ai"* — e depois, aprovando o plano, *"ok"* e *"dale"*.

Análise escrita em `IDEIAS.md`, seção "O que eu achei olhando o app hoje
(09/08/2026)".

**Duas coisas que eu disse errado pra ele, e já corrigi no IDEIAS.md:**

1. Eu falei que a base do jogo **não tinha data**. Tinha: o ETL grava
   `uploadTime` e `generatedAt`, e Ajustes já mostrava `07/08`. Eu li `len()` do
   objeto `version` e tomei o `6` por um valor.
2. Eu falei que o **"vale a pena esse raide?"** não existia. Existe:
   `screens/RaidCounters.tsx` já dá o veredito (`raid.solo` /
   `raid.needTrainers` / `raid.hopeless`) mais a faixa de PC de captura.

**Feito em 09/08/2026, conferido no PWA do iPhone — esperando ele conferir.**
O buraco que sobrava da (1) era a **idade** da base: `07/08` não responde "está
velha?", porque dois dias e um ano se escrevem igual. Agora sai
`07/08 · 2 days old` nas duas telas que mostram a base (a linha de Ajustes e o
painel "Game data"), mais um aviso quando passa de 30 dias. Conta pelo
`uploadTime`, o relógio do próprio jogo, e não pelo do meu build — senão a data
e a idade sairiam de relógios diferentes.

**O que ficou de fora, porque conflita com o desenho e eu não improviso:** no
celular a tela de raide está a três toques. Os atalhos de Calculadora / Raide /
Time são só de desktop, e a fileira de ações da Início é de duas colunas **de
propósito** (App.css:2363 documenta que a terceira coluna quebrava "Monta um
time pra mim" em três linhas). Pôr um atalho de raide ali é decisão dele.

**Apagar quando ele conferir a idade da base e disser o que fazer com o atalho
de raide.**

---

## [ABERTO] TrainerKit — o ícone na tela inicial está com "bordas esquisitas"

**Pedido em:** 09/08/2026

**Palavras dele:** *"o icone n está legal igual o laranja (outro app meu) ta com
essas bordas esquisitas... primeiro o app é branco dps reto o icone?? da uma
revisada no code ai"*

Print da tela inicial do iPhone dele: **dois ícones de ovo lado a lado** — um
com tile branco e ovo escuro, outro com tile escuro e ovo branco. Os outros
ícones da tela (o terminal laranja, WhatsApp, Música) são arte de borda a borda,
sem moldura por dentro.

**O que eu já medi antes de mexer:** o `apple-touch-icon.png` sai 180x180 com
**10 linhas totalmente transparentes no topo** (recuo de 6%) e **cantos
arredondados próprios** (raio 30/112). O iOS arredonda por conta dele de
qualquer jeito — então o que vai pra tela é o nosso tile arredondado *dentro* do
recorte do sistema. Daí a moldura dupla.

**Consertado em 09/08/2026** (`c8b9b2c`). Eram três defeitos, não um:

1. `apple-touch-icon.png` saía com raio próprio e margem transparente. Agora é
   quadrado opaco de ponta a ponta — 0 pixel não-opaco, alfa 255 nas 4 quinas.
2. O `icon-maskable-512.png` do Android era desenhado como **círculo**
   (`radius = size/2`). Virou quadrado cheio, com a marca em 78% pra caber na
   zona segura de 80%.
3. A quina iluminada estava na aresta errada **nos dois temas** — o sinal do
   deslocamento estava trocado. Escuro acendia embaixo, claro escurecia em
   cima. Medido isolando o efeito (render de controle com `quinaAlfa: 0`).

⚠️ **O ícone já instalado no iPhone dele NÃO vai mudar sozinho.** O iOS copia a
imagem uma vez, na hora de adicionar à tela inicial, e nunca mais relê o
arquivo. Os dois ovos do print são duas instalações. Pra ver o novo: apagar os
dois da tela inicial e adicionar de novo.

**Apagar quando ele disser que o ícone ficou igual aos outros.**

---

## [ABERTO] TrainerKit — texto honesto no "Sobre": app independente, pode ter bug

**Pedido em:** 09/08/2026

**Palavras dele:** *"la no about, da aquela vitimizada, falando q é um app
independente, q pode e encontrara bugs até pq nao tenho qm testar, so conseguiu
testar o app num poco x3 pro e um iphone 17 pro e etc. se se achar bugs manda
pro feedback e etc."*

Os dois aparelhos são **Poco X3 Pro** e **iPhone 17 Pro** — nomear os dois, é o
que dá credibilidade à frase. E o texto tem que levar pro canal de feedback que
já existe, senão é desabafo sem saída.

**Apagar quando ele ler o texto e aprovar.**

---

## [ABERTO] TrainerKit — "deixa o app com cara de app de vdd", produção e bughunt

**Pedido em:** 09/08/2026

**Palavras dele:** *"deixa o app com cara de app de vdd, checa coisa por coisa,
deixando o o app pra producao, bughunt e etc."*

Não é uma tela: é passar o app inteiro, item por item, e deixar em estado de
produção. Caça a bug incluída.

**Apagar quando ele conferir a lista do que eu achei e consertei.**

---

## [ABERTO] TrainerKit — parar de repetir a logo dentro do app

**Pedido em:** 09/08/2026

**Palavras dele:** *"n precisa colocar a logo do app em tudo dentro do app, o
cara ja viu a logo quando abriu o app, as vezes (quase sempre) fica esdruxulo
colocar a logo dnv pro cara ve"*

**Apagar quando ele confirmar que sumiu de onde incomodava.**

---

## [ABERTO] TrainerKit — nada de falas dele em commit, PR e README

**Pedido em:** 09/08/2026

**Palavras dele:** *"so n coloca as minhas falas nos commits e readme pelo amor
de Deus. la so coisas tecnicas nao eu falando pra se vitimiza kkk. inclusive
coloca isso no claude md pra nunca mais esquecer"*

Ele escolheu, quando perguntei, **reescrever os 224 commits antigos** (e não só
valer daqui pra frente) e **varrer os 148 arquivos de código agora** (e não aos
poucos).

**Feito:**

- regra gravada no `~/.claude/CLAUDE.md` e na memória;
- 142 arquivos de código varridos, ~200 trechos reescritos — commit `1cfb4cd`
  na numeração antiga;
- 225 mensagens de commit reescritas em três passadas (`filter-branch`), com a
  árvore conferida byte a byte: **nenhum arquivo mudou**;
- publicado com `--force-with-lease`; `origin/main` agora é `fcadb7d`.

Citação de **fonte técnica** foi mantida de propósito: HIG da Apple, documento
de handoff, GAME_MASTER, Serebii, mensagens de erro de API. São referência
verificável, não conversa.

O histórico antigo continua **só na máquina dele**, na branch
`antes-da-limpeza-de-falas-completo` e na tag `antes-da-limpeza-de-falas` —
nenhuma das duas foi enviada pro GitHub, de propósito.

**Apagar quando ele conferir que o repositório público está limpo.**

---

## [ABERTO] TrainerKit — descobrir o IV pelo PC, antes de capturar

**Pedido em:** 15/08/2026

**Palavras dele:** *"se eu n me engano tbm, tem como descobrir o iv pelo pc tbm,
adiciona isso tbm, pra descobrir o iv antes de capturar"*

O ponto é o **antes de capturar**: na tela de encontro só aparece o PC, e a
avaliação do líder (as três barras) só existe depois que o Pokémon está na
mochila. Então é PC → IV, e não PC+PS → IV como a calculadora faz hoje.

**Entregue em 15/08/2026** (`4f80781`). Fica na calculadora de IV, embaixo do
convite de anexar print: *"Ainda não capturei — descobrir o IV pelo PC"*.

Escolhe a origem (Selvagem / Raide / Ovo / Pesquisa), marca clima se for o caso,
digita o PC. O que sai:

- **raide, ovo e pesquisa** — o jogo fixa o nível do encontro, então o PC
  determina o IV. No topo da faixa a resposta é exata: PC 2.387 num Mewtwo de
  raide **só** pode ser 15/15/15.
- **selvagem** — o nível é sorteado. Medido: sobram ~167 combinações de 4.096, e
  em 800 casos nunca sobrou uma só. A tela mostra a contagem e diz que o PC não
  decide ali, em vez de fingir precisão.
- **PC fora da faixa** — avisa e repete os dois extremos válidos. Se o PC couber
  na faixa do outro clima, aponta isso em vez de recusar.

⚠️ Duas coisas que a medição mudou, e que valem quando ele for testar:

1. "No PC máximo é 100%" vale em **2.455 de 2.466 espécies**. Nas 11 restantes
   (Caterpie, Kakuna, Jigglypuff, Marill e parentes) o arredondamento junta
   15/15/14 com 15/15/15 — aí a tela lista as duas em vez de escolher.
2. No selvagem o PC **não** resolve. Se ele testar por aí primeiro e achar que
   está quebrado, é isso: está certo, e a tela explica por quê.

**Apagar quando ele testar num encontro de verdade.**

---

## [ABERTO] TrainerKit — a base do jogo não atualiza sozinha

**Pedido em:** 15/08/2026

**Palavras dele:** *"esse 9 days old n atualiza automatico"*

Print dos Ajustes → Dados do jogo: **"07/08 · 9 days old"**, e logo acima o texto
da própria tela promete *"merges the sources below and rebuilds every day"*.

A tela promete diário e a base tem 9 dias. Ou o rebuild não está rodando, ou o
app não está buscando o rebuild.

**Consertado em 15/08/2026** (`b2f76b8`).

**O rebuild nunca foi o problema.** O cron das 06:00 roda todo dia e o GitHub
Pages serve base gerada hoje. Quem não andava era o aparelho dele.

O `gamedata.json` está no precache do service worker (de propósito — sem ele o
app abre offline e não calcula nada). Rota de precache atende pela URL exata,
então o `fetch` nunca chegava no servidor: a base passou a ter a cadência do
service worker. E o service worker novo instala e fica **parado** esperando o
botão de atualizar. Quem adiou esse aviso ficou com a base do dia da instalação.

Agora são duas buscas: a do precache (instantânea, offline) e uma segunda com
carimbo do dia na URL, que fura o precache e vai à rede. Troca só quando o
`uploadTime` é maior, e falha em silêncio se não houver rede.

A tela também ganhou a linha **"Última reconstrução"** — `generatedAt`, o
relógio do build. A de cima é o relógio do jogo e fica dias parada sem nada
estar errado; com só ela na tela, "o jogo não mudou" e "meu app parou de
buscar" se liam igual.

⚠️ **O app instalado no celular dele continua 9 dias atrás** — não só a base. Ele
está sem o conserto do ícone e sem o IV pelo PC. Pra pegar tudo: Ajustes →
procurar atualização, ou reinstalar. Vale perguntar se ele marcou "não avisar
mais" em algum momento.

**Apagar quando ele vir a data mudando sozinha.**
