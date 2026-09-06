# Integrações externas — TrainerKit

## Dados do jogo

| Serviço | Uso | Onde |
| --- | --- | --- |
| [alexelgt/game_masters](https://github.com/alexelgt/game_masters) | Mirror `GAME_MASTER` | `packages/dataset` |
| URL custom | `gamedata.json` alternativo | Ajustes → `data/source.ts` |

Detalhe legal: [DATA.md](../DATA.md).

## IA (opcional)

| Serviço | Modo | Integração |
| --- | --- | --- |
| **Groq** | Chave partilhada | `api/ai.ts` ← `apps/web/src/ai/provider.ts` |
| **Groq** | Chave do utilizador | Directo do browser (`ai/groq.ts`) |
| **WebLLM** | On-device | `@mlc-ai/web-llm` em `ai/local.ts` |

Filtro de assunto: `api/_guarda.ts` + `apps/web/src/ai/guarda.ts`.

## Voz (opcional)

| Motor | Custo | Integração |
| --- | --- | --- |
| **Edge TTS** (Microsoft) | Grátis via proxy | `api/tts.ts` ← `ai/edgeTts.ts` |
| **ElevenLabs** | Quota partilhada muito baixa | `api/tts11.ts` ← `ai/elevenShared.ts` |
| **ElevenLabs** | Chave própria | `ai/elevenlabs.ts` |
| **Kokoro** | On-device (inglês fonético) | `ai/kokoro.ts` |
| **SpeechSynthesis** | Sistema | fallback em `ui/dexVoice.ts` |

Cache local de áudio: `ai/cacheAudio.ts`.

## OCR

| Biblioteca | Uso |
| --- | --- |
| **tesseract.js** | Lazy; não é o caminho principal de IV |
| Assets WASM | `scripts/fetch-ocr.ts` → `public/ocr/` |

## Hospedagem

| Plataforma | Projecto | Conteúdo |
| --- | --- | --- |
| **Vercel** | `trainerkit` | PWA estática |
| **Vercel** | `trainerkit-ia` | `api/*.ts` |
| **GitHub Pages** | repo | PWA com `TK_BASE=/<repo>/` |

## Storage local

| API | Dados |
| --- | --- |
| **IndexedDB** (Dexie) | Coleção, preferências, cache |
| **localStorage** | Quotas IA, flags de voz, setup |
| **Cache API / SW** | PWA offline |

Nenhum backend próprio para dados do utilizador — coleção não sai do dispositivo excepto quando o utilizador activa IA/voz cloud (descrito em `PrivacyScreen`).

## Rede — dependências npm relevantes

`react`, `dexie`, `tesseract.js`, `kokoro-js`, `@mlc-ai/web-llm`, `fflate`, `ws` (só servidor TTS).

## Sem integração

- Contas / login
- Analytics / tracking
- Sprites Pokémon default (badges com iniciais; imagens são opt-in URL própria)
