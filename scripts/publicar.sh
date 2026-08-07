#!/usr/bin/env bash
#
# Publica o TrainerKit na mao.
#
# ⚠️ POR QUE ISTO EXISTE, e nao um `git push` e pronto.
#
# A conta do GitHub foi sinalizada ("tomei flag do github"). As consequencias
# so apareceram quando eu fui conferir, e sao tres:
#
#   · `github.com/NspxMiguel/TrainerKit` responde 404 pra quem nao esta logado,
#     mesmo com a API autenticada dizendo que o repo e publico;
#   · o GitHub Actions NUNCA rodou — zero execucoes, com o workflow correto no
#     lugar e Actions habilitado. Como o dataset e gerado no CI, o site do
#     GitHub Pages nunca chegou a nascer (`pages.status` = null);
#   · a integracao GitHub → Vercel parou junto, no meio do dia: o ultimo deploy
#     automatico foi as 17:48, e os dez commits seguintes nao dispararam nada.
#
# Enquanto o recurso da conta nao sai, publicar e um comando local. O
# `.github/workflows/deploy.yml` continua no repositorio de proposito: quando a
# conta voltar, ele volta a funcionar sozinho e este script vira redundante.
#
# ⚠️ OS ENDERECOS MUDARAM com a conta, em 07/08/2026.
#
# A Vercel migrou junto com o GitHub: o time agora e `nspx`, e os enderecos
# antigos (`trainerkit.vercel.app`, `trainerkit-ia.vercel.app`) NAO pertencem
# mais a ele — `vercel inspect trainerkit.vercel.app` responde "Can't find the
# deployment under the context nspx". Ficaram na conta velha, servindo um build
# de meses atras pra quem abrir.
#
# Custou uma producao errada pra descobrir: este script fazia dois deploys, e o
# da RAIZ caia no MESMO projeto do app (a `.vercel/project.json` da raiz apontava
# pra `trainerkit`), virava a producao e derrubava o app. Depois de publicar, o
# endereco do app servia a landing "TrainerKit · IA". Por isso os DOIS deploys
# agora fixam o projeto pelo nome — ver a nota do `vercel link` mais abaixo.
#
# Uso:  pnpm publicar
set -euo pipefail

cd "$(dirname "$0")/.."
RAIZ="$PWD"
PALCO="${TMPDIR:-/tmp}/trainerkit-publicar"

# ⚠️ O `-gules` NAO E ENFEITE, e trocar por `trainerkit-ia-nspx.vercel.app`
# quebra o app em silencio.
#
# A Vercel da tres enderecos a cada projeto. O `<projeto>-<time>` cai atras da
# Deployment Protection e responde 401 "Protected deployment" pra quem nao esta
# logado — medido. O publico e este, o do sufixo sorteado no dia em que o
# projeto nasceu. Como ele vai gravado DENTRO do build do app, um 401 aqui nao
# apareceria no deploy: apareceria em cada pedido de IA do usuario.
APP="https://trainerkit-zeta.vercel.app"
API="https://trainerkit-ia-gules.vercel.app"
PROXY="$API/api/ai"

echo "→ dataset do dia (baixa o GAME_MASTER, ~18 MB)"
pnpm --filter @trainerkit/dataset refresh

# Na ordem do CI, e pelo mesmo motivo: os testes conferem a matematica contra o
# dataset REAL. Rodar antes de gerar quebraria por arquivo ausente, e testar um
# dataset diferente do que vai ao ar nao provaria nada sobre o que foi publicado.
echo "→ tipos e testes"
pnpm -r typecheck
pnpm -r test

echo "→ build do app (base na raiz, nao em /TrainerKit/)"
TK_BASE=/ VITE_TK_AI_PROXY="$PROXY" pnpm --filter ./apps/web build

echo "→ palco: dist + a configuracao de hospedagem"
rm -rf "$PALCO"
mkdir -p "$PALCO"
cp -R "$RAIZ/apps/web/dist/." "$PALCO/"
cp "$RAIZ/deploy/vercel-web.json" "$PALCO/vercel.json"

# ⚠️ VINCULAR ANTES DE PUBLICAR, e este passo nao e burocracia.
#
# Sem ele, `vercel deploy --yes` num diretorio sem vinculo nao pergunta nada:
# cria um projeto NOVO com o nome da pasta. Foi o que aconteceu na primeira vez
# que rodei isto — nasceu um "trainerkit-publicar" e o `trainerkit.vercel.app`
# continuou servindo o build anterior. O deploy dizia "ready" e o site nao
# mudava, que e o pior tipo de sucesso.
#
# `--project` fixa o destino pelo NOME, entao nao ha id de projeto copiado pra
# dentro do repositorio pra ficar velho.
echo "→ vinculando o palco ao projeto trainerkit"
(cd "$PALCO" && vercel link --project trainerkit --yes >/dev/null)

echo "→ app  → $APP"
(cd "$PALCO" && vercel deploy --prod --yes)

# As funcoes moram no outro projeto, com as chaves nos cofres dele. Publicar da
# RAIZ usa o `vercel.json` de la, que serve `public-vercel/` e o `api/`.
#
# ⚠️ O `link` AQUI E O CONSERTO, e nao burocracia repetida.
#
# A `.vercel/` e ignorada pelo git, entao o vinculo da raiz depende de o que
# rodou antes nesta maquina — e numa maquina onde a raiz estivesse vinculada ao
# projeto do APP, este deploy viraria a producao DELE e derrubaria o que a linha
# de cima acabou de publicar. Foi exatamente o que aconteceu em 07/08/2026.
# Fixar o projeto pelo nome tira a pergunta: nao importa como a pasta esta
# vinculada, a API vai pra API.
echo "→ API  → $API"
(cd "$RAIZ" && vercel link --project trainerkit-ia --yes >/dev/null && vercel deploy --prod --yes)

echo
echo "no ar:"
echo "  app  $APP"
echo "  api  $PROXY"
