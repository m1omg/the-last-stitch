# THE LAST STITCH — art style bible

## STYLE BLOCK (prepended to every prompt)
children's storybook illustration, soft watercolor and colored-pencil textures,
thick wobbly hand-drawn outlines, cute rounded shapes, cozy muted palette of warm
cream, dusty rose, sage green and slate blue, gentle paper grain, soft diffuse
lighting. No text, no letters, no numbers, no watermark, no signature.

For White-Rooms / Fog assets add: fog-bleached, heavily desaturated, threadbare,
loose unravelling threads, quiet dread.

## CHARACTER SHEETS (verbatim in every prompt that features them)
- POPPY: a small 9-year-old girl with warm light-brown skin, big dark round eyes,
  short curly dark-brown hair, a bright poppy-red duffle coat with wooden toggle
  buttons, a mustard-yellow scarf, and yellow wellington boots.
- BUTTONS: a hand-knitted cream-beige yarn cat plush with visible knit stitches,
  one shiny black button right eye, the left eye missing and stitched over with a
  spiral of brown thread, pink stitched inner ears and paw pads, a small faded
  slate-blue knitted scarf, and a dusty-rose patched heart sewn on its chest.
- THE CAPTAIN: a small elderly doll-like sea-captain woman with a kind weathered
  face, silver hair in a tight bun, a navy wool coat with brass buttons, a hat
  folded from old letter paper worn like a tricorn, and a small brass lantern.
- NANA IVY: a warm elderly woman, silver hair in a loose bun, round glasses, a
  lavender knitted cardigan, a patchwork quilt over her knees.
- MUM (ROSIE): a woman in her late thirties, curly dark-brown hair, tired gentle
  smile, mustard-yellow jumper.

## FRAMING RULES
- SPRITE: single character, full body, chibi proportions (big head, small body),
  centered, fully visible with margin, plain solid magenta #FF00FF background
  filling every background pixel. Square.
- PORTRAIT: head-and-shoulders, centered, facing slightly toward viewer's left,
  plain solid magenta #FF00FF background. Square.
- ENEMY: single creature, full body, centered, cute-but-slightly-unsettling,
  plain solid magenta #FF00FF background. Square.
- MAP: high-angle three-quarter top-down video-game overworld painting,
  landscape 3:2 (1536×1024), no characters, no UI.
- STILL / BATTLE BG: cinematic storybook illustration, landscape 3:2.

## PIPELINE
1. `python3 tools/gen_images.py --all` → codex exec batches → `assets/_raw/*.png`
2. `python3 tools/postprocess.py` → keyed to alpha / resized → `assets/img/**`
3. `tools/screenshot.sh …` → review in-game, regenerate misses by name:
   `python3 tools/gen_images.py --only en_moth`
