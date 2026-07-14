// Title screen: painted backdrop, stitched title, press-any-key, then menu.

import { W, H } from '../engine/core.js';
import { Input } from '../engine/input.js';
import { Audio } from '../engine/audio.js';
import { img } from '../engine/assets.js';
import { panel, font, Menu, theme, setTheme, drawCursor } from '../engine/ui.js';
import { G } from './state.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.state = 'press'; // 'press' -> 'menu'
    this.menu = null;
  }

  enter() {
    setTheme('warm');
    Audio.music('mus_title');
    this.buildMenu();
  }

  buildMenu() {
    this.menu = new Menu([
      { label: 'New Game', value: 'new' },
      { label: 'Continue', value: 'continue', disabled: !G.hasSave() },
      { label: 'Volume', value: 'volume' },
    ]);
  }

  update(dt) {
    this.t += dt;
    if (this.state === 'press') {
      if (Input.anyPressed) {
        this.state = 'menu';
        Audio.sfx('sfx_ok');
      }
      return;
    }
    // menu state
    if (this.menu.selected.value === 'volume') {
      let d = 0;
      if (Input.pressed.left) d = -1;
      if (Input.pressed.right) d = 1;
      if (d) {
        G.settings.volMaster = Math.max(0, Math.min(1, G.settings.volMaster + d * 0.1));
        Audio.volumes.master = G.settings.volMaster;
        Audio.applyVolumes();
        G.saveSettings();
        Audio.sfx('sfx_move');
      }
    }
    const r = this.menu.update();
    if (r === 'ok') {
      const v = this.menu.selected.value;
      if (v === 'new') this.startNew();
      else if (v === 'continue') this.continueGame();
    } else if (r === 'cancel') {
      this.state = 'press';
    }
  }

  async startNew() {
    const { startNewGame } = await import('./flow.js');
    startNewGame(this.game);
  }

  async continueGame() {
    const { continueGame } = await import('./flow.js');
    continueGame(this.game);
  }

  draw(ctx) {
    const a = img('cut_title');
    // cover-fit backdrop with a slow drift
    const drift = Math.sin(this.t * 0.1) * 8;
    const scale = Math.max(W / a.w, H / a.h) * 1.03;
    ctx.drawImage(a.el, W / 2 - (a.w * scale) / 2 + drift, H / 2 - (a.h * scale) / 2, a.w * scale, a.h * scale);

    // soft vignette
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(20,14,10,0.55)');
    vg.addColorStop(0.35, 'rgba(20,14,10,0.05)');
    vg.addColorStop(0.8, 'rgba(20,14,10,0.25)');
    vg.addColorStop(1, 'rgba(20,14,10,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // title
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(30,20,14,0.6)';
    font(ctx, 58, 'title');
    ctx.fillText('The Last Stitch', W / 2 + 3, 154 + 3);
    ctx.fillStyle = '#f7eeda';
    ctx.fillText('The Last Stitch', W / 2, 154);
    // stitched underline
    ctx.strokeStyle = '#c85a54';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.moveTo(W / 2 - 265, 186);
    ctx.quadraticCurveTo(W / 2, 198, W / 2 + 265, 186);
    ctx.stroke();
    ctx.setLineDash([]);

    font(ctx, 23);
    ctx.fillStyle = 'rgba(247,238,218,0.85)';
    ctx.fillText('a little game about remembering', W / 2, 226);

    if (this.state === 'press') {
      if (Math.floor(this.t * 1.4) % 2 === 0) {
        font(ctx, 24);
        ctx.fillStyle = 'rgba(247,238,218,0.9)';
        ctx.fillText('— press Z —', W / 2, 560);
      }
    } else {
      const mw = 330, mh = 148, mx = W / 2 - mw / 2, my = 440;
      panel(ctx, mx, my, mw, mh);
      this.menu.draw(ctx, mx + 26, my + 34, mw - 52, { lineH: 38, size: 25 });
      // volume pips next to the Volume row
      const vy = my + 34 + 2 * 38 - 6;
      const steps = Math.round(G.settings.volMaster * 10);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i < steps ? theme.thread : 'rgba(0,0,0,0.14)';
        ctx.fillRect(mx + 150 + i * 15, vy, 10, 12);
      }
    }

    ctx.textAlign = 'left';
    font(ctx, 15);
    ctx.fillStyle = 'rgba(247,238,218,0.5)';
    ctx.fillText('v1.0', 12, H - 12);
  }
}
