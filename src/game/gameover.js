// Coming apart is not the end. Someone is holding the thread.

import { W, H } from '../engine/core.js';
import { Audio } from '../engine/audio.js';
import { IMG } from '../engine/assets.js';
import { panel, font, theme, Menu } from '../engine/ui.js';
import { G } from './state.js';

export class GameOverScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.menu = new Menu([
      { label: 'Back to the last quilt', value: 'continue', disabled: !G.hasSave() },
      { label: 'Wake at the harbour', value: 'harbor' },
      { label: 'Title', value: 'title' },
    ]);
    if (G.hasSave()) this.menu.index = 0; else this.menu.index = 1;
  }

  enter() { Audio.music('mus_gameover'); }

  async update(dt) {
    this.t += dt;
    if (this.t < 1.2) return;
    const r = this.menu.update();
    if (r === 'ok') {
      const v = this.menu.selected.value;
      const flow = await import('./flow.js');
      if (v === 'continue') flow.continueGame(this.game);
      else if (v === 'harbor') flow.respawnHarbor(this.game);
      else {
        const { TitleScene } = await import('./title.js');
        this.game.setScene(new TitleScene(this.game), { fade: 1.2 });
      }
    }
  }

  draw(ctx) {
    const a = IMG.cut_gameover;
    const sc = Math.max(W / a.w, H / a.h);
    ctx.fillStyle = '#0b0a09';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(a.el, W / 2 - a.w * sc / 2, H / 2 - a.h * sc / 2, a.w * sc, a.h * sc);
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(12,10,9,0.6)');
    g.addColorStop(0.5, 'rgba(12,10,9,0.15)');
    g.addColorStop(1, 'rgba(12,10,9,0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    font(ctx, 30);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2ede2';
    ctx.fillText('Poppy comes apart at the seams…', W / 2, 120);
    font(ctx, 22);
    ctx.fillStyle = 'rgba(242,237,226,0.8)';
    ctx.fillText('…but somebody, somewhere, is still holding the thread.', W / 2, 158);

    if (this.t >= 1.2) {
      const mw = 380, mh = 150;
      panel(ctx, W / 2 - mw / 2, 420, mw, mh);
      this.menu.draw(ctx, W / 2 - mw / 2 + 30, 456, mw - 60, { lineH: 36, size: 23 });
    }
    ctx.textAlign = 'left';
  }
}
