# ADR 002 — Proxy Vercel para chaves de IA/TTS

**Estado:** aceite  
**Data:** documentado 2026-08-31 (código em `api/`, comentários extensos)

## Contexto

Groq e ElevenLabs exigem chaves secretas. Qualquer chave no bundle Vite é extraível no DevTools em segundos.

## Decisão

1. Projecto Vercel **separado** (`trainerkit-ia`) com handlers em `api/`
2. Variáveis `GROQ_API_KEY`, `ELEVENLABS_API_KEY` só no servidor
3. Build injecta URLs públicas via `VITE_TK_*_PROXY` (defaults no código)
4. Sem proxy configurado → opção “grátis” não aparece; app offline-first continua

Camadas de abuso: allowlist de modelos/vozes, limites de tamanho, rate limit IP, `filtrarConteudo()`, system prompts sanduíche.

## Consequências

- Dois deploys no `publicar.sh`
- CORS `*` nos endpoints (sem sessão)
- IA/voz on-device (WebLLM, Kokoro, SpeechSynthesis) permanecem sem servidor

## Alternativas rejeitadas

- Chave Groq no cliente — inaceitável para chave partilhada
- Um único projecto Vercel — mistura estático + Node/Edge com configs diferentes
