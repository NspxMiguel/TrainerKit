# Ideias

## Por que a lista anterior era ruim

A primeira versão deste arquivo listava "custo em poeira", "comparador lado a
lado", "cobertura de tipos". Recheio de calculadora. Nenhuma delas faz alguém
**abrir** o app — respondem perguntas que a pessoa só faria se já estivesse
com o app aberto.

O teste que a lista velha não passava: *isso faz o Miguel tirar o celular do
bolso no meio da rua?*

Quem joga Pokémon GO abre um app auxiliar em três situações, e só três:

1. **Acabou de pegar alguma coisa** e precisa decidir na hora se guarda.
2. **Vai entrar num raide** e precisa saber se dá conta.
3. **Está com a mochila cheia** e precisa limpar.

Tudo que não serve a um desses três é feature de quem gosta de mexer no app,
não de quem joga.

---

## O que já responde essas três

**(1) acabou de pegar** — o scanner lê o print e dá o veredito. E desde agora
diz *onde ele fica entre os que você já tem*: "o seu melhor entre 4 dessa
família". Era a metade que faltava.

**(2) vai entrar num raide** — os counters saem da sua coleção e dizem quantas
pessoas você precisa.

**(3) mochila cheia** — a **Faxina**. Era "o maior buraco" e deixou de ser.

Ela não lista: ela separa em duas listas, e a separação é o produto inteiro.
*Sem dúvida* são os duplicados que perdem para um irmão da mesma espécie em
todos os critérios — vêm pré-marcados, porque a afirmação se confere item por
item. *Você decide* é o resto, explicado e nunca pré-marcado.

E ela mostra o que **se recusa** a sugerir, com o motivo de cada um. Essa é a
metade que faz a outra ser levada a sério: um app de faxina em que a pessoa não
consegue auditar o que ficou de fora é um app que ela usa uma vez.

---

## As duas que eu faria agora

### 1. Escanear vários prints de uma vez

Hoje é um print, um Pokémon, uma tela. Mas quem acabou de fazer uma sessão de
capturas tem 20 prints na galeria.

O `<input multiple>` já existe no iOS e abre a fototeca com os mais recentes
primeiro. Faltam a fila de leitura e a tela de revisão — "li 18 de 20, estes
dois não deram".

Junto com a faxina, transforma o app de "consulto um" em "resolvo a sessão".

### 2. Vale a pena esse raide?

Antes de gastar o passe: *"você derruba sozinho em 2 min"*, *"você derruba mas
cai 3 vezes"*, *"nem com a sala cheia"*. O motor de counters já calcula isso —
falta virar uma resposta que se dá **antes** de entrar, não durante.

---

## Depois, se fizer sentido

**IA local.** O Miguel perguntou e eu não entreguei. Dá pra fazer com WebLLM,
mas o menor modelo útil passa de 500 MB de download. Antes de gastar isso do
usuário: vale? Com a chave da Groq a resposta é instantânea e não custa nada
de espaço. A IA local só ganha em privacidade — e aqui nada sai do aparelho
além da pergunta.

**Compartilhar print pelo sistema (Android).** Estava no manifest e **eu
removi**: anunciava a capacidade e o POST caía numa rota inexistente. Exige
service worker próprio (`injectManifest`). No iOS nunca vai existir.

**Como a análise mudou.** "Esse subiu 40 posições desde a última base." Exige
guardar o veredito anterior — mudança pequena no schema.

**Hero adaptativo.** Os 8 estados da home que o protótipo especifica. Hoje ela
tem ação, resumo, atalhos e a dica; falta variar conforme o dia.

---

## Dívidas técnicas

**O CI não exercita o scanner.** Os 26 prints reais que validaram a leitura
ficam fora do repositório (são grandes e contêm arte do jogo). `TK_PRINTS`
aponta pra eles; sem a variável os testes se ignoram. É a parte mais delicada
do app e a menos coberta automaticamente.

**Não há teste de interface.** i18n e o validador de dataset têm testes; os
fluxos são verificados à mão no navegador.

**`dugtrio_normal` não é marcado como cosmético** — a entrada legada tem 2
pontos de defesa a mais, então a assinatura não bate. 1 caso em 969.

**O chunk `react` saiu com 12 KB**, menor do que deveria: o `react-dom`
provavelmente continua no principal. Não afeta o usuário.
