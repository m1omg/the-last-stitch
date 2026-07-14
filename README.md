# THE LAST STITCH
*a little game about remembering*

A short (~40 min) story-driven JRPG in the spirit of OMORI, Undertale, End Roll,
Ib and Re:Kinder — with none of their plots. Poppy falls asleep under her
grandmother's patchwork quilt and wakes in **the Patchwork**: a storybook world
stitched from Nana's memories, where a white Fog is quietly unpicking
everything — the orchard, the harbour-folk, and, stitch by newest stitch, Poppy
herself. Relight the lighthouse. Keep the middle of the song.

Content note: the story is about dementia and anticipatory grief, handled
gently but honestly. One act aims for quiet dread rather than jump-scares.
No gore, nothing gratuitous.

## Run it

```bash
./run.sh            # serves on http://localhost:8137 and opens your browser
```
(or `python3 -m http.server 8137` in this folder, then open that URL)

First input unlocks audio (browser policy) — the title theme starts on your
first key press.

## Controls

| key | action |
|---|---|
| Arrows / WASD | move |
| Z / Enter / Space | confirm · talk · interact |
| X / Esc | cancel · pause menu |
| Shift (hold) | run |

Save at the **picnic quilts** (they also mend the party). Game over is gentle —
you resume from your last quilt.

## How to play (light spoilers)

- **Weather moods**: SUNNY outruns STORMY, STORMY overpowers MISTY, MISTY
  dims SUNNY. Skills push moods around; hit with the weather, not against it.
- **FADE**: the Fog's touch stacks up to 3 and makes an ally *forget a skill*.
  **Remind** them (free command) — a memory cures the fade and leaves a buff.
  The Captain's *Steady* clears it entirely.
- **Talk**: most little monsters aren't wicked, just lost. Every regular enemy
  has a peaceful resolution worth bonus glimmer. The harbour-folk drop hints.
- Spend glimmer at Mrs. Thimble's stall; charms are permanent keepsakes.

## Tech / credits

- Hand-rolled HTML5 canvas engine, zero dependencies, no build step
- Story, code, and the fully synthesized OST (one lullaby leitmotif, recolored
  from music box to horror-detune to finale): Claude (Fable 5) via Claude Code
- Illustrations: GPT Image, generated through the Codex CLI
- Typefaces: Patrick Hand (OFL) · Rock Salt (Apache-2.0) — licenses in `assets/fonts/`

### Development

```bash
node tests/battle.test.mjs    # combat logic unit tests
node tests/content.test.mjs   # cross-reference lint (story/maps/assets)
node tests/sim.mjs            # monte-carlo balance report
node tests/playthrough.mjs    # headless full-game story traversal
tools/screenshot.sh title     # deterministic scene screenshots (server must run)
python3 tools/gen_audio.py    # re-synthesize the OST + SFX
python3 tools/gen_images.py --all   # regenerate art (needs `codex login`)
python3 tools/postprocess.py  # raw art → keyed/resized game assets
```

In game: `F1` toggles a collision/entity debug overlay. `?shot=<name>` renders
deterministic states for screenshots; `?seed=N` fixes the RNG.
