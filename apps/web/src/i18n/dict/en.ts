import type { MessageKey } from "@trainerkit/core";

/**
 * O dicionario ingles — a FONTE das chaves, nao mais uma traducao.
 *
 * O tipo `Dict` sai daqui, entao um idioma que esqueca uma chave nao compila e
 * uma chave que ninguem mais usa vira erro de tipo nos outros dicionarios. A
 * intersecao com `Record<MessageKey, string>` fecha o cerco pelo outro lado: se
 * o core criar uma mensagem nova e ninguem traduzir, o build quebra aqui.
 *
 * `{nome}` interpola. Numeros ja chegam formatados no idioma certo.
 */
const EN = {
  // ------------------------------------------------------------------ navegacao
  "nav.home": "Home",
  "nav.pokedex": "Pokédex",
  "nav.collection": "Collection",
  "nav.settings": "Settings",
  "nav.aria": "Main navigation",

  // ---------------------------------------------------------------------- comum
  "common.back": "Back",
  "common.close": "Close",
  "common.loading": "Loading…",
  "common.loadingGameData": "Loading game data…",
  "common.cancel": "Cancel",
  "common.remove": "Remove {name}",
  "common.optional": "(optional)",
  "common.level": "level",
  "common.cp": "CP",
  "common.hp": "HP",
  "common.attack": "Attack",
  "common.defense": "Defense",
  "common.stamina": "HP",
  "common.beta": "BETA",

  // ---------------------------------------------------------------------- acoes
  "action.invest": "Power up",
  "action.evolve": "Evolve",
  "action.keep": "Keep",
  "action.transfer": "Transfer",

  // ----------------------------------------------------------------------- home
  "home.greeting.night": "Good evening",
  "home.greeting.morning": "Good morning",
  "home.greeting.afternoon": "Good afternoon",
  "home.greeting.lateNight": "Up late",
  "home.trainer": "Trainer",
  "home.gameData": "Game data",
  "home.species": "species",
  "home.moves": "moves",
  "home.maxLevel": "max level",
  "home.datasetLine": "Data from {date} · works offline",
  "home.yourCollection": "Your collection",
  "home.empty.title": "Start with your first",
  "home.empty.body": "Nothing saved yet. Takes less than 10 seconds.",
  "home.nothingPending.one": "1 Pokémon saved, nothing pending",
  "home.nothingPending.many": "{count} Pokémon saved, nothing pending",
  "home.needsDecision.one": "1 needs a decision",
  "home.needsDecision.many": "{count} need a decision",
  "home.ofSaved.one": "of {count} saved",
  "home.ofSaved.many": "of {count} saved",
  "home.andMore": "and {count} more under Collection.",
  "home.datasetError.title": "Couldn't load the dataset",
  "home.datasetError.body": "Without it the app can't calculate anything. {message}",
  "home.atRisk.title": "Your data can be wiped",
  "home.atRisk.body":
    "The browser hasn't guaranteed storage yet. Keep an exported backup to be safe.",

  // ----------------------------------------------------------------- instalacao
  "install.banner.title": "Add to Home Screen",
  "install.banner.body": "Opens full screen, works offline and keeps your data saved.",
  "install.banner.urgentTitle": "Install so you don't lose your collection",
  "install.banner.urgentBody":
    "Safari wipes data from sites untouched for 7 days. Installed, TrainerKit is protected.",
  "install.banner.how": "How to install",
  "install.banner.later": "Not now",
  "install.ios.title": "Install on iPhone",
  "install.ios.browser": "It has to be Safari — on iPhone only Safari can install.",
  "install.ios.step1": "Tap the Share button in the bottom bar.",
  "install.ios.step2": "Scroll the list and tap “Add to Home Screen”.",
  "install.ios.step3": "Tap “Add”, top right.",
  "install.ios.step4": "Done. Open TrainerKit from the icon, not from Safari.",
  "install.android.title": "Install on Android",
  "install.android.browser": "Works in Chrome, Edge, Opera or Samsung Internet.",
  "install.android.step1": "Tap the three-dot menu, top right.",
  "install.android.step2": "Tap “Install app” or “Add to Home screen”.",
  "install.android.step3": "Confirm with “Install”.",
  "install.android.step4": "Done. TrainerKit becomes an app in your drawer.",
  "install.desktop.title": "Install on desktop",
  "install.desktop.browser": "Works in Chrome, Edge or Brave.",
  "install.desktop.step1": "Click the install icon in the address bar.",
  "install.desktop.step2": "Confirm with “Install”.",
  "install.why.iosImportant": "Safari wipes data after 7 days idle. Installed, it stops.",
  "install.now": "Install now",

  // -------------------------------------------------------------------- pokedex
  "pokedex.title": "Pokédex",
  "pokedex.loadError": "Couldn't load the dataset. {message}",
  "pokedex.search": "Search species",
  "pokedex.searchPlaceholder": "Search by name",
  "pokedex.count.one": "1 species",
  "pokedex.count.many": "{count} species",
  "pokedex.noResults": "Nothing matches “{query}”.",
  "pokedex.whichPokemon": "Which Pokémon?",

  // ------------------------------------------------------------------- especie
  "species.calcIV": "Check my IVs",
  "species.baseStats": "Base stats",
  "species.maxCP": "Max CP with perfect IVs",
  "species.bestMoves": "Best moves",
  "species.noMoves": "No move data for this species.",
  "species.needsElite": "needs an Elite TM",
  "species.bait": "bait: {move}",
  "species.stuckOnFrustration": "stuck with Frustration",
  "species.shadowToggle": "Mine is shadow",
  "species.shadowToggleOn": "✓ shadow",
  "species.shadowNote": "Shadow hits {percent}% harder. Frustration takes a slot and only an event TM removes it.",
  "species.frustrationCost": " Alone, it costs {percent}% in PvP.",
  "species.evolvesInto": "Evolves into",
  "species.candy": "{count} candy",

  // -------------------------------------------------------------- contextos
  "context.general.title": "Everything",
  "context.general.detail": "Good at both.",
  "context.raid.title": "Raid",
  "context.raid.detail": "Damage per second on one target.",
  "context.pvp.title": "PvP",
  "context.pvp.detail": "Turns and energy.",
  "context.rocket.title": "Rocket",
  "context.rocket.detail": "Leaders block your first two charged moves.",

  // ---------------------------------------------------------------- calculadora
  "iv.title": "My {name}'s IVs",
  "iv.whatItRead": "What it read",
  "iv.enterByHand": "Enter by hand",
  "iv.dragBars": "Drag each bar to match the game.",
  "iv.findLevel": "Find the level",
  "iv.saveToCollection": "Save to collection",
  "iv.savedToCollection": "Saved to collection",
  "iv.impossible.title": "These numbers don't add up",
  "iv.impossible.body":
    "No level gives CP {cp} with {hp} HP for a {name} with those IVs. Check the bars, the numbers — or whether it's really this species.",
  "iv.cpAt40": "CP at level 40 with these IVs",
  "iv.cpAtCap": "CP at level {level}",
  "iv.pvpPosition": "PvP position",
  "iv.notEligible": "doesn't fit",
  "iv.levelIs": "Level",
  "iv.or": "or",

  // -------------------------------------------------------------------- scanner
  "scan.desktopWarning.title": "You're on a computer",
  "scan.desktopWarning.body": "Tested on phone screenshots. Desktop ones usually fail.",
  "scan.reading": "Reading the screenshot…",
  "scan.readAll": "Read all three bars",
  "scan.readValues": "Attack {atk} · Defense {def} · HP {hp}",
  "scan.failed": "Couldn't read it",
  "scan.adjustByHand": " Adjust the bars by hand below.",
  "scan.prompt": "Attach the appraisal screenshot",
  "scan.promptDetail": "The screen with three bars.",
  "scan.pick": "Choose screenshot",
  "scan.swap": "Change screenshot",
  "scan.fail.noBars": "I couldn't find any orange or red bar in the image.",
  "scan.fail.tooShort": "The bars came out too small in the image for a reliable read.",
  "scan.fail.notEnough": "I found some bars but not the three I need (Attack, Defense, HP).",
  "scan.fail.mismatch":
    "I found bars, but with widths too different to be the three from the appraisal.",

  // ------------------------------------------------------------------- veredito
  "verdict.title": "Verdict",
  "verdict.confidence": "confidence {percent}%",
  "verdict.howIGotHere": "How I got here",
  "verdict.hide": "Hide",

  // ------------------------------------------------------------------- colecao
  "collection.title": "Collection",
  "collection.empty.title": "No Pokémon saved",
  "collection.empty.body": "Scan the appraisal screenshot and save it. The verdict shows up here.",
  "collection.add": "Add Pokémon",
  "collection.backup": "Backup",
  "collection.export": "Export",
  "collection.import": "Import",
  "collection.imported": "{count} Pokémon imported.",
  "collection.importError": "That file doesn't look like a TrainerKit backup.",
  "collection.importInvalid": "Backup has an invalid entry.",

  // ------------------------------------------------------------------ assistente
  "assistant.title": "What I think",

  // -------------------------------------------------------------------- ajustes
  "settings.title": "Settings",
  "settings.appearance": "Appearance",
  "settings.theme.system": "System",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.storage": "Storage",
  "settings.installed": "Installed on Home Screen",
  "settings.install": "Install on Home Screen",
  "settings.seeHow": "see how ›",
  "settings.yes": "yes",
  "settings.no": "no",
  "settings.dataProtected": "Data protected",
  "settings.checking": "checking…",
  "settings.unsupported": "not supported",
  "settings.spaceUsed": "Space used",
  "settings.spaceOf": " of {total}",
  "settings.language": "Language",
  "settings.showTranslation": "Show move translations",
  "settings.showTranslationDetail": "Counter (Contra-atacar)",
  "settings.gameData": "Game data",
  "settings.datasetVersion": "Dataset version",
  "settings.about": "About",
  "settings.disclaimer":
    "Independent fan-made app, not affiliated with Scopely Explore (formerly Niantic), The Pokémon Company or Nintendo. Trademarks belong to their respective owners.",
  "settings.disclaimer2":
    "Works only by reading screenshots you provide. It doesn't touch the game servers, and no image leaves your device.",
  "settings.version": "Version {version}",

  // ------------------------------------------------------------------ onboarding
  "onb.aria": "Welcome",
  "onb.tagline": "Is this Pokémon worth it, and what for.",
  "onb.nameLabel": "What should I call you?",
  "onb.namePlaceholder": "Your name or nickname",
  "onb.nameAria": "Your name",
  "onb.start": "Start",
  "onb.howToUse": "How do you want to use it?",
  "onb.mode.browse": "Just look things up",
  "onb.mode.browseDetail": "Search, see moves and IVs. Saves nothing.",
  "onb.mode.collection": "Build my collection",
  "onb.mode.collectionDetail": "Save yours and get a verdict for each.",
  "onb.assistant": "Assistant",
  "onb.assistantDetail": "A written opinion, not just numbers.",
  "onb.continue": "Continue",
  "onb.lastThing": "One last thing",
  "onb.installIos": "Safari wipes data from apps idle for 7 days. Installed, yours is safe.",
  "onb.installOther": "Full screen, offline, and screenshots straight from Share.",
  "onb.seeHowToInstall": "See how to install",
  "onb.skipInstall": "Not now, open the app",

  // --------------------------------------------------------------------- sprites
  "sprites.title": "Images",
  "sprites.none": "No images",
  "sprites.noneDetail": "Just the type-coloured badge with initials. Nothing is downloaded.",
  "sprites.official": "Official artwork",
  "sprites.officialDetail": "Large illustration from PokeAPI. Downloaded only when seen, then kept.",
  "sprites.home": "3D renders",
  "sprites.homeDetail": "Pokémon HOME models. More uniform across species.",
  "sprites.custom": "Custom source",
  "sprites.customDetail": "A manifest link or a .zip.",
  "sprites.note": "TrainerKit only points at the source you pick.",
  "sprites.addSource": "Add source",
  "sprites.sourceUrl": "Manifest or .zip link",
  "sprites.pickZip": "Choose a .zip",
  "sprites.loading": "Loading source…",
  "sprites.loaded": "{count} images loaded",
  "sprites.sourceError": "Couldn't read this source. {message}",
  "sprites.remove": "Remove source",
  "sprites.clearCache": "Clear image cache",
  "sprites.cacheCleared": "Cache cleared.",

  // ------------------------------------------------- mensagens vindas do core
  //
  // Estas o core emite como chave + numeros. A checagem no fim do arquivo
  // garante que nenhuma fique sem traducao.
  "verdict.evolution.ready": "you already have the {candy} candy",
  "verdict.evolution.pending": "it still evolves, and evolving changes everything",
  "verdict.pvp.top": "it's top {rank} in the {league}",
  "verdict.pvp.good": "it's #{rank} in the {league}",
  "verdict.raid.attack": "base attack {base} with {iv} attack IV",
  "verdict.shadow.bonus": "shadow hits 20% harder — don't purify without thinking",
  "verdict.lucky.cost": "being lucky, powering up costs half the dust",
  "verdict.iv.weak": "IV {total} out of 45",
  "verdict.species.weak": "the species delivers neither damage nor bulk",
  "verdict.default": "nothing here calls for action right now",

  "assistant.profile.hitsHard": "Hits hard. Good for raids.",
  "assistant.profile.tanky": "Takes hits. Good for PvP.",
  "assistant.profile.weak": "Weak at both. Pokédex only.",
  "assistant.profile.attacker": "Attacker: deals damage, but falls fast.",
  "assistant.profile.wall": "Wall: lasts long, kills slowly.",
  "assistant.profile.balanced": "Balanced. Works for both.",

  "assistant.iv.greatForLeague": "Excellent IVs for {league} League.",
  "assistant.iv.maxAttack": "Attack 15. The stat that matters most in raids.",
  "assistant.iv.attackHurtsCapped": "High attack hurts in a capped league: it inflates CP.",
  "assistant.iv.weak": "Weak IVs. Transfer candidate.",

  "assistant.evidence.baseAttack": "base attack {atk}",
  "assistant.evidence.defAndHp": "defense {def} and HP {hp}",
  "assistant.evidence.hpAndDefVsAtk": "defense {def} and HP {hp} against attack {atk}",
  "assistant.evidence.allStats": "attack {atk}, defense {def}, HP {hp}",
  "assistant.evidence.atkVsBulk": "attack {atk} against defense {def} and HP {hp}",
  "assistant.evidence.rankOf4096": "#{rank} out of 4,096 combinations",
  "assistant.evidence.attackMax": "attack 15 of 15",
  "assistant.evidence.attackAndRank": "attack {atk}, position #{rank} in {league}",
  "assistant.evidence.ivOutOf45": "{total} of 45 points",

  "assistant.headline.perfect": "{name} 100%. Don't transfer.",
  "assistant.headline.topLeague": "Top {rank} in {league} League.",
  "assistant.headline.weak": "Weak IVs. Not worth investing.",
  "assistant.headline.plain": "{total} of 45 · up to {cp} CP.",
  "assistant.headline.speciesOnly": "Up to {cp} CP at level {level}.",
  "sprites.addLink": "Add link",
  "sprites.importZip": "Import .zip",
  "sprites.readingManifest": "Reading manifest…",
  "sprites.unzipping": "Unzipping…",
  "sprites.manifestPlaceholder": "https://example.com/sprites.json",
  "sprites.manifestAria": "Manifest address",
  "sprites.noneActive": "Nothing is downloaded.",
  "sprites.manifestHelp": "The manifest is a JSON with {nameField} and {templateField} — for example {example}. In a .zip, the file name is what matches: {byDex} by Pokédex number, {byName} by name. Folders are ignored.",
  "home.quickScan": "Scan a screenshot",
  "home.quickScanDetail": "Exact IVs and a verdict",
} as const;

/**
 * Toda mensagem que o core emite precisa existir aqui.
 *
 * Checagem em tempo de compilacao, nao em teste: uma regra nova no `verdict.ts`
 * sem traducao correspondente quebra o build em vez de aparecer como texto cru
 * na tela de alguem.
 */
export { EN };

type CoreKeysCovered = MessageKey extends keyof typeof EN ? true : never;
const _coreKeysCovered: CoreKeysCovered = true;
void _coreKeysCovered;
