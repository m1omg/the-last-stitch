// Stitched-storybook UI: panels with thread borders, text helpers, menus.
// setTheme('faded') is the White Rooms degradation — colors drain and the
// stitching comes apart.

import { Audio } from './audio.js';
import { Input } from './input.js';

export const Themes = {
  warm: {
    panel: '#f7eeda', panelEdge: '#e3d2b1', ink: '#41352b', inkSoft: '#8a7861',
    thread: '#c85a54', gold: '#c9a227', good: '#5e8c4a', bad: '#b04a42',
    shadow: 'rgba(43,31,20,0.35)', degrade: 0,
  },
  faded: {
    panel: '#f1f1ee', panelEdge: '#dededa', ink: '#5c5c5a', inkSoft: '#a2a2a0',
    thread: '#b5b5b2', gold: '#bdbdb9', good: '#9a9a98', bad: '#8f8f8d',
    shadow: 'rgba(0,0,0,0.22)', degrade: 1,
  },
};

export let theme = Themes.warm;
export function setTheme(name) { theme = Themes[name] || Themes.warm; }

export function font(ctx, px, fam = 'hand') {
  ctx.font = `${px}px ${fam === 'title' ? '"Rock Salt"' : '"Patrick Hand"'}, sans-serif`;
}

// deterministic small jitter for the degraded look
function jit(seed) {
  const s = Math.sin(seed * 127.1) * 43758.5453;
  return (s - Math.floor(s)) - 0.5;
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const t = opts.theme || theme;
  const r = opts.radius ?? 10;
  ctx.save();
  // drop shadow
  ctx.fillStyle = t.shadow;
  roundRect(ctx, x + 3, y + 4, w, h, r); ctx.fill();
  // body
  ctx.fillStyle = opts.fill || t.panel;
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = t.panelEdge; ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, r); ctx.stroke();
  // stitch border
  ctx.strokeStyle = opts.thread || t.thread;
  ctx.lineWidth = 1.8;
  if (t.degrade) {
    // stitches coming apart: uneven dashes, small gaps and slipped segments
    ctx.setLineDash([5, 9 + 4 * Math.abs(jit(x + y))]);
    ctx.lineDashOffset = jit(x * 3 + y) * 14;
  } else {
    ctx.setLineDash([6, 5]);
  }
  roundRect(ctx, x + 5.5, y + 5.5, w - 11, h - 11, Math.max(3, r - 4));
  ctx.stroke();
  ctx.setLineDash([]);
  // corner cross-stitches
  const cs = 4.2;
  const corners = [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 10], [x + w - 10, y + h - 10]];
  for (let i = 0; i < corners.length; i++) {
    if (t.degrade && i % 2 === 1) continue; // some stitches missing
    const [cx, cy] = corners[i];
    ctx.beginPath();
    ctx.moveTo(cx - cs, cy - cs); ctx.lineTo(cx + cs, cy + cs);
    ctx.moveTo(cx + cs, cy - cs); ctx.lineTo(cx - cs, cy + cs);
    ctx.stroke();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// word-wrapped text; returns the y after the last line
export function textWrap(ctx, str, x, y, maxW, lineH, opts = {}) {
  const words = String(str).split(' ');
  let line = '', yy = y;
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy); yy += lineH; line = wd;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy + lineH;
}

// little thread-heart cursor
export function drawCursor(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = theme.thread;
  ctx.beginPath();
  ctx.moveTo(0, 2.5);
  ctx.bezierCurveTo(-6.5, -4.5, -3.5, -9, 0, -5.2);
  ctx.bezierCurveTo(3.5, -9, 6.5, -4.5, 0, 2.5);
  ctx.fill();
  ctx.restore();
}

export class Menu {
  constructor(items, opts = {}) {
    this.items = items;             // [{label, value, disabled?, hint?}]
    this.index = 0;
    this.wrap = opts.wrap ?? true;
    this.cols = opts.cols ?? 1;
  }
  get selected() { return this.items[this.index]; }

  // returns 'ok' | 'cancel' | null
  update() {
    const n = this.items.length;
    if (!n) return null;
    let moved = false;
    const step = (d) => {
      let i = this.index;
      for (let tries = 0; tries < n; tries++) {
        i += d;
        if (this.wrap) i = (i + n) % n;
        else i = Math.max(0, Math.min(n - 1, i));
        if (!this.items[i]?.disabled || tries === n - 1) break;
      }
      if (i !== this.index) { this.index = i; moved = true; }
    };
    if (this.cols === 1) {
      if (Input.pressed.up) step(-1);
      if (Input.pressed.down) step(1);
    } else {
      if (Input.pressed.left) step(-1);
      if (Input.pressed.right) step(1);
      if (Input.pressed.up) step(-this.cols);
      if (Input.pressed.down) step(this.cols);
    }
    if (moved) Audio.sfx('sfx_move', { vol: 0.7 });
    if (Input.pressed.ok) {
      if (this.selected?.disabled) { Audio.sfx('sfx_cancel', { vol: 0.6, rate: 0.8 }); return null; }
      Audio.sfx('sfx_ok');
      return 'ok';
    }
    if (Input.pressed.cancel) { Audio.sfx('sfx_cancel'); return 'cancel'; }
    return null;
  }

  draw(ctx, x, y, w, opts = {}) {
    const lineH = opts.lineH ?? 34;
    const size = opts.size ?? 24;
    font(ctx, size);
    ctx.textBaseline = 'middle';
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const yy = y + i * lineH;
      ctx.textAlign = 'left';
      ctx.fillStyle = it.disabled ? theme.inkSoft : theme.ink;
      ctx.fillText(it.label, x + 26, yy);
      if (it.right) {
        ctx.textAlign = 'right';
        ctx.fillText(it.right, x + w - 14, yy);
      }
      if (i === this.index) drawCursor(ctx, x + 10, yy, 1.15);
    }
    ctx.textBaseline = 'alphabetic';
    return y + this.items.length * lineH;
  }
}
