# Estrutura de pastas — TrainerKit

```
TrainerKit/
├── apps/web/                 # PWA (Vite + React 19)
│   ├── public/               # estáticos, dataset/, ocr/, fontes/
│   ├── src/
│   │   ├── screens/          # ecrãs e folhas
│   │   ├── ui/               # componentes partilhados
│   │   ├── ai/               # clientes IA/voz
│   │   ├── storage/          # Dexie, persistência PWA
│   │   ├── scan/             # screenshot → IV
│   │   ├── i18n/             # 10 idiomas
│   │   └── data/             # hook dataset
│   └── scripts/              # icons, ocr fetch, audit bundle
├── packages/
│   ├── core/src/             # motor TypeScript puro
│   └── dataset/src/          # ETL GAME_MASTER
├── api/                      # Vercel functions (trainerkit-ia)
├── deploy/                   # vercel-web.json
├── scripts/publicar.sh       # deploy manual
├── docs/                     # esta documentação
└── pnpm-workspace.yaml
```

Ver [COMPONENTS.md](./COMPONENTS.md) para mapa funcional.
