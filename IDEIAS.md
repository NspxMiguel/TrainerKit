# Ideias para as próximas sessões

Ordenadas por **quanto mudam o app**, não por facilidade. Cada uma diz o que
já existe no código, para não redescobrir.

---

## As três que eu faria primeiro

### 1. Custo até o alvo — poeira e doce

**Por que primeiro:** hoje o app manda investir sem dizer o preço. "Investir"
sem "custa 250 mil de poeira e 4 dias de caminhada" é meio conselho. O plano
original lista um `cost.ts` que **nunca foi escrito**.

Responde: *"levar esse ao 50 custa quanto?"* e *"com a poeira que eu tenho, dá
pra quantos?"*.

O que já existe: a tabela de CPM completa e `computeCPAtLevel`. Falta a tabela
de custo por nível (não está no GAME_MASTER — é client-side, como os limiares
da avaliação) e a UI.

### 2. Faxina em massa

**Por que:** é onde a coleção deixa de ser lista e vira alívio. Quem tem 2.000
Pokémon não vai abrir 2.000 telas.

Varre a coleção e devolve *"esses 23 são transferência segura"*, com seleção
múltipla e um resumo do que se ganha em doce. O veredito já classifica cada um
— falta a tela de lote e a confirmação.

⚠️ Precisa de confirmação explícita e desfazer. Transferir é irreversível no
jogo, e um app que erra aqui destrói coisa de verdade.

### 3. Comparador lado a lado

**Por que:** é a pergunta mais frequente que hoje exige abrir duas telas e
lembrar dos números. *"Invisto nesse ou naquele?"*

Dois Pokémon, os mesmos números, e um veredito comparativo. O motor de veredito
já devolve sinais com peso; comparar é confrontar dois conjuntos de sinais.

---

## Coisas boas que ficam bem depois

### Compartilhar print direto pelo sistema (Android)

Estava declarado no manifest e **eu removi**: o `share_target` anunciava a
capacidade, o Android colocava o TrainerKit na folha de compartilhar, e o POST
caía numa rota inexistente. Anunciar e falhar é pior que não anunciar.

Implementar exige service worker próprio (`injectManifest` em vez de
`generateSW`) que intercepte o POST com `event.request.formData()`. No iOS
nunca vai existir — o bug do WebKit está aberto desde 2019.

### "O que faço com meus doces"

Inverte a pergunta: em vez de *"esse presta?"*, vira *"com o que eu tenho, qual
o melhor gasto?"*. Você informa os doces por família e o app ordena as
evoluções por retorno.

### Como a análise mudou

O protótipo previa: *"esse subiu 40 posições desde a última base"*. Exige
guardar o veredito anterior junto do Pokémon — mudança pequena no schema do
Dexie, e o dataset já tem `version.batchId` para saber contra o quê comparar.

### Cobertura de tipos do time

Contra quais tipos você não tem resposta. Diz o que **caçar**, que nenhuma
outra tela faz — todas falam do que você já tem.

### Vale a pena virar lucky?

Lucky custa metade da poeira. Tem conta fechada e ninguém mostra.

### Hero adaptativo

Os 8 estados priorizados da home que o protótipo especifica. Hoje ela tem a
ação rápida e as pendências — falta variar conforme o que importa hoje
(evento ativo, dataset novo, raide do dia).

---

## Dívidas técnicas conhecidas

**`dugtrio_normal` não é marcado como cosmético.** A entrada legada tem 2
pontos de defesa a mais que a canônica, então a assinatura não bate. 1 caso em
969 pares — inofensivo, mas está registrado.

**O `react` chunk saiu com 12 KB.** Menor do que deveria; o `react-dom` provavelmente
continua no chunk principal. Não afeta o usuário, mas o *code splitting* não
está fazendo o que eu quis.

**Os prints de teste do scanner ficam fora do repositório.** Os 26 casos reais
que validaram a leitura são grandes e contêm arte do jogo. `TK_PRINTS` aponta
para eles; sem a variável, os testes se ignoram em vez de falhar. Significa que
o CI **não** exercita o scanner.

**Não há teste de interface.** A i18n e o validador de dataset têm testes, mas
os fluxos (escanear → salvar → veredito) são verificados só à mão no navegador.
