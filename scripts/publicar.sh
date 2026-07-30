#!/usr/bin/env bash
#
# Publica o TrainerKit na mao.
#
# ⚠️ POR QUE ISTO EXISTE, e nao um `git push` e pronto.
#
# A conta do GitHub foi sinalizada ("tomei flag do github"). As consequencias
# so apareceram quando eu fui conferir, e sao tres:
#
#   · `github.com/spxmiguel/TrainerKit` responde 404 pra quem nao esta logado,
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
# Uso:  pnpm publicar
set -euo pipefail

cd "$(dirname "$0")/.."
RAIZ="$PWD"
PALCO="${TMPDIR:-/tmp}/trainerkit-publicar"

PROXY="https://trainerkit-ia.vercel.app/api/ai"

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

echo "→ app  → trainerkit.vercel.app"
(cd "$PALCO" && vercel deploy --prod --yes)

# As funcoes moram no outro projeto, com as chaves nos cofres dele. Publicar da
# RAIZ usa o `vercel.json` de la, que serve `public-vercel/` e o `api/`.
echo "→ API  → trainerkit-ia.vercel.app"
(cd "$RAIZ" && vercel deploy --prod --yes)

echo
echo "no ar:"
echo "  app  https://trainerkit.vercel.app"
echo "  api  https://trainerkit-ia.vercel.app/api/ai"
