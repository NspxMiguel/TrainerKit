# Checklist de revisão pós-import da interface nova

O Miguel vai importar a interface do `design_handoff_trainerkit_redesign` por
conta própria. Este arquivo existe para a revisão que vem **depois**: é a lista
do que o app faz hoje e que um redesenho de UI tende a levar junto sem querer.

**Como usar:** para cada item, reproduza o "como conferir". Se falhar, a função
sumiu na troca e precisa voltar.

**De onde isto saiu:** o código tem **393 avisos `⚠️`** e **90 falas do Miguel
citadas em comentário**. Quase todo item aqui é uma correção que já custou uma
rodada — a fala é a prova de que alguém tropeçou nela antes.

> Nota de método: cada `⚠️` no código marca uma armadilha real. Se o arquivo que
> tinha o aviso for reescrito, o aviso vai junto — e a armadilha volta a estar
> armada, sem nada na tela avisando. Por isso a coluna "por quê" abaixo cita a
> fala original em vez de resumir.

---

## 1. Ficha da espécie — `screens/SpeciesDetail.tsx`

A tela mais visitada, e a que concentra 12 avisos. Quatro deles são bugs que já
aconteceram com o app publicado.

| O que | Por quê (fala original) | Como conferir |
|---|---|---|
| A espécie **segue o Pokémon salvo**, não a foto de quando a tela abriu | *"cliquei em evoluir e o bulbasauro n foi, ja fiz e n foi."* Sem isso, evoluir mantinha a tela em "Bulbasaur" com o botão armado, e o toque seguinte pulava o Ivysaur direto pro Venusaur | Salve um Bulbasaur, evolua pela ficha. A ficha tem de virar Ivysaur e o botão oferecer o passo seguinte |
| Acha o salvo **mesmo sem receber `owned`** | *"ele duplico e tem 2 venusaur agr."* Abrindo pela Pokédex, o app agia como se você não tivesse o bicho e oferecia "Salvar", criando uma segunda linha | Tenha um Venusaur salvo, abra Venusaur **pela Pokédex**. Tem de mostrar o veredito, não "Eu tenho esse" |
| A busca por espécie passa pelo **canônico** | O da coleção pode ser `venusaur_normal` e a Pokédex abre `venusaur` — mesmo bicho, duas escritas | idem acima, com uma forma cosmética |
| `ivDesconhecido` chega ao `VerdictCard` | Sem isso a ficha dizia *"Transferir · IV 0 de 45 · confiança 65%"* pra quem só marcou "eu tenho esse" | Marque "Eu tenho esse" sem escanear. Tem de dizer "Falta o IV pra eu decidir" |

## 2. Faxina — `screens/Faxina.tsx`

| O que | Por quê | Como conferir |
|---|---|---|
| **O app não transfere nada** | Não fala com o jogo e não tem como. O botão diz "tirar da lista", não "transferir", e a confirmação explica a ordem: primeiro no jogo, depois aqui | O texto do botão e da confirmação continuam dizendo isso |
| Só os **"sem dúvida"** nascem marcados | É a regra de projeto da tela inteira: "sem dúvida" é o duplicado que perde pro irmão em todos os critérios, e dá pra conferir item a item | Abra a faxina: os explicados nascem **desmarcados** |
| Semeadura pela **assinatura do conjunto** | Corrida real ao desfazer: os Pokémon voltavam todos desmarcados e a barra de ação sumia | Remova, depois desfaça. Eles têm de voltar **marcados** |
| A lista dos **guardados com motivo** | Uma faxina que não deixa auditar o que ficou de fora se usa uma vez só | A seção dos guardados continua lá, com o motivo de cada um |

## 3. Calculadora de IV — `screens/IVCalculator.tsx`

| O que | Por quê | Como conferir |
|---|---|---|
| Número lido **só entra se a matemática confirmar** | Em print de mockup o leitor devolveu "10" pra um PC de quatro dígitos. Com o IV das barras, PC e PS sobredeterminam o nível: se nenhum nível produz o par, um dos dois foi lido errado | Anexe um print de tela de PC. Tem de recusar os números, não aceitá-los |
| O teto aqui é o **observável**, não o de power-up | Usar o de power-up recusaria o print de um Melhor Amigo, que é legítimo e está um nível acima do que se pode comprar | Print de Melhor Amigo continua sendo aceito |

## 4. Início — `screens/HomeScreen.tsx`

| O que | Por quê | Como conferir |
|---|---|---|
| O guarda de "sem IV" mora no `decide()`, não na tela | Estava na tela e por isso a home e a ficha discordavam sobre o mesmo bicho | Home e ficha dizem a **mesma coisa** do mesmo Pokémon |
| Em "Evoluir" o botão **não é um check** | O rótulo e o desenho têm de combinar com a ação | O botão de "já fiz isso" muda conforme o veredito |
| A lista de destaques vem do **core**, não é literal da tela | Era um literal aqui e dessincronizou | — |

## 5. Pokédex e coleção

| O que | Por quê | Como conferir |
|---|---|---|
| Segmentado **com a contagem** — `Todos · 1.182 / Meus · 247` | É o handoff, e a contagem responde antes de a pessoa tocar | Os dois lados mostram número |
| Filtro **com a palavra**, não só o ícone | — | O botão de filtro tem texto |
| Coleção **embutida** na Pokédex não tem título próprio | Dois títulos ("Pokédex" e "Coleção") é a redundância que ele vinha cobrando | Aba Pokédex → "Meus": um título só |
| Em "Guardar" o veredito **volta a ser etiqueta e não some** | — | Um Pokémon com veredito "Guardar" continua mostrando a etiqueta |
| O vermelho do cartão do Modo Pokédex é **do aparelho**, não do app | É o único lugar que não segue a cor da espécie, de propósito: anuncia um objeto | O cartão continua vermelho mesmo com espécie de outro tipo em destaque |

## 6. Modo Pokédex — `screens/DexMode.tsx`

| O que | Por quê | Como conferir |
|---|---|---|
| **Não existe no desktop** | O handoff novo concorda: não há câmera no PC. Já implementado, gate em `detectPlatform() !== "desktop"` | Numa janela de PC, o cartão não aparece na Pokédex |
| `data-skin="plain"`, não `"device"` | O desenho do aparelho é propriedade da Nintendo/TPC — a casca saiu por isso, não por gosto | Não desenhe carcaça de Pokédex |
| A **categoria abre a locução** | É a assinatura do aparelho da série | A voz começa pela categoria da espécie |

## 7. Privacidade — `screens/PrivacyScreen.tsx`

⚠️ **Este é o mais perigoso da lista.** É uma política, não um texto decorativo.

| O que | Por quê |
|---|---|
| Se mudar o que sai do aparelho, **este texto muda junto** | A tela promete por escrito o que sai e o que não sai |
| A **foto** manda a imagem pra fora, e isso está declarado | *"Quase passou batido"* — identificar Pokémon por foto manda a imagem |
| As **imagens** estavam faltando na lista e a frase dizia "só a IA" | Já foi corrigido uma vez |

**Como conferir:** leia a tela e compare com o que o app realmente faz. Se a
interface nova mudar qualquer caminho de rede, a tela tem de acompanhar.

## 8. Ajustes e outros

| O que | Por quê |
|---|---|
| Renomear coleção com **campo próprio**, não `prompt()` | `prompt()` é diálogo de navegador no meio de um app |
| Feedback é **`mailto:`**, não formulário | Formulário exigiria servidor — e o app promete não ter |
| O e-mail no feedback é **botão de copiar**, não texto | — |
| "Ajude o projeto" **saiu**: *"tire o ajude o projeto"* | Não reintroduza |

---

## Trilhos automáticos — rode antes de fechar qualquer tela

Estes quebram o build sozinhos e valem mais que qualquer item acima:

```bash
pnpm -r typecheck && pnpm -r test
```

- **`styles/contraste.test.ts`** — nada abaixo de 4,5:1 nos dois temas. Os tokens
  do README **reprovam** aqui: `--tk-text-3` a `.45` dá 4,05:1 no escuro e
  2,87:1 no claro, e o topo `#8a6bff` do `--tk-ultra` reprova com texto branco.
  O código já desvia disso de propósito — **não "corrija" de volta pro README.**
- **`scripts/audit-bundle.ts`** — quebra o build se arte de terceiro entrar.
- **O tipo `Dict`** (`i18n/dict/en.ts`) — um idioma sem uma chave **não compila**.
  São 10. Chave nova = 10 edições, sempre.
- **`i18n.test.ts`** — pega idioma no seletor sem dicionário e idioma que só
  copiou o inglês.

## O que foi feito em 03/08 e é fácil de perder na troca

Tudo isto é recente e não está no pacote de design:

1. **Passo de idioma no setup**, como primeiro passo, e `detect()` lendo a fila
   inteira de `navigator.languages`. *"no setup nao pediu idioma... sou do brasil
   e puxo ingles pra mim"*
2. **Nível do treinador** alimentando `levelCap = min(nível+2, teto do jogo)` em
   dez pontos de veredito. Confira: nível 20 tem de dizer "Até 700 de PC no nível
   22", não "1.260 no nível 50"
3. **Cartão de offline** em Ajustes → Armazenamento, que **mede** o
   `CacheStorage` em vez de fingir progresso
4. **Barra de abas alinhada à coluna de conteúdo** em janela de PC (a superfície
   é full-bleed, os itens param onde o texto para)
5. **Escurecimento atrás das folhas** no desktop, com a barra lateral visível
6. **Hover e barra de rolagem** para quem tem ponteiro
7. **A barra some durante o setup** (`.tk-onb` é z-index 20, a barra é 50)
8. O **✓ da lista de escolha** só aparece na linha marcada

---

## O que o desktop novo pede e o app ainda não tem

Do `TrainerKit Desktop.dc.html`, que chegou nesta rodada:

- **FERRAMENTAS na sidebar** — acesso direto a Calculadora de IV, Raide e Montar
  time. Hoje as três só abrem de dentro de uma ficha
- **Pokédex em lista + ficha lado a lado** (`1.3fr 1fr`), como cliente de e-mail.
  Hoje a ficha é uma folha por cima
- **Indicador "MODO OFFLINE"** na sidebar
- **Poeira estelar** nas estatísticas da home — o app não guarda esse dado hoje
- **Data por extenso** na saudação ("Quarta, 30 de julho · 4 decisões esperam
  você"). Hoje é só a saudação e o nome
