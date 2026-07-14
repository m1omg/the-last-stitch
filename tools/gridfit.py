#!/usr/bin/env python3
"""Render each map backdrop with its collision grid + entities overlaid, at
full resolution, for collision↔art reconciliation.

Usage: python3 tools/gridfit.py harbor [orchard …]  → shots/gridfit_<map>.png
"""

import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# pull MAPS out of the ES module via node
NODE = """
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { MAPS } = await import('./src/data/maps.js');
const out = {};
for (const [id, m] of Object.entries(MAPS)) {
  out[id] = { img: m.img, grid: m.grid, entities: m.entities.map(e => ({
    type: e.type, id: e.id || '', x: e.x, y: e.y, w: e.w || 0, h: e.h || 0, to: e.to?.map || '' })) };
}
console.log(JSON.stringify(out));
"""

def main():
    data = subprocess.run(['node', '--input-type=module', '-e', NODE], cwd=ROOT,
                          capture_output=True, text=True, check=True).stdout
    maps = json.loads(data)
    for mid in (sys.argv[1:] or maps.keys()):
        m = maps[mid]
        src = os.path.join(ROOT, 'assets', 'img', 'maps', m['img'] + '.png')
        if not os.path.exists(src):
            print(f'{mid}: backdrop not generated yet, skipping')
            continue
        im = Image.open(src).convert('RGBA')
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        for gy in range(32):
            for gx in range(48):
                c = m['grid'][gy][gx]
                if c == '.':
                    continue
                col = (60, 130, 255, 70) if c == '~' else (255, 60, 60, 80)
                d.rectangle([gx * 32, gy * 32, gx * 32 + 31, gy * 32 + 31], fill=col)
        for i in range(0, 49, 4):
            d.line([i * 32, 0, i * 32, 1024], fill=(255, 255, 255, 90))
            d.text((i * 32 + 3, 3), str(i), fill=(255, 255, 0, 200))
        for j in range(0, 33, 4):
            d.line([0, j * 32, 1536, j * 32], fill=(255, 255, 255, 90))
            d.text((3, j * 32 + 3), str(j), fill=(255, 255, 0, 200))
        for e in m['entities']:
            x, y = e['x'], e['y']
            d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(0, 255, 120, 220))
            d.text((x + 8, y - 6), f"{e['type']}:{e['id'] or e['to']}", fill=(0, 255, 120, 255))
            if e['w']:
                d.rectangle([x - e['w'] / 2, y - e['h'] / 2, x + e['w'] / 2, y + e['h'] / 2],
                            outline=(0, 255, 120, 200), width=2)
        out = Image.alpha_composite(im, ov).convert('RGB')
        path = os.path.join(ROOT, 'shots', f'gridfit_{mid}.png')
        out.save(path)
        print(path)

if __name__ == '__main__':
    main()
