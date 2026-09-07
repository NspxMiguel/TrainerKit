# Índice dos prints — o que cada tela usa

Cada print está na paleta ATUAL do app (preto OLED, sem violeta de acento).
A coluna da direita diz quais classes de `componentes.css` montam aquela tela.

| print | tela | peças (classes de `componentes.css`) |
| --- | --- | --- |
| `1-inicio.png` | Início — hero full-bleed do destaque, cor vinda do TIPO da espécie, scrim por cima; CTA pílula; tira da coleção terminando em "VER MAIS"; tab bar de vidro | `.tk-t-saudacao`, `.tk-pilula--primaria`, `.tk-pilula--secundaria`, `.tk-tabbar`, `.tk-tabbar-item--ativo`, `.tk-t-legenda` |
| `2-pokedex-meus.png` | Pokédex · Meus — segmented pílula, busca pílula, cartão do Modo Pokédex logo abaixo da busca, lista com veredito à direita | `.tk-chip--*`, `.tk-cartao`, `.tk-t-titulo-tela`, `.tk-pilula` |
| `3-pokedex-todos.png` | Pokédex · Todos — grade das 1.182 espécies, tile com gradiente do tipo + monograma de 2 letras (é o desenho final, não placeholder) | `.tk-cartao`, `--tk-raio-tile` |
| `4-ficha-veredito.png` | **A tela mais importante.** Ficha: cabeçalho na cor do tipo (Dragão = violeta canônico), veredito como HERÓI em vidro, barra de confiança, rastro "POR QUÊ · 3 REGRAS" com peso em monospace, ações em pílula | `.tk-cartao--vidro`, `.tk-veredito--evoluir`, `.tk-confianca-trilha`, `.tk-confianca-preenchimento`, `.tk-pilula--primaria`, `.tk-pilula--secundaria` |
| `5-modo-pokedex.png` | Modo Pokédex — câmera escura, vermelho SÓ como acento da lente, folha de vidro subindo com waveform da voz | `.tk-vidro`, `.tk-cartao--vidro`, `.tk-pilula--primaria` |
| `6-calculadora-iv.png` | Calculadora de IV por print — valores lidos, IV grande, chip do veredito, frase curta | `.tk-cartao`, `.tk-cartao--vidro`, `.tk-chip--evoluir` |
| `7-monta-um-time.png` | Monta um time — chips de modo (ginásio/raide/liga), sexteto em grade, cartão "POR QUE ESSE TIME" | `.tk-chip`, `.tk-cartao`, `.tk-pilula--primaria` |
| `8-raide.png` | Raide de hoje — faixa de PC de captura em destaque (guardar/âmbar), counters da sua coleção | `.tk-cartao`, `.tk-chip--guardar`, `.tk-chip--investir` |
| `9-ajustes.png` | Ajustes — busca no topo, dois grupos em cartão (não pílula), ícone quadrado 28px por linha | `.tk-cartao`, `.tk-t-titulo-tela`, `--tk-raio-cartao` |
| `10-ajustes-offline.png` | Ajustes — cartão de dump offline com progresso real, lista do que baixa e estado "completo" em verde | `.tk-cartao`, `.tk-confianca-trilha`, `.tk-pilula--primaria` |

## Como ler os prints

O aparelho é 402×874 (iPhone). Os prints estão a ~55% para caber inteiros, então
**não meça pixel do print** — as medidas estão em `tokens.css` e
`padroes-de-marcacao.md`. O print serve para hierarquia, ritmo e onde entra
vidro; os arquivos CSS servem para os números.

## Onde o vidro entra (e onde não)

Entra: tab bar, folha do Modo Pokédex, cartão do veredito, busca, chips de
filtro, botão flutuante da IA, botões de fechar sobre o cabeçalho colorido.

Não entra: linhas de lista, cartões de Ajustes, tiles de espécie, cabeçalho
colorido da ficha. Vidro em tudo vira sopa — ele marca o que flutua.
