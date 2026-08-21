# Revisão legal do TrainerKit

Levantado em 15/08/2026, contra o código publicado e o `dist` do build do dia.

> ⚠️ **Eu não sou advogado e isto não é parecer jurídico.** O que está aqui é o
> levantamento factual do que o app contém, de onde cada coisa vem, e onde isso
> encosta em marca ou direito autoral de terceiro. Decisão de risco é sua; se
> algum item pesar, vale meia hora com um advogado de PI.

## O quadro real, antes da lista

Para um app de fã de Pokémon, o desfecho provável **não é processo**. É
**notificação de remoção** — a Nintendo/TPC manda um DMCA para o GitHub ou para
a Vercel, o repositório e o site saem do ar, e acabou. Processo indenizatório
contra pessoa física por app gratuito é raro e caro para quem move.

Duas coisas mudam a temperatura disso:

- **dinheiro**, que transforma "fã" em "concorrente";
- **arte redistribuída**, que é violação limpa e fácil de provar.

O app já trata as duas — e trata bem. É o motivo de este documento ser curto na
parte ruim.

## O que já está certo

**Nenhuma arte de terceiro é distribuída.** Os sprites são buscados no aparelho
de quem abre o app, direto do PokeAPI, e nunca entram no repositório nem no
build. E isso não depende de eu lembrar: `apps/web/scripts/audit-bundle.ts` roda
depois de todo build e **derruba o deploy** se qualquer imagem fora da lista
branca aparecer no `dist`. As 12 permitidas são as geradas por
`scripts/make-icons.ts` — arte própria, do ovo.

**A carcaça de Pokédex está desligada.** `DexMode.tsx` renderiza com
`data-skin="plain"`. O desenho do aparelho é prop da Nintendo, e as 53 regras de
CSS ficam no arquivo mas não são usadas na build pública.

**O texto de Pokédex do jogo ficou de fora.** As descrições ("Machamp tem quatro
braços que se movem tão rápido…") são obra de roteirista e não entram. O app
escreve as próprias fichas a partir dos números.

**Não toca no servidor do jogo.** O app lê print que você mesmo anexa. Nada de
automação, nada de conta, nada de API não-oficial — que é justamente o que os
termos da Scopely proíbem com todas as letras.

**Doação, e não venda.** A regra está escrita no topo do arquivo da tela:
nenhum recurso pode depender de ter doado. No dia em que um `if` olhar para
"doou ou não", vira venda de acesso a conteúdo derivado, e o argumento inteiro
cai. Hoje não olha.

**Aviso de não-afiliação existe**, nomeando Scopely Explore, The Pokémon Company
e Nintendo.

**Privacidade está acima da média.** Controlador, direitos, menores, cookies,
transferência internacional, e terceiro por terceiro (Groq, ElevenLabs,
hospedagem, imagens). O texto do controlador não fixa e-mail no dicionário: entra
por parâmetro.

## O que está exposto

### 1. Texto oficial do jogo redistribuído — o único item acionável

O `gamedata.json` publicado carrega, **nos dez idiomas oficiais**:

| campo | o que é | exemplo |
| --- | --- | --- |
| `species[].name` | nome da espécie | `Bulbasaur` |
| `moveNames` | nome do golpe | `Cortador de Fúria` |
| `categoryNames` | **a categoria de Pokédex** | `Pokémon Semente` |

Os dois primeiros são inevitáveis: um app companheiro que não nomeia o Pokémon
nem o golpe não serve para nada, e citar marca para se referir ao produto é uso
nominativo.

**`categoryNames` é diferente**, e é o único ponto onde o projeto contradiz a
própria regra. Ela é *flavor text* — a mesma categoria de coisa que as descrições
que você deliberadamente deixou de fora — e é totalmente dispensável: nenhum
cálculo do app usa. Está ligada em `packages/dataset/src/etl.ts`:

```
const INCLUIR_CATEGORIA = true;
```

**Risco real: baixo.** São duas palavras por espécie, e frase curta tem proteção
autoral fraca. Mas é o item com a melhor relação risco/custo do documento:
desligar uma constante remove uma linha da ficha.

### 2. "Pokédex" como nome de função sua

Citar "Pokémon" para dizer sobre o que o app fala é uso nominativo e se defende.
Chamar **uma aba sua** de "Pokédex" é o lado mais fraco disso: já não é citar o
produto do outro, é batizar o seu com a marca dele.

**Risco: baixo a médio**, e é o tipo de coisa que aparece numa notificação antes
de aparecer num tribunal. O aviso de não-afiliação ajuda e já existe.

### 3. Você é o controlador, e isso é público

A política te nomeia como responsável pelos dados — é o que a LGPD exige, e está
correto. Só saiba que é informação pública: quem quiser te notificar sabe para
onde mandar. É o preço de publicar, não um defeito.

### 4. A IA manda texto para os EUA

Pergunta e dossiê da coleção vão para a Groq. Está declarado na política, com
seção de transferência internacional. **Coberto.**

## O que eu faria, em ordem

1. **Desligar `INCLUIR_CATEGORIA`.** Um `false`, e o app para de redistribuir o
   único texto criativo que ainda carrega. Custa uma linha da ficha.
2. **Deixar o aviso de não-afiliação mais visível que "Sobre".** Hoje ele está a
   três toques. No rodapé da Início ou da Pokédex ele cumpre melhor a função.
3. **Não mexer no resto.** Nome, golpes, stats e cálculo são fato ou uso
   nominativo, e tirar isso mata o app sem comprar segurança.

## O que só você decide

- **Renomear a aba "Pokédex".** Reduz superfície de marca e custa reconhecimento
  — a palavra é exatamente o que faz a pessoa entender a tela em um segundo.
- **Manter a doação.** Hoje ela está estruturada do jeito defensável. Qualquer
  coisa que vire contrapartida muda a categoria inteira.
- **Publicar sob pseudônimo ou nome real.** Já está com nome real na política.

## O que eu conferi e estava limpo

- `_handoff/` (mockup do desenho) **não** vai para o ar: está no `.gitignore`,
  existe só na sua máquina, e o `sw.js` publicado não o lista. Um levantamento
  anterior tinha marcado isso como problema de produção — estava errado.
- Nenhum segredo no bundle publicado.
- Nenhuma imagem de Pokémon no `dist`: 52 arquivos, 12 imagens, todas próprias.
