// Pause menu (X in the overworld): items, charms, settings, party overview.

import { W, H } from '../engine/core.js';
import { Input } from '../engine/input.js';
import { Audio } from '../engine/audio.js';
import { IMG } from '../engine/assets.js';
import { panel, font, theme, Menu } from '../engine/ui.js';
import { G } from './state.js';
import { ITEMS, CHARMS } from '../data/items.js';
import { TitleScene } from './title.js';

export class PauseMenu {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;
    this.mode = 'root';
    this.root = new Menu([
      { label: 'Stitches', value: 'items' },
      { label: 'Charms', value: 'charms' },
      { label: 'Settings', value: 'settings' },
      { label: 'To Title', value: 'title' },
      { label: 'Close', value: 'close' },
    ]);
    this.sub = null;
    this.pickMember = null; // {menu, apply}
    this.closed = false;
    this.note = null;
  }

  itemsMenu() {
    const entries = Object.entries(G.inventory).filter(([id]) => ITEMS[id]);
    return new Menu(entries.length
      ? entries.map(([id, n]) => ({ label: ITEMS[id].name, right: ITEMS[id].key ? '✦' : `×${n}`, value: id, disabled: !!ITEMS[id].key && !ITEMS[id].heal }))
      : [{ label: '(empty pockets)', value: null, disabled: true }]);
  }

  charmsMenu() {
    const owned = Object.keys(G.inventory).filter(id => CHARMS[id]);
    const items = owned.map(id => ({ label: CHARMS[id].name, right: `×${G.inventory[id]}`, value: id }));
    for (const m of G.party) {
      if (m.charm) items.push({ label: `${CHARMS[m.charm].name}`, right: `→ ${m.name}`, value: `unequip_${m.id}` });
    }
    return new Menu(items.length ? items : [{ label: '(no charms yet)', value: null, disabled: true }]);
  }

  settingsMenu() {
    return new Menu([
      { label: 'Master', value: 'volMaster' },
      { label: 'Music', value: 'volMusic' },
      { label: 'Sounds', value: 'volSfx' },
    ]);
  }

  memberMenu() {
    return new Menu(G.party.filter(m => m.inParty).map(m => ({ label: m.name, value: m.id })));
  }

  useItem(id, member) {
    const it = ITEMS[id];
    if (!it || (G.inventory[id] || 0) <= 0) return 'The pocket is empty.';
    if (it.revive) {
      if (member.hp > 0) return `${member.name} is not undone.`;
      member.hp = Math.round(member.maxHp * it.revive);
      G.removeItem(id);
      Audio.sfx('sfx_heal');
      return `${member.name} is stitched back together!`;
    }
    if (member.hp <= 0) return `${member.name} needs a Warm Sock first.`;
    let didSomething = false;
    if (it.heal && member.hp < member.maxHp) { member.hp = Math.min(member.maxHp, member.hp + it.heal); didSomething = true; }
    if (it.healAll) { for (const p of G.party) if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + it.healAll); didSomething = true; }
    if (it.giveInk && member.ink < member.maxInk) { member.ink = Math.min(member.maxInk, member.ink + it.giveInk); didSomething = true; }
    if (!didSomething) return 'That would be a waste right now.';
    G.removeItem(id);
    Audio.sfx('sfx_heal');
    return it.use || 'There.';
  }

  update(dt) {
    if (this.closed) return true;
    if (this.note) {
      if (Input.pressed.ok || Input.pressed.cancel) { this.note = null; Audio.sfx('sfx_talk', { vol: 0.5 }); }
      return false;
    }

    if (this.pickMember) {
      const r = this.pickMember.menu.update();
      if (r === 'cancel') { this.pickMember = null; return false; }
      if (r === 'ok') {
        const m = G.party.find(p => p.id === this.pickMember.menu.selected.value);
        this.note = this.pickMember.apply(m);
        this.pickMember = null;
      }
      return false;
    }

    if (this.mode === 'root') {
      const r = this.root.update();
      if (r === 'cancel') { this.closed = true; return true; }
      if (r === 'ok') {
        const v = this.root.selected.value;
        if (v === 'close') { this.closed = true; return true; }
        if (v === 'title') { this.mode = 'confirmTitle'; this.sub = new Menu([{ label: 'Stay', value: 'no' }, { label: 'Leave for the title', value: 'yes' }]); return false; }
        if (v === 'items') { this.sub = this.itemsMenu(); this.mode = 'items'; }
        if (v === 'charms') { this.sub = this.charmsMenu(); this.mode = 'charms'; }
        if (v === 'settings') { this.sub = this.settingsMenu(); this.mode = 'settings'; }
      }
      return false;
    }

    if (this.mode === 'confirmTitle') {
      const r = this.sub.update();
      if (r === 'cancel') { this.mode = 'root'; return false; }
      if (r === 'ok') {
        if (this.sub.selected.value === 'yes') {
          this.closed = true;
          Audio.stopMusic(1);
          this.game.setScene(new TitleScene(this.game), { fade: 1.2 });
          return true;
        }
        this.mode = 'root';
      }
      return false;
    }

    if (this.mode === 'items') {
      const r = this.sub.update();
      if (r === 'cancel') { this.mode = 'root'; return false; }
      if (r === 'ok' && this.sub.selected.value) {
        const id = this.sub.selected.value;
        if (ITEMS[id].key) { this.note = ITEMS[id].desc; return false; }
        this.pickMember = {
          menu: this.memberMenu(),
          apply: (m) => { const msg = this.useItem(id, m); this.sub = this.itemsMenu(); return msg; },
        };
      }
      return false;
    }

    if (this.mode === 'charms') {
      const r = this.sub.update();
      if (r === 'cancel') { this.mode = 'root'; return false; }
      if (r === 'ok' && this.sub.selected.value) {
        const v = this.sub.selected.value;
        if (v.startsWith('unequip_')) {
          const m = G.party.find(p => p.id === v.slice(8));
          if (m?.charm) { G.addItem(m.charm); delete G.charms[m.id]; m.charm = null; Audio.sfx('sfx_item'); }
          this.sub = this.charmsMenu();
          return false;
        }
        this.pickMember = {
          menu: this.memberMenu(),
          apply: (m) => {
            if (m.charm) G.addItem(m.charm);
            m.charm = v; G.charms[m.id] = v; G.removeItem(v);
            Audio.sfx('sfx_item');
            this.sub = this.charmsMenu();
            return `${m.name} wears the ${CHARMS[v].name}.`;
          },
        };
      }
      return false;
    }

    if (this.mode === 'settings') {
      const r = this.sub.update();
      if (r === 'cancel' || r === 'ok') { this.mode = 'root'; return false; }
      const key = this.sub.selected.value;
      let d = 0;
      if (Input.pressed.left) d = -0.1;
      if (Input.pressed.right) d = 0.1;
      if (d) {
        G.settings[key] = Math.max(0, Math.min(1, Math.round((G.settings[key] + d) * 10) / 10));
        Audio.volumes.master = G.settings.volMaster;
        Audio.volumes.music = G.settings.volMusic;
        Audio.volumes.sfx = G.settings.volSfx;
        Audio.applyVolumes();
        G.saveSettings();
        Audio.sfx('sfx_move');
      }
      return false;
    }
    return false;
  }

  draw(ctx) {
    ctx.fillStyle = 'rgba(20,14,10,0.45)';
    ctx.fillRect(0, 0, W, H);

    // left: menu
    panel(ctx, 28, 40, 240, 240);
    this.root.draw(ctx, 52, 74, 190, { lineH: 38, size: 24 });
    // glimmer + threads
    panel(ctx, 28, 292, 240, 84);
    font(ctx, 20);
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'left';
    ctx.fillText(`✦ ${G.glimmer} glimmer`, 52, 324);
    const th = ['thread_sun', 'thread_storm', 'thread_mist'].filter(f => G.flag(f)).length;
    ctx.fillText(`threads: ${th} / 3`, 52, 352);

    // right: party overview
    const px0 = 292, pw = 640;
    panel(ctx, px0, 40, pw, 336);
    const members = G.party.filter(m => m.inParty);
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const y = 66 + i * 104;
      const pk = IMG[`${m.def.porBase}_neutral`] ? `${m.def.porBase}_neutral` : null;
      if (pk) ctx.drawImage(IMG[pk].el, px0 + 24, y, 76, 76);
      ctx.strokeStyle = theme.panelEdge; ctx.strokeRect(px0 + 24, y, 76, 76);
      font(ctx, 22);
      ctx.fillStyle = theme.ink;
      ctx.fillText(`${m.name}`, px0 + 118, y + 22);
      font(ctx, 17);
      ctx.fillStyle = theme.inkSoft;
      ctx.fillText(`lv ${m.level}`, px0 + 118, y + 44);
      // bars
      const bx = px0 + 190;
      ctx.fillStyle = 'rgba(20,15,10,0.15)'; ctx.fillRect(bx, y + 10, 200, 13);
      ctx.fillStyle = theme.thread; ctx.fillRect(bx, y + 10, 200 * m.hp / m.maxHp, 13);
      ctx.fillStyle = 'rgba(20,15,10,0.15)'; ctx.fillRect(bx, y + 32, 200, 10);
      ctx.fillStyle = '#5a6b9e'; ctx.fillRect(bx, y + 32, 200 * m.ink / m.maxInk, 10);
      font(ctx, 16);
      ctx.fillStyle = theme.inkSoft;
      ctx.fillText(`${m.hp}/${m.maxHp}`, bx + 210, y + 22);
      ctx.fillText(`${m.ink}/${m.maxInk}`, bx + 210, y + 42);
      ctx.fillText(m.charm ? CHARMS[m.charm].name : '—', bx + 0, y + 68);
      font(ctx, 16);
      ctx.fillText(`grit ${m.grit}   guard ${m.guard}   zip ${m.zip}`, px0 + 118, y + 68);
    }

    // sub menus
    if (this.mode === 'items' || this.mode === 'charms') {
      const hh = Math.max(90, this.sub.items.length * 32 + 44);
      panel(ctx, 292, 396, 400, Math.min(hh, 230));
      this.sub.draw(ctx, 316, 428, 350, { lineH: 32, size: 21 });
      const sel = this.sub.selected;
      const d = this.mode === 'items' ? ITEMS[sel?.value]?.desc : CHARMS[sel?.value]?.desc;
      if (d) {
        panel(ctx, 292, H - 76, 640, 56);
        font(ctx, 18);
        ctx.fillStyle = theme.inkSoft;
        ctx.fillText(d, 316, H - 42);
      }
    }
    if (this.mode === 'settings') {
      panel(ctx, 292, 396, 340, 140);
      this.sub.draw(ctx, 316, 428, 290, { lineH: 34, size: 22 });
      for (let i = 0; i < this.sub.items.length; i++) {
        const key = this.sub.items[i].value;
        const steps = Math.round(G.settings[key] * 10);
        for (let k = 0; k < 10; k++) {
          ctx.fillStyle = k < steps ? theme.thread : 'rgba(0,0,0,0.14)';
          ctx.fillRect(452 + k * 14, 418 + i * 34, 9, 11);
        }
      }
    }
    if (this.mode === 'confirmTitle') {
      panel(ctx, W / 2 - 190, H / 2 - 70, 380, 140);
      font(ctx, 21);
      ctx.fillStyle = theme.ink;
      ctx.textAlign = 'center';
      ctx.fillText('Leave the Patchwork for now?', W / 2, H / 2 - 30);
      ctx.textAlign = 'left';
      this.sub.draw(ctx, W / 2 - 150, H / 2 + 4, 300, { lineH: 32, size: 21 });
    }
    if (this.pickMember) {
      panel(ctx, 460, 430, 260, this.pickMember.menu.items.length * 34 + 40);
      this.pickMember.menu.draw(ctx, 486, 462, 210, { lineH: 34, size: 22 });
    }
    if (this.note) {
      font(ctx, 21);
      const tw = Math.min(700, ctx.measureText(this.note).width + 60);
      panel(ctx, W / 2 - tw / 2, H - 120, tw, 64);
      ctx.fillStyle = theme.ink;
      ctx.textAlign = 'center';
      ctx.fillText(this.note, W / 2, H - 80);
      ctx.textAlign = 'left';
    }
  }
}
