// Overworld: painted-backdrop maps, free movement with grid collision, party
// followers, roaming enemies, interactables, triggers — plus the StoryRunner
// that executes story.js scripts (dialogue, stills, battles, transfers).

import { W, H } from '../engine/core.js';
import { Input } from '../engine/input.js';
import { Audio } from '../engine/audio.js';
import { IMG, img } from '../engine/assets.js';
import { panel, font, theme, setTheme, drawCursor } from '../engine/ui.js';
import { Dialogue } from '../engine/dialogue.js';
import { G } from './state.js';
import { MAPS } from '../data/maps.js';
import { STORY } from '../data/story.js';
import { ENCOUNTERS } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { BattleScene } from './battle.js';
import { PauseMenu } from './menu.js';
import { ShopUI } from './shop.js';

const SPEED = 175, RUN_MULT = 1.65;
const CELL = 32;
// Sprites are drawn bottom-anchored ~this many px below their logical y (see
// the draw calls). Collision samples where the feet APPEAR, not the raw y —
// otherwise feet sink into walls below and stop short of walls above.
const FEET = 26;
const ENEMY_FEET = 24;

export class OverworldScene {
  constructor(game, mapId, spawn = null) {
    this.game = game;
    this.mapId = mapId;
    this.spawnOverride = spawn;
    this.resume = false; // set when returning from battle: don't rebuild
  }

  enter() {
    const map = this.map = MAPS[this.mapId];
    G.mapId = this.mapId;
    setTheme(map.faded && !G.flag('white_done') ? 'faded' : 'warm');
    Audio.music(map.music);
    if (this.resume) { this.resume = false; return; }

    this.world = { w: 1536, h: 1024 };
    const sp = this.spawnOverride || map.spawn;
    this.px = sp.x; this.py = sp.y;
    // stale saves / bad overrides must never strand the player inside a wall
    if (!this.boxFree(this.px, this.py)) { this.px = map.spawn.x; this.py = map.spawn.y; }
    this.facing = 'front';
    this.moving = false;
    this.walkT = 0;
    this.trail = [];
    for (let i = 0; i < 90; i++) this.trail.push({ x: this.px, y: this.py, facing: 'front' });
    this.entities = map.entities.map(e => ({ ...e, homeX: e.x, homeY: e.y, wanderT: 0, dead: false }));
    this.story = null;
    this.menu = null;
    this.shop = null;
    this.toastT = 2.6;
    this.t = 0;
    G.pos = { x: this.px, y: this.py };
    if (this.storyOnEnter) {
      this.runStory(this.storyOnEnter);
      this.storyOnEnter = null;
    }
  }

  // ——— conditions: 'flag_a,!flag_b' ———
  condMet(cond) {
    if (!cond) return true;
    if (cond === 'threads2') return ['thread_sun', 'thread_storm', 'thread_mist'].filter(f => G.flag(f)).length >= 2;
    if (cond === 'threads3') return ['thread_sun', 'thread_storm', 'thread_mist'].every(f => G.flag(f));
    return cond.split(',').every(c => c.startsWith('!') ? !G.flag(c.slice(1)) : G.flag(c));
  }

  entityActive(e) {
    if (e.dead) return false;
    if (e.type === 'door' || e.type === 'trigger' || e.type === 'poi') return true; // gating checked at use
    return this.condMet(e.cond);
  }

  solidAt(x, y) {
    if (x < 0 || y < 0 || x >= this.world.w || y >= this.world.h) return true;
    const c = this.map.grid[Math.floor(y / CELL)]?.[Math.floor(x / CELL)];
    if (c === '#') return true;
    if (c === '~') return !this.map.boat;
    return false;
  }

  // feet box: 24×11 around the visible feet; all four corners sampled so
  // diagonal movement can't clip a corner cell (box < cell, corners suffice)
  boxFree(x, y) {
    const hw = 12, top = y + FEET - 9, bot = y + FEET + 2;
    return !this.solidAt(x - hw, top) && !this.solidAt(x + hw, top) &&
           !this.solidAt(x - hw, bot) && !this.solidAt(x + hw, bot);
  }

  onWater() {
    return this.map.grid[Math.floor((this.py + FEET) / CELL)]?.[Math.floor(this.px / CELL)] === '~';
  }

  // enemies stand on one point at their visible feet; water enemies stay on
  // water instead of ignoring walls (they used to wander straight onto land)
  enemyCanStand(e, x, y) {
    const c = this.map.grid[Math.floor((y + ENEMY_FEET) / CELL)]?.[Math.floor(x / CELL)];
    return e.water ? c === '~' : !this.solidAt(x, y + ENEMY_FEET);
  }

  runStory(id) {
    const script = STORY[id];
    if (!script) return;
    this.story = new StoryRunner(this, script({ G, game: this.game, scene: this }));
  }

  startBattle(opts, entity = null) {
    const battle = new BattleScene(this.game, {
      bg: this.map.battleBg || 'bbg_orchard',
      music: 'mus_battle',
      ...opts,
      onEnd: (result) => {
        if (result === 'defeat') {
          import('./gameover.js').then(({ GameOverScene }) => {
            this.game.setScene(new GameOverScene(this.game), { fade: 1.6, color: '#f2f2f0' });
          });
          return;
        }
        if (entity) {
          if (result === 'victory') entity.dead = true;
          else entity.cooldown = 2.2; // fled: back off
        }
        this.resume = true;
        this.game.setScene(this, { fade: 0.6 });
        if (opts.onWin && result === 'victory') opts.onWin();
      },
    });
    this.game.setScene(battle, { fade: 0.5, color: '#1a1512' });
  }

  interactTarget() {
    const fx = this.px + (this.facing === 'side_l' ? -46 : this.facing === 'side_r' ? 46 : 0);
    const fy = this.py + (this.facing === 'front' ? 42 : this.facing === 'back' ? -42 : 0);
    let best = null, bd = 1e9;
    for (const e of this.entities) {
      if (!this.entityActive(e) || !(e.talk || e.shop || e.type === 'save')) continue;
      if (e.cond && !this.condMet(e.cond)) continue;
      const r = e.big ? 115 : 60;
      for (const [qx, qy] of [[fx, fy], [this.px, this.py]]) {
        const d = Math.hypot(e.x - qx, e.y - qy);
        if (d < r && d < bd) { bd = d; best = e; }
      }
    }
    return best;
  }

  update(dt) {
    this.t += dt;
    G.playSeconds += dt;
    if (this.toastT > 0) this.toastT -= dt;
    if (this.leaving) return; // mid door-transfer: freeze until the fade swaps scenes

    if (this.story) {
      if (this.story.update(dt)) this.story = null;
      return;
    }
    if (this.shop) { if (this.shop.update(dt)) this.shop = null; return; }
    if (this.menu) { if (this.menu.update(dt)) this.menu = null; return; }

    if (Input.pressed.cancel) { this.menu = new PauseMenu(this); Audio.sfx('sfx_ok'); return; }
    if (Input.pressed.debug) G.debugOverlay = !G.debugOverlay;

    // movement
    let dx = Input.axisX(), dy = Input.axisY();
    this.moving = !!(dx || dy);
    if (this.moving) {
      const len = Math.hypot(dx, dy);
      const sp = SPEED * (Input.held.run ? RUN_MULT : 1) * dt;
      dx = dx / len * sp; dy = dy / len * sp;
      if (this.boxFree(this.px + dx, this.py)) this.px += dx;
      if (this.boxFree(this.px, this.py + dy)) this.py += dy;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 'side_l' : 'side_r';
      else if (dy !== 0) this.facing = dy < 0 ? 'back' : 'front';
      this.walkT += dt * (Input.held.run ? 13 : 9);
      this.trail.unshift({ x: this.px, y: this.py, facing: this.facing });
      if (this.trail.length > 90) this.trail.pop();
      G.pos = { x: this.px, y: this.py };
    }

    // brush past folk instead of walking through them: a gentle push-out,
    // capped far below walk speed so it can never block a path or trap
    for (const e of this.entities) {
      if (e.type !== 'npc' || !e.spr || !this.entityActive(e)) continue;
      const ox = this.px - e.x, oy = this.py - e.y;
      const d = Math.hypot(ox, oy), r = e.big ? 44 : 30;
      if (d > 0.001 && d < r) {
        const push = Math.min(60 * dt, r - d);
        const nx = this.px + ox / d * push, ny = this.py + oy / d * push;
        if (this.boxFree(nx, ny)) { this.px = nx; this.py = ny; G.pos = { x: this.px, y: this.py }; }
      }
    }

    // triggers & doors (walk-on)
    for (const e of this.entities) {
      if (e.dead) continue;
      if (e.type === 'trigger') {
        if (e.once && G.flag(`trg_${e.id}`)) continue;
        if (!this.condMet(e.cond)) continue;
        if (Math.abs(this.px - e.x) < (e.w || 64) / 2 && Math.abs(this.py - e.y) < (e.h || 64) / 2) {
          if (e.once) G.setFlag(`trg_${e.id}`);
          this.runStory(e.script);
          return;
        }
      }
      if (e.type === 'door') {
        if (e.hidden && !this.condMet(e.cond)) continue;
        if (Math.abs(this.px - e.x) < (e.w || 64) / 2 && Math.abs(this.py - e.y) < (e.h || 64) / 2) {
          if (e.cond && !this.condMet(e.cond)) {
            // bounce back and explain — only onto free ground (an unchecked
            // bounce could shove the player inside a wall: permanent stuck)
            const away = this.py > e.y ? 26 : -26;
            for (const [bx, by] of [[0, away], [0, away * 2], [0, -away], [26, 0], [-26, 0]]) {
              if (this.boxFree(this.px + bx, this.py + by)) { this.px += bx; this.py += by; break; }
            }
            if (e.locked) this.runStory(e.locked);
            return;
          }
          const to = e.to;
          const spawn = to.x != null ? { x: to.x, y: to.y } : null;
          this.leaving = true;
          this.game.setScene(new OverworldScene(this.game, to.map, spawn), { fade: 0.8 });
          return;
        }
      }
    }

    // item pickups (walk over)
    for (const e of this.entities) {
      if (e.type !== 'item' || G.flag(e.flag)) continue;
      if (Math.hypot(this.px - e.x, this.py - e.y) < 30) {
        G.setFlag(e.flag);
        G.addItem(e.itemId, e.n || 1);
        Audio.sfx('sfx_item');
        this.story = new StoryRunner(this, [`Found ${(e.n || 1) > 1 ? (e.n || 1) + '× ' : ''}${ITEMS[e.itemId]?.name || 'something nice'}!`]);
        return;
      }
    }

    // roaming enemies
    for (const e of this.entities) {
      if (e.type !== 'enemy' || e.dead) continue;
      if (e.cooldown > 0) { e.cooldown -= dt; continue; }
      const dPlayer = Math.hypot(this.px - e.x, this.py - e.y);
      if (dPlayer < 190) {
        // drift toward player
        const sp = 55 * dt;
        const nx = e.x + (this.px - e.x) / dPlayer * sp;
        const ny = e.y + (this.py - e.y) / dPlayer * sp;
        if (this.enemyCanStand(e, nx, ny)) { e.x = nx; e.y = ny; }
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          e.wanderT = 1.2 + G.rand() * 2;
          e.tx = e.homeX + (G.rand() - 0.5) * (e.radius || 120) * 2;
          e.ty = e.homeY + (G.rand() - 0.5) * (e.radius || 120) * 2;
        }
        if (e.tx != null) {
          const d = Math.hypot(e.tx - e.x, e.ty - e.y);
          if (d > 4) {
            const sp = 30 * dt;
            const nx = e.x + (e.tx - e.x) / d * sp, ny = e.y + (e.ty - e.y) / d * sp;
            if (this.enemyCanStand(e, nx, ny)) { e.x = nx; e.y = ny; }
          }
        }
      }
      if (dPlayer < 34) {
        Audio.sfx('sfx_battlestart');
        this.startBattle({ enemyIds: [...ENCOUNTERS[e.encounter]] }, e);
        return;
      }
    }

    // interact
    if (Input.pressed.ok) {
      const e = this.interactTarget();
      if (e) {
        if (e.type === 'save') {
          for (const m of G.party) { m.hp = m.maxHp; m.ink = m.maxInk; }
          G.pos = { x: this.px, y: this.py };
          const ok = G.save();
          Audio.sfx('sfx_save');
          this.story = new StoryRunner(this, [
            ok ? 'Poppy sits on the warm quilt square a while. Everyone is mended. (Game saved.)'
               : 'The quilt is warm, but the saving needle is missing… (Could not save.)',
          ]);
        } else if (e.shop) {
          this.shop = new ShopUI(this);
          this.shop.note = '“Welcome, welcome! Mind the pins, dear.”';
        } else if (e.talk) {
          this.runStory(e.talk);
        }
        return;
      }
    }
  }

  // ——— drawing ———

  camera() {
    let cx = this.px - W / 2, cy = this.py - H / 2 - 40;
    cx = Math.max(0, Math.min(this.world.w - W, cx));
    cy = Math.max(0, Math.min(this.world.h - H, cy));
    return [Math.round(cx), Math.round(cy)];
  }

  drawSprite(ctx, key, x, y, hTarget, opts = {}) {
    const a = IMG[key] ? img(key) : null;
    if (!a) return;
    const h = hTarget, w = h * (a.w / a.h);
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
    if (opts.flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    if (opts.rot) { ctx.translate(x, y); ctx.rotate(opts.rot); ctx.translate(-x, -y); }
    ctx.drawImage(a.el, x - w / 2, y - h, w, h);
    ctx.restore();
  }

  partySpriteKey(memberId, facing) {
    const dir = facing === 'front' ? 'front' : facing === 'back' ? 'back' : 'side';
    return `spr_${memberId}_${dir}`;
  }

  draw(ctx) {
    const [cx, cy] = this.camera();
    const bg = img(this.map.img);
    ctx.drawImage(bg.el, -cx, -cy);

    // collect drawables and y-sort
    const draws = [];

    // save quilts / items / doors sparkles
    for (const e of this.entities) {
      if (e.dead) continue;
      if (e.type === 'save') {
        draws.push({ y: e.y, f: () => this.drawSprite(ctx, 'spr_savequilt', e.x - cx, e.y - cy + 26, 52) });
      } else if (e.type === 'item' && !G.flag(e.flag)) {
        const bob = Math.sin(this.t * 3 + e.x) * 4;
        draws.push({ y: e.y, f: () => {
          ctx.fillStyle = 'rgba(255,238,170,0.9)';
          ctx.beginPath(); ctx.arc(e.x - cx, e.y - cy - 14 + bob, 7, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(120,90,20,0.8)'; ctx.lineWidth = 2;
          ctx.stroke();
        } });
      } else if (e.type === 'door' && e.hidden && this.condMet(e.cond)) {
        draws.push({ y: e.y, f: () => {
          // the White Door: pale glow
          const gx = e.x - cx, gy = e.y - cy;
          const grad = ctx.createRadialGradient(gx, gy, 6, gx, gy, 70);
          grad.addColorStop(0, 'rgba(250,250,248,0.95)');
          grad.addColorStop(1, 'rgba(250,250,248,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(gx - 70, gy - 90, 140, 150);
        } });
      } else if ((e.type === 'npc' || e.type === 'poi') && e.spr && this.entityActive(e) && this.condMet(e.cond)) {
        // the Patchwork's toy-folk bob gently; real people stand/sit still
        const bob = e.type === 'npc' && !this.map.real ? Math.sin(this.t * 2.2 + e.x * 0.07) * 2.5 : 0;
        draws.push({ y: e.y, f: () => this.drawSprite(ctx, e.spr, e.x - cx, e.y - cy + 30 + bob, e.size || (e.big ? 118 : 88)) });
      } else if (e.type === 'enemy') {
        const eimg = ENCOUNTERS[e.encounter]?.[0];
        const bob = Math.sin(this.t * 3 + e.x * 0.05) * 4;
        draws.push({ y: e.y, f: () => this.drawSprite(ctx, `en_${eimg}`, e.x - cx, e.y - cy + 24 + bob, 60, { alpha: 0.92 }) });
      }
      if ((e.sparkle && this.condMet(e.cond)) && e.type === 'poi') {
        const tw = (Math.sin(this.t * 4 + e.y) + 1) / 2;
        draws.push({ y: e.y + 1, f: () => {
          ctx.save();
          ctx.globalAlpha = 0.5 + tw * 0.5;
          ctx.fillStyle = '#ffe9a8';
          const gx = e.x - cx, gy = e.y - cy - 30 - tw * 6;
          ctx.beginPath();
          ctx.moveTo(gx, gy - 8); ctx.lineTo(gx + 3, gy - 2); ctx.lineTo(gx + 9, gy);
          ctx.lineTo(gx + 3, gy + 2); ctx.lineTo(gx, gy + 8); ctx.lineTo(gx - 3, gy + 2);
          ctx.lineTo(gx - 9, gy); ctx.lineTo(gx - 3, gy - 2);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        } });
      }
    }

    // party: leader + followers along the trail
    const partyIds = G.party.filter(m => m.inParty).map(m => m.id);
    const water = this.onWater();
    for (let i = partyIds.length - 1; i >= 0; i--) {
      const id = partyIds[i];
      const node = i === 0 ? { x: this.px, y: this.py, facing: this.facing }
        : this.trail[Math.min(this.trail.length - 1, i * 26)];
      const bob = this.moving || i > 0 ? Math.abs(Math.sin(this.walkT + i)) * 5 : Math.sin(this.t * 2) * 1.5;
      const tilt = this.moving ? Math.sin(this.walkT + i) * 0.06 : 0;
      if (water && i > 0) continue; // followers ride the boat
      draws.push({
        y: node.y - i * 0.01, // stacked: leader draws on top
        f: () => {
          if (water && i === 0) this.drawSprite(ctx, 'spr_boat', node.x - cx, node.y - cy + 34 + Math.sin(this.t * 2.4) * 3, 62);
          this.drawSprite(ctx, this.partySpriteKey(id, node.facing), node.x - cx, node.y - cy + 26 - bob, 86,
            { flip: node.facing === 'side_l', rot: tilt });
        },
      });
    }

    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.f();

    // interact hint
    if (!this.story && !this.menu && !this.shop) {
      const e = this.interactTarget();
      if (e) {
        const bob = Math.sin(this.t * 5) * 3;
        font(ctx, 24);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(20,15,10,0.65)';
        ctx.beginPath(); ctx.arc(e.x - cx, e.y - cy - 74 + bob, 14, 0, 7); ctx.fill();
        ctx.fillStyle = '#f7eeda';
        ctx.fillText('!', e.x - cx, e.y - cy - 66 + bob);
      }
    }

    // soft vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(25,18,12,0)');
    vg.addColorStop(1, 'rgba(25,18,12,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // White Rooms atmosphere
    if (this.map.faded) {
      ctx.fillStyle = 'rgba(244,244,242,0.16)';
      ctx.fillRect(0, 0, W, H);
      for (const [ox, sp] of [[0, 17], [520, 26]]) {
        const gx = ((this.t * sp + ox) % (W + 500)) - 250;
        const grad = ctx.createRadialGradient(gx, 300, 40, gx, 300, 320);
        grad.addColorStop(0, 'rgba(248,248,246,0.18)');
        grad.addColorStop(1, 'rgba(248,248,246,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // collision/entity debug overlay (F1)
    if (G.debugOverlay) {
      ctx.save();
      for (let gy = 0; gy < 32; gy++) {
        for (let gx = 0; gx < 48; gx++) {
          const c = this.map.grid[gy][gx];
          if (c === '.') continue;
          ctx.fillStyle = c === '~' ? 'rgba(60,120,255,0.25)' : 'rgba(255,60,60,0.28)';
          ctx.fillRect(gx * CELL - cx, gy * CELL - cy, CELL - 1, CELL - 1);
        }
      }
      ctx.font = '11px monospace';
      for (const e of this.entities) {
        if (e.dead) continue;
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(e.x - cx - 3, e.y - cy - 3, 6, 6);
        ctx.fillText(`${e.type}:${e.id || e.encounter || e.to?.map || ''}`, e.x - cx + 6, e.y - cy - 4);
        if (e.type === 'trigger' || e.type === 'door') {
          ctx.strokeStyle = 'rgba(0,255,136,0.7)';
          ctx.strokeRect(e.x - (e.w || 64) / 2 - cx, e.y - (e.h || 64) / 2 - cy, e.w || 64, e.h || 64);
        }
      }
      // the player's actual feet box, where collision is sampled
      ctx.strokeStyle = '#ffe94a';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.px - 12 - cx, this.py + FEET - 9 - cy, 24, 11);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${Math.round(this.px)},${Math.round(this.py)} cell ${Math.floor(this.px / 32)},${Math.floor(this.py / 32)}`, 8, H - 8);
      ctx.restore();
    }

    // map name toast
    if (this.toastT > 0 && this.map.name) {
      const a = Math.min(1, this.toastT / 0.5);
      ctx.save();
      ctx.globalAlpha = a;
      font(ctx, 22);
      const tw = ctx.measureText(this.map.name).width + 44;
      panel(ctx, 18, 16, tw, 44);
      ctx.fillStyle = theme.ink;
      ctx.textAlign = 'left';
      ctx.fillText(this.map.name, 40, 45);
      ctx.restore();
    }

    // overlays
    if (this.story) this.story.draw(ctx);
    if (this.shop) this.shop.draw(ctx);
    if (this.menu) this.menu.draw(ctx);
  }
}

// ═════════════════ StoryRunner ═════════════════
// Executes story.js scripts: strings & {who,text} lines run as Dialogue,
// commands handle battles/stills/transfers/effects. {if} splices branches.

export class StoryRunner {
  constructor(scene, steps) {
    this.scene = scene;
    this.game = scene.game;
    this.queue = [...steps];
    this.ctx = { G, game: this.game, scene, choice: null };
    this.dlg = null;
    this.still = null;
    this.waitT = 0;
    this.inBattle = false;
    this.finished = false;
  }

  update(dt) {
    if (this.finished) return true;
    if (this.inBattle) return false; // resumed externally
    if (this.waitT > 0) { this.waitT -= dt; return false; }
    if (this.dlg) {
      if (!this.dlg.update(dt)) return false;
      this.ctx.choice = this.dlg.choice ?? this.ctx.choice;
      this.dlg = null;
    }
    while (!this.dlg && this.waitT <= 0 && !this.inBattle) {
      const step = this.queue.shift();
      if (step === undefined) {
        if (this.still) { this.still = null; continue; }
        this.finished = true;
        return true;
      }
      if (typeof step === 'string' || step.text != null) {
        this.dlg = new Dialogue([step], this.ctx);
        return false;
      }
      if (step._stillOff) { this.still = null; continue; }
      if (step.still) {
        this.still = step.still;
        this.queue.unshift(...(step.lines || []), { _stillOff: true });
        continue;
      }
      if (step.if) {
        const branch = step.if(this.ctx) ? step.then : step.else;
        if (branch?.length) this.queue.unshift(...branch);
        continue;
      }
      if (step.do) { step.do(this.ctx); continue; }
      if (step.battle) {
        this.inBattle = true;
        const opts = { ...step.battle };
        this.scene.startBattle({
          ...opts,
          onWin: () => { this.inBattle = false; },
        });
        // fled/defeat handled by startBattle; story resumes only on win
        return false;
      }
      if (step.goto) {
        this.finished = true;
        const to = step.goto;
        const spawn = to.x != null ? { x: to.x, y: to.y } : null;
        this.game.setScene(new OverworldScene(this.game, to.map, spawn), { fade: to.fade ?? 1.2, color: to.map === 'cottage_morning' ? '#f6f2e8' : '#0b0a09' });
        return true;
      }
      if (step.credits) {
        this.finished = true;
        import('./credits.js').then(({ CreditsScene }) => {
          this.game.setScene(new CreditsScene(this.game), { fade: 2.5, color: '#f6f2e8' });
        });
        return true;
      }
      if (step.theme) { setTheme(step.theme); continue; }
      if (step.music !== undefined) { step.music ? Audio.music(step.music) : Audio.stopMusic(1.2); continue; }
      if (step.sfx) { Audio.sfx(step.sfx); continue; }
      if (step.shake) { this.game.shake(step.shake, 0.45); continue; }
      if (step.flash) { this.game.flash(step.flash, 0.35); continue; }
      if (step.wait) { this.waitT = step.wait; return false; }
    }
    return false;
  }

  draw(ctx) {
    if (this.still) {
      const a = IMG[this.still];
      const sc = Math.max(W / a.w, H / a.h);
      ctx.fillStyle = '#0b0a09';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(a.el, W / 2 - a.w * sc / 2, H / 2 - a.h * sc / 2, a.w * sc, a.h * sc);
      // letterbox
      ctx.fillStyle = 'rgba(8,6,5,0.9)';
      ctx.fillRect(0, 0, W, 46);
      ctx.fillRect(0, H - 46, W, 46);
    }
    if (this.dlg) this.dlg.draw(ctx);
  }
}
