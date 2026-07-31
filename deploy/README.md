# `deploy/vercel-web.json`

A configuração de hospedagem do PWA. Ela é copiada para o palco pelo
`scripts/publicar.sh` e vira o `vercel.json` do deploy.

**JSON não aceita comentário, e a Vercel rejeita o truque das chaves `//`**
(`Invalid vercel.json - should NOT have additional property "//"`). Por isso o
raciocínio mora aqui, e não lá dentro.

## Os cabeçalhos de segurança

Antes deles o app publicado tinha exatamente **um**: `strict-transport-security`.
Um PWA que abre a **câmera** e guarda **chave de API** no `localStorage`,
emoldurável em qualquer `<iframe>` do mundo.

| Cabeçalho | Por quê |
|---|---|
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | Clickjacking. Ninguém embute o app numa página que finge ser outra coisa. |
| `object-src 'none'`, `base-uri 'none'` | Fecham dois vetores clássicos de injeção sem afetar nada que o app usa. |
| `form-action 'self'` | O app não posta formulário para lugar nenhum. |
| `X-Content-Type-Options: nosniff` | No app **e** nas respostas JSON da API. |
| `Referrer-Policy: no-referrer` | O app linka para `console.groq.com` e `elevenlabs.io`. Sem isto, o `Referer` entrega de qual tela do TrainerKit a pessoa saiu. |
| `Permissions-Policy` | `camera=(self)` porque o Modo Pokédex aponta para o Pokémon. Todo o resto negado — nada aqui usa microfone, GPS ou pagamento, e negar é de graça. |

## ⚠️ O que NÃO está aqui, e é decisão e não esquecimento

**`connect-src` não existe.** O app deixa a pessoa apontar uma **fonte de dados**
e uma **fonte de sprites** próprias, em qualquer URL — é recurso, não acidente.
Uma lista fixa de origens mataria isso em silêncio, que é a pior forma de
quebrar: continua parecendo que funciona.

**`script-src` não existe.** O app carrega **WebAssembly** (voz e IA rodando no
aparelho), o que exigiria `wasm-unsafe-eval` e um teste de verdade em cada
motor — Kokoro, WebLLM, ONNX — antes de ir ao ar. Um CSP que quebra a voz é
pior que a lacuna.

Prefiro a lacuna declarada aqui do que um CSP decorativo que ninguém testou.

## Cache

`assets/` é imutável (o nome tem hash), `dataset/` vive uma hora, e
`index.html` e `sw.js` **nunca** ficam em cache — senão a atualização nunca
chega em quem já abriu o app uma vez.
