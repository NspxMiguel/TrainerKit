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

**Pendente do pacote (só se ele pedir):** ícone do ovo chocando. Custo real:
`apps/web/scripts/make-icons.ts` desenha a marca atual PROCEDURALMENTE (SDF, zero
dependência, PNG escrito na mão com CRC32); o ovo vem como SVG com paths bezier
e o gerador não tem rasterizador. Três caminhos, já perguntados a ele e ainda sem
resposta: escrever o rasterizador, adicionar dependência, ou redesenhar em SDF.

**Apagar quando a revisão pós-import estiver entregue.**
