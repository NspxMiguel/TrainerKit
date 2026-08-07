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

**Como está agora:** typecheck limpo, 174 testes passando, build do app com a
auditoria de imagem OK ("todas arte propria"). Conferido no navegador em
1440×900 e 375×812.

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
queimada. Gerar outra em `console.groq.com/keys`, revogar a atual, e:

```
vercel link --project trainerkit-ia --yes
vercel env rm GROQ_API_KEY production
vercel env add GROQ_API_KEY production
vercel deploy --prod --yes
```

Não precisa republicar o app — a chave vive só no servidor.

**Detalhe menor, pré-existente:** o build da API na Vercel cospe `TS2835` em
`api/ai.ts:49` (import sem extensão). É de propósito — o comentário acima da
linha explica que cada lado fala a língua do seu empacotador — o `tsconfig.api.json`
local passa e o deploy completa. Só barulho no log.
