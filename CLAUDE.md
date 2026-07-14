# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

THE LAST STITCH — a short story-driven JRPG (HTML5 canvas, vanilla ES modules, zero dependencies, no build step). The story is about dementia and anticipatory grief, handled gently; keep new writing in that tone (quiet dread, no gore, no jump-scares).

## Commands

```bash
./run.sh                        # serve on http://localhost:8137 + open browser
                                # (or: python3 -m http.server 8137)

node tests/battle.test.mjs      # combat logic unit tests
node tests/content.test.mjs     # cross-reference lint (story/maps/assets/music ids)
node tests/geometry.test.mjs    # map geometry + BFS reachability of every interactable
node tests/transition.test.mjs  # scene-transition re-entrancy (real Game class)
node tests/playthrough.mjs      # headless full-game story traversal
node tests/sim.mjs [runs]       # monte-carlo balance report (tune src/data/balance.js)

tools/screenshot.sh <shot> ...  # headless Firefox screenshots → shots/ (server must be running)
python3 tools/gen_audio.py      # re-synthesize OST + SFX → assets/audio/
python3 tools/gen_images.py --all|--only <name>  # regenerate art (needs `codex login`) → assets/_raw/
python3 tools/postprocess.py    # raw art → keyed/resized → assets/img/
```

There is no test framework — each test file is a plain node script; run the file directly. Tests shim `localStorage`/`addEventListener` so browser modules import cleanly in node.

Debugging in-game: `F1` toggles collision/entity overlay (`?debug` enables at boot), `?shot=<name>` jumps to a deterministic state (see the shot table in `src/game/debug.js` — every new scene should get a shot), `?seed=N` fixes the RNG, and `window.LS = { game, G }` gives console access.

## Architecture

Three layers with strict direction: `src/engine/` (generic, game-agnostic) ← `src/game/` (scenes + logic) ← `src/data/` (pure content).

- **`src/engine/core.js`** — game loop, Scene contract (`enter?/exit?/update(dt)/draw(ctx)`), fade transitions, shake/flash. Canvas is fixed 960×640 (`W`, `H`). Gotcha: a fade-out in progress is committed — `setScene` ignores re-entrant calls because the outgoing scene keeps updating beneath the fade (doors underfoot would restart it forever). `tests/transition.test.mjs` guards this.
- **`src/game/state.js`** — the global `G` singleton: story flags, party, inventory, seeded RNG (`mulberry32`), save/load via localStorage. Kept import-free of data modules.
- **`src/game/battle_logic.js`** — pure combat, no DOM/engine imports; returns event lists that `battle.js` (the scene) animates and `tests/sim.mjs` drives headlessly. Weather mood triangle SUNNY>STORMY>MISTY>SUNNY; FADE stacks; Remind mechanic.
- **`src/game/overworld.js`** — painted-backdrop maps with grid collision, plus the **StoryRunner** that executes `src/data/story.js` scripts.
- **`src/data/story.js`** — all narrative. Each entry is `(ctx) => steps[]` mixing Dialogue steps (strings, `{who,face,text}`, `{choices}`, `{do}`, `{if}`) and StoryRunner commands (`{battle}`, `{still}`, `{goto}`, `{music}`, `{ending}`, …).
- **`src/data/maps.js`** is REGENERATED from `tools/maps_template.js` — edit the template (and reconcile with `tools/gridfit.py`), not the grids in maps.js, for structural changes. Grids are 48×32 ASCII, 32px cells: `#` solid, `.` walkable, `~` water (walkable only with boat).
- **`assets/manifest.js`** — master asset manifest; any image not yet on disk renders as a procedural placeholder, so the game must run fully without generated art.
- **`src/game/main.js`** boots with top-level await (fonts + images) so the window `load` event fires only when the first frame is drawable — this is what makes headless screenshots deterministic. `index.html` paints uncaught errors onto the canvas so screenshots reveal them.

Content integrity is enforced by `tests/content.test.mjs`: every id cross-reference (story, speakers, portraits, stills, enemies, encounters, doors, music) must resolve — run it after touching anything in `src/data/` or the manifest.

## Art pipeline

`tools/style.md` is the style bible — its STYLE BLOCK and character sheets go verbatim into every generation prompt. Flow: `gen_images.py` (Codex/GPT Image) → `assets/_raw/` → `postprocess.py` (magenta-key to alpha, resize) → `assets/img/` → review via `screenshot.sh`, regenerate misses with `--only <name>`. `postprocess.py` and `gridfit.py` need system numpy + Pillow (Debian: `python3-numpy python3-pil`); `assets/_raw/` is gitignored, so shipped PNGs can't be regenerated without re-running generation first.
