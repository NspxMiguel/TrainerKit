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

# ─────────────────────────────────────────────────────────────────────────────
# O GITHUB PAGES, que e de onde o DOMINIO le.
#
# ⚠️ SEM ESTE PASSO, PUBLICAR NAO MUDA NADA NO ENDERECO QUE ELE USA.
#
# `www.nspx.dev/TrainerKit/` nao aponta pra Vercel: quem serve e o `api/pages.js`
# do nspx-hub, que ESPELHA o GitHub Pages. E o Pages estava configurado como
# `build_type: "workflow"` — alimentado pelo Actions, que nesta conta nunca
# rodou (`status: null`). Resultado medido em 28/08/2026:
#
#   trainerkit-zeta.vercel.app       --tk-bg: #000000   (o build novo)
#   nspxmiguel.github.io/TrainerKit  index-BmKutS7l.css (build de semanas antes)
#   www.nspx.dev/TrainerKit          o mesmo build velho, porque espelha o Pages
#
# Os deploys acima sempre funcionaram; o que nao existia era a ponte pro Pages.
# Publicar dizia "no ar" e o endereco que ele abre continuava parado.
#
# ⚠️ O BASE E OUTRO. A Vercel serve na raiz (`TK_BASE=/`); no Pages o site vive
# em `/TrainerKit/`. Um base errado nao quebra o HTML — quebra os assets e o
# dataset, e a tela abre em branco. Por isso e um SEGUNDO build, e nao uma copia
# do `$PALCO`.
echo "→ Pages (o dominio espelha daqui)"
PAGES="${TMPDIR:-/tmp}/trainerkit-pages"
TK_BASE=/TrainerKit/ VITE_TK_AI_PROXY="$PROXY" pnpm --filter ./apps/web build >/dev/null

rm -rf "$PAGES"
# Worktree, e nao um clone novo: mantem o historico da branch em vez de exigir
# `push --force` a cada publicacao.
if git show-ref --verify --quiet refs/remotes/origin/gh-pages; then
  git worktree add -f "$PAGES" gh-pages >/dev/null 2>&1 ||
    git worktree add -f -B gh-pages "$PAGES" origin/gh-pages >/dev/null
else
  git worktree add -f --orphan -B gh-pages "$PAGES" >/dev/null 2>&1 ||
    git worktree add -f --detach "$PAGES" >/dev/null
fi

# Limpa tudo menos o `.git`: arquivo de build antigo que nao existe mais no novo
# ficaria servido pra sempre.
find "$PAGES" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$RAIZ/apps/web/dist/." "$PAGES/"
# O Pages roda Jekyll por padrao e ESCONDE tudo que comeca com `_`. O `assets/`
# do Vite nao comeca, mas o `_handoff/` comeca — e um `.nojekyll` custa nada e
# tira a classe inteira de surpresa.
touch "$PAGES/.nojekyll"

(
  cd "$PAGES"
  git add -A
  if git diff --cached --quiet; then
    echo "   nada mudou no Pages"
  else
    git commit -q -m "Publish $(date -u +%Y-%m-%dT%H:%MZ)"
    git push -q origin gh-pages
    echo "   Pages atualizado"
  fi
)
git worktree remove --force "$PAGES" >/dev/null 2>&1 || true

echo
echo "no ar:"
echo "  app  $APP"
echo "  api  $PROXY"
echo "  site https://www.nspx.dev/TrainerKit/"
