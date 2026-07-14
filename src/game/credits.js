// Credits crawl + the post-credits stitch.

import { W, H } from '../engine/core.js';
import { Input } from '../engine/input.js';
import { Audio } from '../engine/audio.js';
import { IMG } from '../engine/assets.js';
import { font } from '../engine/ui.js';

const LINES = [
  ['title', 'THE LAST STITCH'],
  ['sub', 'a little game about remembering'],
  ['gap'],
  ['h', 'for'],
  ['t', 'everyone who keeps the middle of a song'],
  ['gap'],
  ['h', 'poppy'], ['t', 'herself'],
  ['h', 'buttons'], ['t', '100% GOOD CAT'],
  ['h', 'the captain'], ['t', 'she kept the light. she keeps it still.'],
  ['gap'],
  ['h', 'story · code · music'],
  ['t', 'Claude (Fable 5) — Claude Code'],
  ['h', 'illustrations'],
  ['t', 'GPT Image, via a very patient Codex'],
  ['h', 'typefaces'],
  ['t', 'Patrick Hand · Rock Salt'],
  ['gap'],
  ['h', 'inspired by nights spent in'],
  ['t', 'OMORI · Undertale · End Roll · Ib · Re:Kinder'],
  ['t', '(with love, not imitation)'],
  ['gap'],
  ['t', 'The Fog keeps coming. That is what fog does.'],
  ['t', 'Nobody in this story gets to stop it.'],
  ['gap'],
  ['t', 'But for as long as somebody hums—'],
  ['gap'], ['gap'],
  ['title2', 'THE END'],
];

export class CreditsScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.phase = 'crawl'; // crawl → stinger → done
    this.stingerT = 0;
  }

  enter() { Audio.music('mus_ending'); }

  totalHeight() { return LINES.length * 44 + 200; }

  update(dt) {
    this.t += dt * (Input.held.ok ? 3.2 : 1);
    const scrollY = this.t * 34;
    if (this.phase === 'crawl' && scrollY > this.totalHeight() + H * 0.6) {
      this.phase = 'stinger';
      this.stingerT = 0;
    }
    if (this.phase === 'stinger') {
      this.stingerT += dt;
      if (this.stingerT > 3 && (Input.pressed.ok || this.stingerT > 14)) {
        this.phase = 'done';
        Audio.stopMusic(2);
        import('./title.js').then(({ TitleScene }) => {
          this.game.setScene(new TitleScene(this.game), { fade: 2.0 });
        });
      }
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#0e0c0a';
    ctx.fillRect(0, 0, W, H);

    if (this.phase === 'crawl') {
      const scrollY = H - this.t * 34;
      let y = scrollY;
      ctx.textAlign = 'center';
      for (const [kind, text] of LINES) {
        if (kind === 'gap') { y += 44; continue; }
        if (y > -60 && y < H + 60) {
          if (kind === 'title') { font(ctx, 44, 'title'); ctx.fillStyle = '#f7eeda'; }
          else if (kind === 'title2') { font(ctx, 38, 'title'); ctx.fillStyle = '#f7eeda'; }
          else if (kind === 'sub') { font(ctx, 22); ctx.fillStyle = 'rgba(247,238,218,0.75)'; }
          else if (kind === 'h') { font(ctx, 18); ctx.fillStyle = 'rgba(200,90,84,0.95)'; }
          else { font(ctx, 24); ctx.fillStyle = 'rgba(247,238,218,0.92)'; }
          ctx.fillText(text, W / 2, y);
        }
        y += 44;
      }
      ctx.textAlign = 'left';
      return;
    }

    // stinger: the quilt, one new patch
    const a = IMG.cut_quilt;
    const k = Math.min(1, this.stingerT / 2);
    const sc = Math.max(W / a.w, H / a.h);
    ctx.globalAlpha = k;
    ctx.drawImage(a.el, W / 2 - a.w * sc / 2, H / 2 - a.h * sc / 2, a.w * sc, a.h * sc);
    ctx.fillStyle = 'rgba(10,8,7,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    if (this.stingerT > 1.2) {
      font(ctx, 24);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(247,238,218,${Math.min(1, (this.stingerT - 1.2) / 1.5)})`;
      ctx.fillText('On the quilt, this morning: one new patch.', W / 2, H / 2 - 20);
      if (this.stingerT > 2.6) {
        ctx.fillStyle = `rgba(247,238,218,${Math.min(1, (this.stingerT - 2.6) / 1.5)})`;
        ctx.fillText('A little lighthouse. Lit.', W / 2, H / 2 + 24);
      }
      ctx.textAlign = 'left';
    }
  }
}
