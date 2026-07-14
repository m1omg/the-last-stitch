// Mrs. Thimble's stall. Buy stitches and charms with glimmer.

import { W, H } from '../engine/core.js';
import { Input } from '../engine/input.js';
import { Audio } from '../engine/audio.js';
import { panel, font, theme, Menu } from '../engine/ui.js';
import { G } from './state.js';
import { ITEMS, CHARMS } from '../data/items.js';

const STOCK = ['biscuit', 'tea', 'honeydrop', 'buttonshine', 'jamtoast', 'warmsock',
  'charm_thimble', 'charm_ribbon', 'charm_acorn', 'charm_locket', 'charm_teacosy'];

function defOf(id) { return ITEMS[id] || CHARMS[id]; }

export class ShopUI {
  constructor(scene) {
    this.scene = scene;
    this.closed = false;
    this.note = null;
    this.rebuild();
  }

  rebuild() {
    this.menu = new Menu(STOCK.map(id => {
      const d = defOf(id);
      const isCharm = !!CHARMS[id];
      const owned = isCharm && ((G.inventory[id] || 0) > 0 || Object.values(G.charms).includes(id));
      return {
        label: d.name,
        right: owned ? 'owned' : `${d.price}✦`,
        value: id,
        disabled: owned,
      };
    }).concat([{ label: 'That’s all, thank you', value: null }]));
  }

  update(dt) {
    if (this.closed) return true;
    if (this.note) {
      if (Input.pressed.ok || Input.pressed.cancel) this.note = null;
      return false;
    }
    const r = this.menu.update();
    if (r === 'cancel') { this.closed = true; return true; }
    if (r === 'ok') {
      const id = this.menu.selected.value;
      if (!id) { this.closed = true; return true; }
      const d = defOf(id);
      if (G.glimmer < d.price) {
        this.note = 'Not enough glimmer, dear. Go be nice to some monsters.';
        Audio.sfx('sfx_cancel');
        return false;
      }
      G.glimmer -= d.price;
      G.addItem(id);
      Audio.sfx('sfx_item');
      this.note = `One ${d.name}, wrapped with love.`;
      this.rebuild();
    }
    return false;
  }

  draw(ctx) {
    ctx.fillStyle = 'rgba(20,14,10,0.45)';
    ctx.fillRect(0, 0, W, H);
    panel(ctx, 200, 60, 560, Math.min(470, this.menu.items.length * 32 + 70));
    font(ctx, 24);
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'left';
    ctx.fillText('— Thimble & Daughters, est. whenever —', 232, 98);
    this.menu.draw(ctx, 232, 134, 500, { lineH: 32, size: 21 });
    // glimmer
    panel(ctx, 200, 544, 220, 52);
    font(ctx, 21);
    ctx.fillStyle = theme.ink;
    ctx.fillText(`✦ ${G.glimmer} glimmer`, 226, 578);
    // description
    const sel = this.menu.selected;
    const d = sel?.value ? defOf(sel.value)?.desc : null;
    if (d) {
      panel(ctx, 436, 544, 420, 52);
      font(ctx, 17);
      ctx.fillStyle = theme.inkSoft;
      ctx.fillText(d, 458, 577);
    }
    if (this.note) {
      font(ctx, 21);
      const tw = Math.min(720, ctx.measureText(this.note).width + 60);
      panel(ctx, W / 2 - tw / 2, H - 110, tw, 60);
      ctx.fillStyle = theme.ink;
      ctx.textAlign = 'center';
      ctx.fillText(this.note, W / 2, H - 72);
      ctx.textAlign = 'left';
    }
  }
}
