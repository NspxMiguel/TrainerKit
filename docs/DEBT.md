# Dívida técnica — TrainerKit

_Varredura e revisão manual, 2026-08-31._

## Lacunas de produto / infra

| Item | Detalhe |
| --- | --- |
| Rate limit por IP | Contadores em memória (`api/ai.ts`, `api/tts.ts`); comentários apontam Vercel KV / Upstash para limite persistente |
| GitHub Actions | `.github/workflows/deploy.yml` preparado mas historically inactivo na conta |
| Domínios legados | `trainerkit.vercel.app`, `trainerkit-ia.vercel.app` na conta antiga vs `-zeta`/`-gules` actuais |
| CSP incompleto | Sem `connect-src`/`script-src` de propósito — ver `deploy/README.md` |
| Chromium Edge TTS | `CHROMIUM` em `api/tts.ts` expira; 403 quando desactualizado |

## Código — notas reais (não são TODOs de grep)

| Área | Nota |
| --- | --- |
| `api/_guarda.ts` | Filtro regex burlável; defesa real = quota + arquitectura sem tools |
| `apps/web/src/ai/quota.ts` | Cota diária Groq partilhada é global à org |
| `packages/dataset` | Sem testes unitários; depende do core |

## Documentação STALE (raiz e README)

| Ficheiro | Problema |
| --- | --- |
| [README.md](../README.md) | Link `https://trainerkit.vercel.app/` — domínio antigo; usar `trainerkit-zeta.vercel.app` |
| [README.md](../README.md) | “209 tests” — actual: ~471 (240 core + 231 web, Aug 2026) |
| [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) | `VITE_TK_AI_PROXY` aponta `trainerkit-ia.vercel.app` sem sufixo `-gules` |
| [docs/ARCHITECTURE.md](./ARCHITECTURE.md) (geração anterior) | Diagrama só de pastas raiz; substituído nesta revisão |
| [docs/API.md](./API.md) (geração anterior) | Listava headers HTTP como “rotas”; substituído |
| [docs/DEBT.md](./DEBT.md) (geração anterior) | Falsos positivos “TODO” em comentários PT (“todo mundo”, “todo dia”) |
| [IDEIAS.md](../IDEIAS.md) | Brainstorm — não reflecte estado actual |
| [PEDIDOS.md](../PEDIDOS.md) | Backlog informal — validar item a item |

## Documentação actualizada nesta revisão

`INDEX`, `ARCHITECTURE`, `SETUP`, `DEVELOPMENT`, `DEPLOY`, `API`, `COMPONENTS`, `INTEGRATIONS`, `DEBT`, `adr/*`

## Ainda válidos (não marcar STALE)

- [DATA.md](../DATA.md) — procedência de dados, alinhado com `audit-bundle.ts`
- [deploy/README.md](../deploy/README.md) — cabeçalhos Vercel
- [LICENSE](../LICENSE)

## Sem ficheiro no repo

- `SECURITY.md` — não existe
- `.env.example` — não versionado (só `.env.local` local)
