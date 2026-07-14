// Dialogue runner + textbox. Drives conversations and doubles as the
// cutscene text engine.
//
// Script steps:
//   'plain string'                       → narrator line
//   { who, face?, text }                 → spoken line with portrait
//   { who?, text, choices: [{label, value}] } → line, then a choice menu;
//        result stored in runner.choice and passed to {do}
//   { do: (ctx) => {} }                  → side effect (flags, items, …)
//   { if: (ctx) => bool, then: [...], else: [...] }
//   { sfx: 'key' } { music: 'key' } { shake: n } { flash: '#fff' } { wait: s }
//
// ctx = { G, game, choice } — provided by the creator.

import { W, H } from './core.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { IMG } from './assets.js';
import { panel, font, theme, Menu, drawCursor } from './ui.js';
import { SPEAKERS } from '../data/speakers.js';

const BOX = { x: 24, y: 462, w: 912, h: 154 };
const CPS = 55; // typewriter chars/sec

function resolvePortrait(spk, face) {
  if (!spk?.por) return null;
  for (const k of [face && `${spk.por}_${face}`, `${spk.por}_neutral`, spk.por]) {
    if (k && IMG[k]) return k;
  }
  return null;
}

export class Dialogue {
  constructor(script, ctx = {}) {
    this.stack = [{ script, i: 0 }];
    this.ctx = ctx;
    this.ctx.dialogue = this;
    this.done = false;
    this.line = null;       // current spoken line state
    this.choice = null;     // last choice value
    this.waitT = 0;
    this._advance();
  }

  // ——— interpreter ———

  _next() {
    while (this.stack.length) {
      const top = this.stack[this.stack.length - 1];
      if (top.i >= top.script.length) { this.stack.pop(); continue; }
      return top.script[top.i++];
    }
    return null;
  }

  _advance() {
    for (;;) {
      const step = this._next();
      if (step == null) { this.done = true; return; }
      if (typeof step === 'string') { this._startLine({ who: 'narrator', text: step }); return; }
      if (step.text != null) { this._startLine(step); return; }
      if (step.do) { step.do(this.ctx); continue; }
      if (step.if) {
        const branch = step.if(this.ctx) ? step.then : step.else;
        if (branch?.length) this.stack.push({ script: branch, i: 0 });
        continue;
      }
      if (step.sfx) { Audio.sfx(step.sfx); continue; }
      if (step.music !== undefined) { step.music ? Audio.music(step.music, step.opts || {}) : Audio.stopMusic(); continue; }
      if (step.shake) { this.ctx.game?.shake(step.shake, 0.4); continue; }
      if (step.flash) { this.ctx.game?.flash(step.flash, 0.3); continue; }
      if (step.wait) { this.waitT = step.wait; return; }
    }
  }

  _startLine(step) {
    const spk = SPEAKERS[step.who || 'narrator'] || SPEAKERS.narrator;
    this.line = {
      spk, step,
      text: typeof step.text === 'function' ? step.text(this.ctx) : step.text,
      portrait: resolvePortrait(spk, step.face),
      shown: 0,           // characters revealed
      pages: null, page: 0,
      menu: null,
      blipAcc: 0,
    };
  }

  _layoutPages(ctx2d) {
    const l = this.line;
    const maxW = BOX.w - (l.portrait ? 200 : 64);
    let measure;
    if (ctx2d) { font(ctx2d, 24); measure = (s) => ctx2d.measureText(s).width; }
    else measure = (s) => s.length * 11.5; // headless (tests) fallback
    const words = l.text.split(' ');
    const lines = [];
    let cur = '';
    for (const wd of words) {
      const t = cur ? cur + ' ' + wd : wd;
      if (measure(t) > maxW && cur) { lines.push(cur); cur = wd; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    l.pages = [];
    for (let i = 0; i < lines.length; i += 3) l.pages.push(lines.slice(i, i + 3));
    if (!l.pages.length) l.pages = [['']];
  }

  _pageText() {
    return this.line.pages[this.line.page].join('\n');
  }

  update(dt) {
    if (this.done) return true;
    if (this.waitT > 0) {
      this.waitT -= dt;
      if (this.waitT <= 0) this._advance();
      return this.done;
    }
    const l = this.line;
    if (!l) { this._advance(); return this.done; }
    if (!l.pages) {
      if (typeof document === 'undefined') this._layoutPages(null); // headless tests
      else return false; // laid out on first draw
    }

    const pageLen = this._pageText().length;
    if (l.shown < pageLen) {
      const before = Math.floor(l.shown);
      l.shown = Math.min(pageLen, l.shown + CPS * dt);
      // letter blips
      const after = Math.floor(l.shown);
      for (let i = before; i < after; i++) {
        const ch = this._pageText()[i];
        if (ch && ch !== ' ' && i % 2 === 0) {
          Audio.sfx(l.spk.blip, { rate: l.spk.rate * (0.96 + Math.random() * 0.08), vol: 0.35 });
        }
      }
      if (Input.pressed.ok || Input.pressed.cancel) { l.shown = pageLen; }
      return false;
    }

    // page fully shown
    if (l.step.choices && l.page === l.pages.length - 1) {
      if (!l.menu) l.menu = new Menu(l.step.choices.map(c => ({ label: c.label, value: c.value })));
      const r = l.menu.update();
      if (r === 'ok') {
        this.choice = l.menu.selected.value;
        this.ctx.choice = this.choice;
        this.line = null;
        this._advance();
      }
      return this.done;
    }
    if (Input.pressed.ok) {
      Audio.sfx('sfx_talk', { vol: 0.4 });
      if (l.page < l.pages.length - 1) { l.page++; l.shown = 0; }
      else { this.line = null; this._advance(); }
    }
    return this.done;
  }

  draw(ctx) {
    if (this.done || this.waitT > 0) return;
    const l = this.line;
    if (!l) return;
    if (!l.pages) this._layoutPages(ctx);

    panel(ctx, BOX.x, BOX.y, BOX.w, BOX.h);

    let tx = BOX.x + 34;
    if (l.portrait) {
      const p = IMG[l.portrait];
      const ps = 118;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(BOX.x + 22, BOX.y + 18, ps, ps);
      ctx.drawImage(p.el, BOX.x + 22, BOX.y + 18, ps, ps);
      ctx.strokeStyle = theme.panelEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(BOX.x + 22, BOX.y + 18, ps, ps);
      ctx.restore();
      tx = BOX.x + 22 + ps + 22;
    }
    // name tag
    if (l.spk.name) {
      font(ctx, 20);
      const nw = ctx.measureText(l.spk.name).width + 30;
      panel(ctx, BOX.x + 16, BOX.y - 26, nw, 40, { radius: 8 });
      ctx.fillStyle = theme.ink;
      ctx.textAlign = 'left';
      ctx.fillText(l.spk.name, BOX.x + 31, BOX.y + 1);
    }
    // text (typewriter)
    font(ctx, 24);
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'left';
    const shown = this._pageText().slice(0, Math.floor(l.shown));
    const lines = shown.split('\n');
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], tx, BOX.y + 48 + i * 32);
    }
    // continue caret
    const pageDone = l.shown >= this._pageText().length;
    if (pageDone && !l.step.choices) {
      const bob = Math.sin(performance.now() / 240) * 3;
      drawCursor(ctx, BOX.x + BOX.w - 34, BOX.y + BOX.h - 22 + bob, 1.1);
    }
    // choices
    if (pageDone && l.step.choices && l.menu) {
      const ch = l.step.choices;
      font(ctx, 23);
      const cw = Math.max(...ch.map(c => ctx.measureText(c.label).width)) + 70;
      const chH = ch.length * 34 + 28;
      const cx = BOX.x + BOX.w - cw - 12, cy = BOX.y - chH - 6;
      panel(ctx, cx, cy, cw, chH);
      l.menu.draw(ctx, cx + 22, cy + 30, cw - 44, { lineH: 34, size: 23 });
    }
  }
}
