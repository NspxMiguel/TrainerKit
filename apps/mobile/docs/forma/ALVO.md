# O alvo visual — lido dos prints, não do CSS

Os 10 prints em `prints/` são o app do Claude Design rodando. Eles são o alvo.
`mockup-navegavel/TrainerKit Mockup.dc.html` (80 KB) é o mockup navegável, para
abrir no navegador e clicar. `prints/INDICE.md` diz que classe monta cada tela.

⚠️ **Nunca mais recriar isso em HTML meu.** O preview que eu montei em
`/tmp/forma-preview` era CSS dele em marcação minha, e saiu feio — não
representa o pacote. O que existe já está pronto.

## 1-inicio.png — o que a tela tem, de cima para baixo

1. `Boa noite, Miguel.` (saudação, 34px/800) + avatar redondo com inicial, à direita
2. **Herói full-bleed** — gradiente na cor do TIPO da espécie (Charizard = laranja
   fogo), monograma gigante de 2 letras (`CH`) como marca d'água atrás, scrim por cima
3. Pílula-etiqueta `DESTAQUE DE HOJE` (legenda, 11px/700, tracking .08em)
4. Nome grande (`Charizard`)
5. Linha de contexto: `Fogo · Voador · IV 93 — vale cada grama de poeira hoje.`
6. Pílula branca `↑ Investir — ver a conta` + botão circular de check ao lado
7. Pontinhos de carrossel (há mais de um destaque)
8. Pílula azul largura cheia: `Escanear um print` (com sombra CTA)
9. Duas pílulas secundárias lado a lado: `Monta um time` / `Ginásio`
10. Legendas `SUA COLEÇÃO` (esq) e `4 PEDEM DECISÃO` (dir, em azul)
11. Tira horizontal de avatares circulares — monograma de 2 letras sobre gradiente
    do tipo, rótulo do veredito embaixo (EVOLUIR/INVESTIR/GUARDAR/TRANSFERIR),
    terminando em `VER MAIS`
12. **Tab bar de vidro flutuante**: Início (ativo, bolha) · Pokédex · Ajustes

## 4-ficha-veredito.png — a tela mais importante

1. **Cabeçalho na cor do tipo** (Garchomp/Dragão = violeta canônico — isso NÃO é o
   violeta de marca que ele mandou tirar, é a cor do tipo e pode ficar), monograma
   `GA` gigante como marca d'água, nome + chips de tipo (`Dragão` `Terra`),
   botão `×` circular de vidro no canto
2. **Veredito como herói, em vidro**: `✦ EVOLUIR` na cor do veredito, corpo
   explicando em uma frase, e embaixo `AS REGRAS CONCORDAM` + `88%` com barra de
   confiança preenchida na cor do veredito
3. Cartão `POR QUÊ · 3 REGRAS` com link `Ocultar` à direita; uma linha por regra,
   peso em monospace colorido à direita (`+42`, `+31`, `−8`)
4. Linha de números seca: `PC 2.874 · IV 96% · Nível 31 · Doces 37`
5. Pílula primária azul com brilho `Evoluir agora` + pílula escura `Guardar`
6. Botão flutuante `+` (vidro, circular) no canto inferior direito — é a IA

## O que separa isso do app de hoje, e não é CSS

- **não existe tab bar** no nativo: é uma pilha do expo-router com voltar
- **não existe tela de Início** com saudação, herói e tira da coleção
- **não existe monograma de 2 letras** sobre gradiente do tipo
- **não existe barra de confiança** nem o cartão POR QUÊ com pesos
- **não existe botão flutuante da IA**

Ou seja: a diferença é ESTRUTURA de navegação e componentes que faltam, não
tinta. Trocar cor e raio no que já existe nunca vai chegar aqui.
