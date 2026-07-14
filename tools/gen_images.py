#!/usr/bin/env python3
"""Generate all game art via Codex (GPT Image) in consistent batches.

Usage:
  python3 tools/gen_images.py --all            # everything not yet in _raw
  python3 tools/gen_images.py --only en_moth   # regenerate specific file(s)
  python3 tools/gen_images.py --list           # show batches / missing

Images land in assets/_raw/ ; run tools/postprocess.py afterwards.
"""

import argparse
import concurrent.futures as cf
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', '_raw')

STYLE = (
    "children's storybook illustration, soft watercolor and colored-pencil textures, "
    "thick wobbly hand-drawn outlines, cute rounded shapes, cozy muted palette of warm cream, "
    "dusty rose, sage green and slate blue, gentle paper grain, soft diffuse lighting. "
    "No text, no letters, no numbers, no watermark, no signature."
)
FADED = (
    " Fog-bleached, heavily desaturated near-white with faint rose and sage remnants, "
    "threadbare, loose unravelling threads, quiet dread."
)

POPPY = ("POPPY: a small 9-year-old girl with warm light-brown skin, big dark round eyes, short curly "
         "dark-brown hair, a bright poppy-red duffle coat with wooden toggle buttons, a mustard-yellow "
         "scarf, and yellow wellington boots.")
BUTTONS = ("BUTTONS: a hand-knitted cream-beige yarn cat plush with visible knit stitches, one shiny black "
           "button right eye, the left eye missing and stitched over with a spiral of brown thread, pink "
           "stitched inner ears and paw pads, a small faded slate-blue knitted scarf, and a dusty-rose "
           "patched heart sewn on its chest.")
CAPTAIN = ("THE CAPTAIN: a small elderly doll-like sea-captain woman with a kind weathered face, silver hair "
           "in a tight bun, a navy wool coat with brass buttons, a hat folded from old letter paper worn like "
           "a tricorn, and a small brass lantern on her belt.")
NANA = ("NANA IVY: a warm elderly woman, silver hair in a loose bun, round glasses, a lavender knitted "
        "cardigan, a patchwork quilt over her knees.")
MUM = "MUM: a woman in her late thirties, curly dark-brown hair, a tired gentle smile, mustard-yellow jumper."

MAGENTA = ("on a plain solid magenta background, hex #FF00FF exactly, filling every pixel of the background "
           "(no gradient, no vignette). CRITICAL: the magenta is a flat matte backdrop only — NO magenta rim light, "
           "NO magenta color bleed or reflection on the character, NO magenta in shadows; keep every character color "
           "clean and fully separated from the background. Square image.")
SPRITE = ("Single character, full body, chibi proportions (big head, small round body), centered, entire "
          "character fully visible with a margin, " + MAGENTA)
PORTRAIT = ("Head-and-shoulders portrait, centered, facing slightly toward the viewer's left, soft clean "
            "watercolor shading, smooth bright skin with NO grain, NO stippling, NO speckle or charcoal texture "
            "on the face, clear luminous colors, " + MAGENTA)
ENEMY = "Single creature, full body, centered, cute but slightly unsettling, " + MAGENTA
MAP = ("High-angle three-quarter top-down view, video-game overworld map painting, landscape 3:2 "
       "(1536x1024), no characters, no user interface, no text.")
SCENE = "Cinematic storybook illustration, landscape 3:2 (1536x1024)."

# batch name -> list of (filename, prompt)
BATCHES = {
    'poppy': [
        ('spr_poppy_front.png', f"{POPPY} Standing facing the viewer, arms relaxed, friendly. {SPRITE}"),
        ('spr_poppy_back.png', f"{POPPY} Seen from directly behind (back of head and coat hood visible, no face). {SPRITE}"),
        ('spr_poppy_side.png', f"{POPPY} In profile facing the viewer's right, mid-step walking. {SPRITE}"),
        ('por_poppy_neutral.png', f"{POPPY} Calm, attentive expression. {PORTRAIT}"),
        ('por_poppy_happy.png', f"{POPPY} Bright delighted smile, sparkling eyes. {PORTRAIT}"),
        ('por_poppy_sad.png', f"{POPPY} Downcast eyes, wobbling lip, holding back tears. {PORTRAIT}"),
        ('por_poppy_scared.png', f"{POPPY} Wide frightened eyes, small gasp, hands near chin. {PORTRAIT}"),
    ],
    'buttons': [
        ('spr_buttons_front.png', f"{BUTTONS} Sitting upright facing the viewer, tail curled. {SPRITE}"),
        ('spr_buttons_back.png', f"{BUTTONS} Seen from directly behind, tail up, head turned slightly. {SPRITE}"),
        ('spr_buttons_side.png', f"{BUTTONS} In profile facing the viewer's right, mid-trot, tail flowing. {SPRITE}"),
        ('por_buttons_neutral.png', f"{BUTTONS} Calm knowing cat expression. {PORTRAIT}"),
        ('por_buttons_smug.png', f"{BUTTONS} Extremely smug half-lidded grin. {PORTRAIT}"),
        ('por_buttons_sad.png', f"{BUTTONS} Ears drooping, button eye glistening, worried. {PORTRAIT}"),
    ],
    'captain': [
        ('spr_captain_front.png', f"{CAPTAIN} Standing facing the viewer, hands clasped behind back, steady. {SPRITE}"),
        ('spr_captain_back.png', f"{CAPTAIN} Seen from directly behind, paper hat and bun visible. {SPRITE}"),
        ('spr_captain_side.png', f"{CAPTAIN} In profile facing the viewer's right, striding with purpose. {SPRITE}"),
        ('por_captain_neutral.png', f"{CAPTAIN} Composed, weather-eyed. {PORTRAIT}"),
        ('por_captain_stern.png', f"{CAPTAIN} Stern command, brows knit, jaw set. {PORTRAIT}"),
        ('por_captain_soft.png', f"{CAPTAIN} Softened gaze, faint sad smile, remembering. {PORTRAIT}"),
    ],
    'family': [
        ('por_nana_warm.png', f"{NANA} Warm delighted recognition, eyes crinkled. {PORTRAIT}"),
        ('por_nana_lost.png', f"{NANA} Gently confused, eyes unfocused past the viewer, polite uncertain smile. {PORTRAIT}"),
        ('por_mum.png', f"{MUM} Gentle tired warmth. {PORTRAIT}"),
        ('spr_mum.png', f"{MUM} Standing facing the viewer, holding a shopping bag. {SPRITE}"),
        ('spr_nana.png', f"{NANA} Seated pose as if in an armchair (no chair in the image — she will be composited into a painted chair), knitting in her lap, quilt over her knees, gentle smile, facing slightly left. {SPRITE}"),
    ],
    'npcs1': [
        ('spr_thimble.png', f"A cheerful shopkeeper whose round body is a big brass thimble, rosy dot cheeks, tiny white apron, stubby arms. {SPRITE}"),
        ('spr_folk_a.png', f"A button-person villager: round pearl-shell button body with four thread holes, stubby limbs, cheerful face. {SPRITE}"),
        ('spr_folk_b.png', f"A button-person villager: rectangular wooden toggle-button body, little flat cap, easygoing face. {SPRITE}"),
        ('spr_postmoth.png', f"A chubby grey-lilac moth postman standing upright with a tiny postal satchel and cap, holding a letter in its feet. {SPRITE}"),
        ('spr_hollow.png', f"A button-person villager gone hollow: pale grey, BOTH button eyes missing with loose threads where eyes were, slumped shoulders, slightly translucent, quietly unsettling.{FADED} {SPRITE}"),
    ],
    'npcs2': [
        ('spr_coat.png', f"An empty sea-grey wool coat draped over the back of a simple wooden chair, hanging as if someone might still be wearing it, poignant and still. {SPRITE}"),
        ('spr_boat.png', f"A small paper boat folded from a page of old handwriting, side view, floating on a scrap of blue fabric wave. {SPRITE}"),
        ('spr_savequilt.png', f"A small square patchwork picnic quilt seen from above at a gentle angle, tiny teapot and one teacup on it, soft golden inviting glow. {SPRITE}"),
    ],
    'enemies_orchard': [
        ('en_moth.png', f"A 'Sniffle-moth': plump fuzzy grey-lilac moth with droopy antennae, big teary eyes, clutching a tiny handkerchief, hovering. {ENEMY}"),
        ('en_dust.png', f"A 'Dust Bunny': rabbit shaped from grey dust and lint, long floppy ears, button nose, static-frizz fur, shy. {ENEMY}"),
        ('en_sock.png', f"A 'Sock Golem': small lumbering golem built of mismatched stuffed knitted socks, one striped sock worn as a hat, wobbly stance. {ENEMY}"),
        ('en_mothqueen.png', f"The 'MOTH QUEEN': majestic large moth monarch, crown of glittering dust, vast grey velvet wings draped like a shroud, regal sleepy eyes, imposing boss creature. {ENEMY}"),
    ],
    'enemies_sea': [
        ('en_fogpup.png', f"A 'Fog-pup': puppy made of pale fog with a faint stitched outline, dim glowing eyes, misty wagging tail, semi-transparent edges.{FADED} {ENEMY}"),
        ('en_urchin.png', f"A 'Pincushion Urchin': round red pincushion creature bristling with pearl-tipped pins, grumpy little face. {ENEMY}"),
        ('en_whistler.png', f"A 'Whistler': haunted vintage valve radio standing on spindly bird legs, its round dial like a single eye, static and warped music notes leaking out. {ENEMY}"),
        ('en_tangle.png', f"'THE TANGLE': a towering leviathan of knotted storm-blue and grey yarn, hundreds of knots, two deep dark knot-eyes, loose threads dripping like seaweed, imposing boss creature. {ENEMY}"),
    ],
    'enemies_white': [
        ('en_unraveler.png', f"An 'Unraveler': tall gaunt figure knitted from grey yarn, far too many long thin fingers, hollow stitched face, loose thread ends trailing from its arms.{FADED} {ENEMY}"),
        ('en_frame.png', f"A 'Hollow Frame': ornate standing picture frame on little wooden legs, the canvas inside empty white except the faint pale outline of a missing person.{FADED} {ENEMY}"),
        ('en_fog1.png', f"'THE FOG': a vast soft white fog-being, billows filling the frame, a barely-there gentle face (closed eyes, calm mouth) emerging from the mist, immense and serenely unsettling.{FADED} {ENEMY}"),
        ('en_fog2.png', f"'THE FOG', gathered: white mist condensed into the almost-human silhouette of an elderly woman, featureless but gentle, one misty hand held out.{FADED} {ENEMY}"),
    ],
    'maps_cottage': [
        ('map_cottage.png', "Interior of a cosy seaside cottage living room at night, warm lamplight, muted sepia tones. "
         "A guest bed with a patchwork quilt on the left side, a fireplace and a floral wingback armchair right of center "
         "with an old valve radio on a side table beside it, a small kitchen nook in the upper right, a photo shelf on the "
         "upper-left wall, wooden floor with round rugs, walls with framed pictures on all sides. " + MAP),
        ('map_cottage_morning.png', "Interior of a cosy seaside cottage living room in the morning, pale gold winter sunlight "
         "streaming through windows. A guest bed with a patchwork quilt on the left side, a fireplace and floral wingback "
         "armchair right of center with an old valve radio on a side table, small kitchen nook upper right, photo shelf on "
         "the upper-left wall, wooden floor with round rugs. Warm and gentle. " + MAP),
    ],
    'maps_harbor': [
        ('map_harbor.png', "A tiny storybook harbour town stitched from fabric and buttons. Cobbled town square at the center "
         "with a small patchwork picnic quilt, a tall lighthouse with a DARK unlit lamp at the top center behind the town, a "
         "little market stall with a striped awning on the left side, snug cottages in the upper-left and upper-right corners, "
         "a stone pier running from the lower town into a quilted-fabric sea along the bottom edge, button cobblestones, "
         "stitched fabric waves, an opening in the hedges on the right edge leading to an orchard. " + MAP),
    ],
    'maps_orchard': [
        ('map_orchard.png', "A rolling storybook apple orchard. A winding dirt path from a gate at the bottom-left curving up "
         "to a hilltop clearing at the top-center crowned by one grand apple tree, clusters of round mop-top apple trees "
         "scattered as obstacles, hanging beehive lanterns, a small tea table set for two beneath boughs at the middle-right, "
         "warm golden light that goes grey and foggy toward the top of the hill. " + MAP),
    ],
    'maps_sea': [
        ('map_sea.png', "The Quilted Sea: a wide expanse of stitched fabric waves in layered blues with visible seams and "
         "stitches. A small wooden dock at the upper-left, small button-and-thread islands scattered (one at middle-left, one "
         "at lower-left, a larger knotted island at the lower-right), a shimmering embroidered whale constellation across the "
         "upper-right, thin fog at the far edges. " + MAP),
    ],
    'maps_white': [
        ('map_whiterooms.png', "The interior of a seaside cottage but wrong: fog-bleached and almost white. A floor plan of "
         "several rooms joined by long hallways: a living room with a wall of picture frames in the upper-left, a nursery "
         "with a cot in the upper-middle, a long repeating hallway across the middle, a bedroom in the lower-right, furniture "
         "faded or missing, loose threads unravelling across the floors, near-monochrome with the faintest rose and sage "
         "remnants, quiet dread. " + MAP),
        ('map_lighthouse.png', "Inside a lighthouse tower: switchback wooden stairs spiralling up a tall stone shaft, the "
         "entrance at the bottom, the lamp room with a great unlit glass lamp at the very top, small round windows showing "
         "solid white fog outside, cold hush with one warm hint of brass. " + MAP),
    ],
    'battlebgs': [
        ('bbg_orchard.png', "Battle background: a dreamy orchard clearing, round apple trees at soft-focus edges, dappled "
         "golden-grey light, open empty grass center stage. " + SCENE),
        ('bbg_sea.png', "Battle background: adrift on stitched fabric waves of the Quilted Sea, seams and thread-foam, "
         "distant embroidered stars, open empty center stage. " + SCENE),
        ('bbg_white.png', "Battle background: a fog-bleached almost-white cottage room, faded furniture silhouettes at the "
         "soft edges, threads floating in pale air, open empty center." + FADED + " " + SCENE),
        ('bbg_fog.png', "Battle background: the lighthouse lamp room lost in white fog, the great glass lamp a faint dark "
         "silhouette behind the mist, floorboards fading into white, open empty center." + FADED + " " + SCENE),
    ],
    'stills1': [
        ('cut_title.png', "Storybook cover composition: a lighthouse on a cliff at dusk above a sea of stitched patchwork "
         "fabric, its lamp glowing warm gold; on the cliff path below, seen from behind, a small girl in a poppy-red duffle "
         "coat holding a knitted cat; a vast dusky sky with a faint embroidered whale constellation. " + SCENE),
        ('cut_quilt.png', "A child's hands pulling up a patchwork quilt, every fabric square a tiny stitched scene — a sail, "
         "an apple tree, a lighthouse with a lit yellow window — and the lighthouse square is coming unstitched at one corner; "
         "warm bedside lamplight. " + SCENE),
        ('cut_coat.png', "View from an orchard hilltop in golden-grey light: rows of apple trees below, and in a small cove a "
         "tea table set for two with cold cups — an empty sea-grey coat hangs across one chair as if still worn; melancholic, "
         "still. " + SCENE),
        ('cut_gameover.png', "Loose poppy-red yarn unravelling across soft white empty space, and a pair of careful elderly "
         "hands beginning to knit it back together; gentle, quiet, hopeful. " + SCENE),
    ],
    'stills2': [
        ('cut_photowall.png', "A wall of framed family photographs floor to ceiling, fog-bleached: in several frames the "
         "people are only pale unstitched outlines, a few frames entirely white, one frame lying face-down on the shelf; "
         "near-monochrome, unsettling quiet." + FADED + " " + SCENE),
        ('cut_unravel.png', "A knitted baby doll asleep in a wooden cot, unravelling into loose rows of yarn that lift into "
         "pale air, a felt seagull mobile circling above, white fog filling the little nursery; heartbreaking quiet horror, "
         "heavily desaturated." + FADED + " " + SCENE),
        ('cut_lamp.png', "Inside the lamp room: the great lighthouse lamp glowing a patient kitchen-window gold, wound with "
         "three shimmering threads (gold, storm-blue, pale grey); white fog presses at the glass but stands back; a small "
         "girl in a red duffle coat stands before it, singing, beside a knitted cat and a little doll captain; hopeful. " + SCENE),
        ('cut_ending.png', "A warm winter morning: an elderly woman with silver hair in an armchair by a window overlooking "
         "the sea, a small girl in a mustard scarf perched on the chair's arm, both humming; a knitted cat with one button "
         "eye curled on the quilted lap; tea steaming; tender and bright. " + SCENE),
    ],
}


def batch_prompt(items):
    lines = [
        "You have an image generation tool. Generate the following images ONE BY ONE and save each into the "
        "current working directory with EXACTLY the given filename. Do not create any other files. "
        "After each generation, verify the file exists.",
        "",
        f"GLOBAL STYLE (prepend to every image prompt): {STYLE}",
        "",
    ]
    for i, (fn, prompt) in enumerate(items, 1):
        lines.append(f"{i}. filename: {fn}")
        lines.append(f"   prompt: {prompt}")
        lines.append("")
    return "\n".join(lines)


def run_batch(name, items):
    todo = [(f, p) for (f, p) in items if not os.path.exists(os.path.join(RAW, f))]
    if not todo:
        return (name, [], 'skip')
    prompt = batch_prompt(todo)
    t0 = time.time()
    try:
        subprocess.run(
            ['codex', 'exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', prompt],
            cwd=RAW, capture_output=True, text=True, timeout=60 * 22, stdin=subprocess.DEVNULL,
        )
    except subprocess.TimeoutExpired:
        pass
    missing = [f for (f, _) in todo if not os.path.exists(os.path.join(RAW, f))]
    dt = time.time() - t0
    return (name, missing, f'{dt:.0f}s')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--only', nargs='*', help='filenames (with or without .png) to (re)generate')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--workers', type=int, default=2)
    args = ap.parse_args()
    os.makedirs(RAW, exist_ok=True)

    if args.list:
        for name, items in BATCHES.items():
            missing = [f for (f, _) in items if not os.path.exists(os.path.join(RAW, f))]
            print(f'{name:16} {len(items) - len(missing)}/{len(items)} done', ('missing: ' + ', '.join(missing)) if missing else '')
        return

    if args.only:
        wanted = {(w if w.endswith('.png') else w + '.png') for w in args.only}
        items = [(f, p) for items in BATCHES.values() for (f, p) in items if f in wanted]
        for f in list(wanted):
            path = os.path.join(RAW, f)
            if os.path.exists(path):
                os.remove(path)
        if not items:
            print('nothing matched', file=sys.stderr)
            sys.exit(1)
        name, missing, dt = run_batch('only', items)
        print(f'done in {dt}; missing: {missing or "none"}')
        sys.exit(1 if missing else 0)

    if not args.all:
        ap.print_help()
        return

    work = list(BATCHES.items())
    all_missing = []
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(run_batch, n, i): n for n, i in work}
        for fut in cf.as_completed(futs):
            name, missing, dt = fut.result()
            all_missing += missing
            print(f'[{name}] {dt}' + (f'  MISSING: {missing}' if missing else '  ok'), flush=True)

    # one retry pass for stragglers
    if all_missing:
        print(f'retrying {len(all_missing)} missing…', flush=True)
        items = [(f, p) for items in BATCHES.values() for (f, p) in items if f in set(all_missing)]
        for chunk_start in range(0, len(items), 4):
            chunk = items[chunk_start:chunk_start + 4]
            name, missing, dt = run_batch('retry', chunk)
            print(f'[retry] {dt}' + (f'  STILL MISSING: {missing}' if missing else '  ok'), flush=True)

    total = sum(len(i) for i in BATCHES.values())
    have = sum(1 for items in BATCHES.values() for (f, _) in items if os.path.exists(os.path.join(RAW, f)))
    print(f'\n{have}/{total} raw images present.')


if __name__ == '__main__':
    main()
