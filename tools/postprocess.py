#!/usr/bin/env python3
"""Post-process raw generated art into game-ready assets.

- Keyed assets (spr_/por_/en_): magenta #FF00FF background → alpha, despill the
  pink fringe, trim to content, resize to target, save into assets/img/**.
- Scenery (map_/bbg_/cut_): cover-resize to 1536×1024.

Usage: python3 tools/postprocess.py [--only name ...]
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', '_raw')
IMG = os.path.join(ROOT, 'assets', 'img')

# prefix -> (subdir, target)
#   target: ('h', px)  = scale to height
#           ('sq', px) = center-crop square then scale
#           ('cover', (w,h))
RULES = [
    ('spr_', 'sprites', ('h', 440)),
    ('por_', 'portraits', ('sq', 512)),
    ('en_', 'enemies', ('h', 760)),
    ('map_', 'maps', ('cover', (1536, 1024))),
    ('bbg_', 'battle', ('cover', (1536, 1024))),
    ('cut_', 'cutscenes', ('cover', (1536, 1024))),
]


def key_magenta(im):
    """Background magenta → transparent. Flood-fills from the borders so only
    background-CONNECTED magenta is removed — interior pixels that merely lean
    magenta (red coats, pink cheeks) stay opaque."""
    a = np.asarray(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dist = np.sqrt((r - 255) ** 2 + g ** 2 + (b - 255) ** 2)
    magenta_ish = dist < 135  # generous: candidates only; connectivity decides
    h, w = magenta_ish.shape
    bg = np.zeros((h, w), dtype=bool)
    # seed from all border pixels that are magenta-ish, then grow (vectorized BFS)
    seeds = np.zeros_like(bg)
    seeds[0, :] = seeds[-1, :] = seeds[:, 0] = seeds[:, -1] = True
    frontier = seeds & magenta_ish
    bg |= frontier
    while frontier.any():
        grown = np.zeros_like(bg)
        grown[1:, :] |= frontier[:-1, :]
        grown[:-1, :] |= frontier[1:, :]
        grown[:, 1:] |= frontier[:, :-1]
        grown[:, :-1] |= frontier[:, 1:]
        frontier = grown & magenta_ish & ~bg
        bg |= frontier
    alpha = a[..., 3].copy()
    alpha[bg] = 0
    # fill ENCLOSED transparent pockets: transparent regions that never touch
    # the border are character interior (magenta-tinted shading the model baked
    # in) — restore them opaque; the despill below neutralizes their tint.
    transparent = alpha < 200
    outside = np.zeros_like(transparent)
    frontier = np.zeros_like(transparent)
    frontier[0, :] = frontier[-1, :] = frontier[:, 0] = frontier[:, -1] = True
    frontier &= transparent
    outside |= frontier
    while frontier.any():
        grown = np.zeros_like(outside)
        grown[1:, :] |= frontier[:-1, :]
        grown[:-1, :] |= frontier[1:, :]
        grown[:, 1:] |= frontier[:, :-1]
        grown[:, :-1] |= frontier[:, 1:]
        frontier = grown & transparent & ~outside
        outside |= frontier
    pockets = transparent & ~outside
    alpha[pockets] = 255
    # soft edge: feather the cut
    am = Image.fromarray(alpha.astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(1.1))
    alpha = np.asarray(am).astype(np.int16)
    # despill: magenta-cast pixels near the edge (and restored pockets) get
    # pulled to neutral
    edge = ((alpha > 0) & (alpha < 250)) | pockets
    cast = edge & (r > g + 40) & (b > g + 40)
    lum = (0.4 * r + 0.4 * g + 0.2 * b).astype(np.int16)
    for ch, arr in ((0, r), (2, b)):
        a[..., ch] = np.where(cast, (arr * 0.35 + lum * 0.65).astype(np.int16), arr)
    a[..., 3] = alpha
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def trim(im, pad=8):
    bbox = im.getchannel('A').getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(im.width, r + pad); b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im2 = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im2.width - w) // 2
    y = (im2.height - h) // 2
    return im2.crop((x, y, x + w, y + h))


def process(fn):
    src = os.path.join(RAW, fn)
    for prefix, sub, target in RULES:
        if not fn.startswith(prefix):
            continue
        outdir = os.path.join(IMG, sub)
        os.makedirs(outdir, exist_ok=True)
        out = os.path.join(outdir, fn)
        im = Image.open(src)
        if target[0] == 'cover':
            im = cover(im.convert('RGB'), *target[1]).convert('RGB')
            im.save(out, optimize=True)
        else:
            im = key_magenta(im)
            im = trim(im)
            if target[0] == 'sq':
                side = max(im.width, im.height)
                sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
                sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
                im = sq.resize((target[1], target[1]), Image.LANCZOS)
            else:  # height
                hpx = min(target[1], im.height)
                s = hpx / im.height
                im = im.resize((max(1, round(im.width * s)), hpx), Image.LANCZOS)
            im.save(out, optimize=True)
        return out
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    args = ap.parse_args()
    names = sorted(os.listdir(RAW))
    if args.only:
        keys = {(w if w.endswith('.png') else w + '.png') for w in args.only}
        names = [n for n in names if n in keys]
    done = skipped = 0
    for fn in names:
        if not fn.endswith('.png') or fn == 'smoke.png':
            continue
        out = process(fn)
        if out:
            done += 1
            print(f'  {fn:28} → {os.path.relpath(out, ROOT)}')
        else:
            skipped += 1
    print(f'{done} processed, {skipped} skipped')


if __name__ == '__main__':
    main()
