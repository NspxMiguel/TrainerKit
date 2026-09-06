# O handoff de design, e o que dele ainda vale

Arquivos: `~/Downloads/design_handoff_trainerkit_redesign 2/` — Mockup,
Redesign, Desktop e Animacoes, em `.dc.html` do Claude Design.

## ⚠️ A PALETA DELE ESTA SUPERADA, e seguir seria desfazer trabalho

Medido nos arquivos (contagem de ocorrencia de cada hex):

    #9F8BFF  68   violeta
    #5B3DF5  52   violeta
    #6E4BFF  45   violeta
    #8A6BFF  39   violeta
    #0A0C10  25   o fundo azul-marinho

Esse e o desenho de ANTES de 28/08/2026, quando ele pediu "black oled" e
"tira esse tanto de roxo pelo amor". O app web ja saiu do violeta e do
`#0A0C10`; o nativo nasceu preto. Puxar a paleta do handoff traria os dois
de volta.

## O que dele CONTINUA valendo, e foi adotado

| do handoff | onde esta no app |
| --- | --- |
| `#F4F6FA` (172 usos) — a tinta principal | `texto` no `tailwind.config.js` |
| `#3DDC97` — o verde de "investir" | `investir` |
| `#22262F`, `#14171E`, `#33394A` — cinzas neutros | base do `superficie` |
| `border-radius: 999px` (345 usos) — pilula e a forma padrao | botoes e selos |
| `20px` / `28px` — cartao | `rounded-2xl` / `rounded-3xl` |
| `-apple-system` — tipografia do sistema | padrao do RN |

## Conclusao

O handoff decide FORMA (pilula, raio, ritmo, tipografia) e o app decide COR,
porque a cor mudou depois dele por pedido direto. Registrado aqui pra ninguem
"corrigir" o app de volta pro violeta achando que esta seguindo o desenho.


## 06/09/2026 — o zip é o mesmo pacote

Ele mandou `~/Downloads/Liquid Glass Pokédex Design.zip` dizendo *"nao ta com a
ultima versao do app, mas melhor doq recriar do 0"*. Ele descompacta para
`design_handoff_trainerkit_redesign/`, e os **oito arquivos têm md5 idêntico** ao
`design_handoff_trainerkit_redesign 2/` que já tinha sido lido — não há nada novo
nele para analisar de novo.

E a intuição dele estava certa pelo motivo exato: *"tirar o roxo de todo canto
ainda falta"*. O roxo **é do pacote** — 204 usos de violeta, `#0A0C10` de fundo.
Ou seja, o que este documento já dizia (a FORMA vale, a COR não) é a mesma coisa
que ele percebeu olhando: usar o pacote inteiro devolveria o roxo que ele mandou
tirar duas vezes.
