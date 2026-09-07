# TrainerKit

**A companion app for Pokémon GO that decides, instead of just showing numbers.**

There are enough calculators already. You attach the appraisal screenshot, "96.4%" shows up, and the real question is still unanswered: *so what?* Worth powering up? Worth evolving? Can I transfer it without regretting it?

TrainerKit answers that — and shows its work.

**[Open the app →](https://trainerkit-zeta.vercel.app/)**

Installable PWA, offline-first. No account, no server, nothing leaving your device.

## Install

It's a website, so there is nothing to download.

**iPhone / iPad** — open it in **Safari**, tap Share, then *Add to Home Screen*.

> On iOS this isn't optional. Safari erases the storage of any site left untouched for 7 days, and that would take your collection with it. Added to the Home Screen, it stays.

**Android** — open it in Chrome, menu ⋮, then *Install app*.

**Computer** — Chrome, Edge and Brave show an install icon in the address bar.

Follows the system's light/dark theme automatically.

## What's included

| | |
| --- | --- |
| **Appraisal scan** | The three bars are geometry, not text — the app counts filled segments and returns the **exact** IV. Not OCR, so there is no "almost right": either it read them, or it says it couldn't. Validated against 26 real screenshots, 240p to 4K. |
| **Verdict** | Power up, evolve, keep or transfer, with a one-line reason and a confidence bar that is literally how much the rules agree with each other. When two pull opposite ways it drops, as it should. |
| **The trace** | Every verdict opens into named rules with weights. The engine was built to be explainable — an app that asks you to trust it without checking is just another app. |
| **Raids** | DPS, TDO and an efficiency rating per moveset, plus the best counters **from your own collection**. If it says you need three people, you need three people. |
| **PvP** | Stat product under each league's CP cap, and best movesets per league. Labelled as what it is: stat product, not a tier list. |
| **Gyms** | Who actually holds one: defense × stamina, divided by what the type chart lets it take. |
| **Lens mode** | The device. Point the camera, hear the entry read out loud, ask questions about what's on screen. |
| **10 languages** | pt-BR, English, Spanish (Spain and LatAm), French, German, Italian, Japanese, Korean, Russian — interface, species names and move names. |

## The iOS app

The same core, the same ten languages, the same numbers — with what only a
native app can do:

- **Pokedex Mode** — the camera open, the entry read aloud by the system voice,
  and a seen counter that gives the Pokedex progress. Reading an entry needs no
  key, no account and no network. With your own key it also identifies the
  species from the camera or from a photo; the name it returns is matched
  against the dataset before any sheet opens, because a vision model invents a
  name in the same voice it uses when it is right.
- **Live Activity** — the event that is running sits on the Lock Screen and in
  the Dynamic Island, counting down. One at a time, the one ending soonest.
- **Local notifications** for events. Scheduled on device; there is no server
  and no push token anywhere in this app.
- **Liquid Glass**, and the real one: the tab bar is a `UITabBarController`
  through `NativeTabs`, so the material, the shrink-on-scroll and the transitions
  come from iOS itself. `expo-glass-effect` is used only for surfaces that are
  ours — the verdict card, the AI panel, the events happening now — never on
  everything at once.
- **Move names in both languages**, English first: it is the language move names
  circulate in, and searching a translated name finds nothing.
- **Named collections**, kept on device, each with its own verdicts.
- **Your own sources.** The app ships with no artwork and one database, and
  neither choice has to stay ours: point it at a manifest for the images, or at
  another `gamedata.json` for the numbers. The database falls back to the
  bundled one when the address fails, and validates the payload before anything
  is calculated on it.
- **Ask about the whole collection**, not one species at a time — the questions
  worth asking compare its members with each other.

Build it with `pnpm --filter @trainerkit/mobile exec expo run:ios`, or archive
with `xcodebuild`; the signing team lives in `plugins/ios-assinatura.js`, not in
your shell history.

## The math is checked against the game, not against itself

- Max CP at level 40 with perfect IVs, for species whose value is public (Machamp 3056, Dragonite 3792, Tyranitar 3834, Rhydon 3179).
- Base stats are validated through an **independent** path — the conversion the game makes from the main series (`baseStamina = floor(1.75 × HP + 50)`). Without it, an ETL bug would go unnoticed by staying internally consistent.
- Level cap is **55**, not 50. The CPM table has 55 entries and ends at `0.8653`; half levels come from a quadratic mean, not an arithmetic one.
- Raid boss CP reproduces the game's: tier 5 Mewtwo gives 54,148.

## Data

Game data comes from `alexelgt/game_masters`, which mirrors the real `GAME_MASTER` every 1–3 days. The better-known `PokeMiners` mirror is months behind — using it would have meant an app that looks fine while giving stale verdicts.

The 18.8 MB raw file is processed **in CI**, never on your phone, and ships as one compact JSON. You can also point the app at a different `gamedata.json` in Settings, so it isn't tied to me: if I stop updating, you switch the source and carry on.

[DATA.md](DATA.md) documents where each piece comes from, including what this project deliberately does not redistribute.

## Privacy

Your collection lives in your browser (IndexedDB). It is never uploaded. No analytics, no tracking cookie, no account.

Something only leaves the device when you use the AI or the voice — and the in-app privacy screen names every service and exactly what it receives. Both can be turned off, and both have an on-device option that needs no internet at all.

The app also **ships no creature artwork**. By default each species shows a badge in its type colour with two initials; images are an optional source you point at yourself.

## Requirements

- Node 22 or later
- pnpm 11

## Build from source

```bash
git clone https://github.com/NspxMiguel/TrainerKit.git   # download the source
cd TrainerKit
pnpm install                                            # install dependencies
pnpm --filter @trainerkit/dataset refresh               # download GAME_MASTER and build the dataset (~15s, needs network)
pnpm dev                                                # start the dev server on http://localhost:5273
```

The dev server also listens on the local network, so you can open it on your phone using the machine's IP — which is the only way to test the camera and the screenshot reader properly.

| Command | What it does |
| --- | --- |
| `pnpm -r test` | ~471 tests (core + web, Aug 2026) |
| `pnpm -r typecheck` | TypeScript across all three packages |
| `pnpm --filter ./apps/web build` | Production build + bundle audit |

The dataset step is separate on purpose: it hits the network and takes a while, and nothing else in the repo depends on it being fresh.

## Structure

```
packages/
├── core/                # pure TypeScript, zero DOM — every number in the app
│   ├── cp.ts               # CP formula and the CPM table (up to level 55)
│   ├── iv.ts               # IV solver: species + CP + HP + appraisal -> combinations
│   ├── scan.ts             # reads the appraisal bars off a screenshot
│   ├── verdict.ts          # the decision engine: named rules, weights, trace
│   ├── raid.ts             # DPS, TDO, efficiency rating
│   ├── pvp.ts              # stat product per league
│   ├── gym.ts              # defender bulk against the type chart
│   ├── counters.ts         # best counters from your own collection
│   └── moves.ts            # best moveset per context (raid, PvP, Rocket)
└── dataset/             # CI-only ETL: GAME_MASTER -> compact JSON + rankings
apps/
├── web/                 # the PWA (Vite + React 19)
│   └── src/ai/             # AI and voice: prompts, topic filter, quota, TTS engines
└── mobile/              # the iOS app (Expo + expo-router + NativeWind)
    ├── app/(abas)/         # the three tabs: Home, Pokedex, Settings
    ├── app/dex/            # Pokedex Mode: camera, voice, seen counter
    ├── targets/atividade/  # WidgetKit extension: the events Live Activity
    ├── modules/tk-atividade/  # ActivityKit bridge that starts and ends it
    └── plugins/            # config plugins: signing team, build flags
api/                     # Vercel edge functions (shared AI key, voice)
```

`packages/core` imports no React, no `window` and no `fetch`. It takes data and returns results — that's what makes it genuinely testable, and what lets the math survive a change of platform.

It also **writes no text**: it returns a translation key plus the numbers. The interface builds the sentence, because the interface knows the language. Ten languages, and the compiler breaks the build if one of them forgets a key.

## Not affiliated

TrainerKit is an independent fan-made app, not affiliated with, sponsored or endorsed by Scopely Explore (formerly Niantic), The Pokémon Company, Nintendo, Creatures Inc. or GAME FREAK. Pokémon, Pokémon GO and character names are trademarks of their respective owners.

It works exclusively from screenshots you provide, and **does not access, modify or communicate with the game's servers**. It is not monetised.

## License

MIT — see [LICENSE](LICENSE). The license covers this repository's code; game data and the game's names belong to their respective owners.

---

Made by [@NspxMiguel](https://github.com/NspxMiguel)

---

## Documentação

Índice completo em [`docs/INDEX.md`](docs/INDEX.md).

_Hub multi-repo: `~/Documents/Documentacao-Repos/INDEX.md` (atualizado 2026-08-31)._
