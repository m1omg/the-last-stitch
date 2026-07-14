#!/usr/bin/env python3
"""One-off repair of already-keyed game PNGs (raws are gone, so we can't
re-run the fixed postprocess pipeline). Mirrors its logic on keyed images:

1. Kill leftover magenta blobs: strongly-magenta visible pixels (they only
   exist because the old keyer never reached enclosed holes), grown through
   magenta-ish neighbours to catch their antialiased rims.
2. Feather the new cut edges locally (leave untouched edges alone).
3. Recolor magenta-contaminated semi-transparent edge pixels by extending
   nearby solid color (fixes the pink halo). Alpha is preserved.
"""

import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def flood(seeds, allowed):
    out = seeds & allowed
    frontier = out.copy()
    while frontier.any():
        grown = np.zeros_like(out)
        grown[1:, :] |= frontier[:-1, :]
        grown[:-1, :] |= frontier[1:, :]
        grown[:, 1:] |= frontier[:, :-1]
        grown[:, :-1] |= frontier[:, 1:]
        frontier = grown & allowed & ~out
        out |= frontier
    return out


def blur_f(arr, radius):
    """Gaussian blur a float array via 0-255 L mode (this PIL can't blur 'F')."""
    scaled = np.clip(arr, 0, 255).astype(np.uint8)
    return np.asarray(Image.fromarray(scaled, 'L')
                      .filter(ImageFilter.GaussianBlur(radius))).astype(np.float32)


def repair(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).astype(np.int32)
    r, g, b, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3].copy()
    vis = alpha > 0
    dist = np.sqrt((r - 255.0) ** 2 + g ** 2 + (b - 255.0) ** 2)
    strong = (dist < 110) & vis            # unmistakable keying leftovers
    magenta_ish = (dist < 135) & vis

    killed = flood(strong, magenta_ish)
    n_killed = int(killed.sum())
    alpha[killed] = 0

    if n_killed:
        # feather only around the fresh cut so existing soft edges stay put
        blurred = np.asarray(Image.fromarray(alpha.astype(np.uint8), 'L')
                             .filter(ImageFilter.GaussianBlur(1.1))).astype(np.int32)
        near = np.asarray(Image.fromarray((killed * 255).astype(np.uint8), 'L')
                          .filter(ImageFilter.GaussianBlur(2))) > 2
        alpha = np.where(near, np.minimum(alpha, blurred), alpha)

    # recolor contaminated edge pixels (pink halo): semi-transparent, clearly
    # magenta-cast; replace RGB with color extended from solid neighbours.
    # dist<170 spares legitimately purple art (moth fuzz sits above it).
    semi = (alpha > 0) & (alpha < 250)
    cast = semi & (r > g + 40) & (b > g + 40) & (dist < 170)
    n_cast = int(cast.sum())
    if n_cast or n_killed:
        solid = (alpha >= 250).astype(np.float32)
        den = blur_f(solid * 255.0, 4) / 255.0
        ok = den > 0.02
        for ch in (0, 1, 2):
            num = blur_f(a[..., ch] * solid, 4)
            ext = num / np.maximum(den, 1e-4)
            a[..., ch] = np.where(cast & ok, ext, a[..., ch]).astype(np.int32)
        a[..., 3] = alpha
        out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
        out.save(path, optimize=True)
    return n_killed, n_cast


def main():
    total_k = total_c = 0
    for sub in ('sprites', 'enemies', 'portraits'):
        base = os.path.join(ROOT, 'assets', 'img', sub)
        for fn in sorted(os.listdir(base)):
            if not fn.endswith('.png'):
                continue
            k, c = repair(os.path.join(base, fn))
            total_k += k; total_c += c
            if k or c:
                print(f'  {fn:30} killed {k:6d} magenta px, recolored {c:5d} halo px')
    print(f'done: {total_k} px keyed out, {total_c} px decontaminated')


if __name__ == '__main__':
    main()
