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
