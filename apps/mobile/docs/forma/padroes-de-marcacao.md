# Padrões de marcação — como montar cada peça com `componentes.css`

Isso é **HTML de referência**, não JSX pronto — troque a tag pelo componente
RN/expo equivalente (`View`, `Text`, `GlassView`) mantendo as mesmas classes/
tokens. Cor sempre vem de `rgb(var(--tk-*))` do `global.css` real do app —
nenhuma classe aqui carrega hex.

## Tab bar (vidro flutuante, bolha que transborda)

```html
<div class="tk-tabbar">
  <div class="tk-tabbar-item">Início</div>
  <div class="tk-tabbar-item tk-tabbar-item--ativo">Espécies</div>
  <div class="tk-tabbar-item">Ajustes</div>
</div>
```

No `GlassView` do iOS 26: `glassEffectStyle="regular"`, `isInteractive`, e o
item ativo troca `tintColor` para `rgba(evoluir, .16)` — mesma proporção que
`.tk-tabbar-item--ativo` usa aqui.

## Veredito — o herói da ficha

```html
<div class="tk-cartao--vidro tk-anim-entrar">
  <span class="tk-veredito tk-veredito--evoluir">✦ EVOLUIR</span>
  <p class="tk-t-corpo">Ele ainda evolui — e evoluir muda tudo.</p>
  <div class="tk-t-legenda" style="display:flex;justify-content:space-between">
    <span>AS REGRAS CONCORDAM</span><span style="color:rgb(var(--tk-evoluir))">86%</span>
  </div>
  <div class="tk-confianca-trilha"><div class="tk-confianca-preenchimento" style="width:86%"></div></div>
</div>
```

Regra: o veredito nunca fica dentro de um cartão igual aos outros da tela —
é sempre o primeiro elemento, sempre `tk-cartao--vidro`, sempre com o glifo
(nunca cor sozinha, por daltonismo).

## Chip de lista (Pokédex · Meus)

```html
<span class="tk-chip tk-chip--investir">↑ INVESTIR</span>
```

## Botão de ação (pílula) vs. cartão (nunca confundir os dois)

```html
<div class="tk-pilula tk-pilula--primaria">Evoluir agora</div>
<div class="tk-pilula tk-pilula--secundaria">Guardar</div>

<div class="tk-cartao">
  <div class="tk-t-titulo-cartao">Detalhes</div>
  <div class="tk-t-corpo">PC 2.874 · IV 96% · Nível 31</div>
</div>
```

Pílula (`border-radius: 999px`) é reservada para **controle de ação e
navegação** — botão, chip, tab, segmented. Cartão (`20/26/28px`) é para
**superfície de conteúdo** — lista, ficha, painel. O app hoje usa raio de
cartão em quase tudo; essa é a distinção que estava faltando.

## Escala tipográfica por papel

```html
<div class="tk-t-saudacao">Boa noite, Miguel.</div>
<div class="tk-t-titulo-tela">Espécies</div>
<div class="tk-t-titulo-cartao">Garchomp</div>
<div class="tk-t-corpo">IV 96 · PC 2.874 · nível 31</div>
<div class="tk-t-legenda">SUA COLEÇÃO</div>
```

## Entrada de tela/folha

```html
<div class="tk-anim-entrar">…conteúdo da tela…</div>
```
`--tk-dur-sheet` (440ms) para folha inteira, `--tk-dur-base` (300ms) para
troca de conteúdo dentro da mesma tela, `--tk-dur-exit` (180ms) para saída —
sempre mais rápida que a entrada.
