// Battle scene: renders/animates the pure battle_logic state machine.
// Layout: painted backdrop, enemies mid-stage, party status cards along the
// bottom, command menus bottom-left, event text in a top banner.

import { W, H } from '../engine/core.js';
import { Input } from '../engine/input.js';
import { Audio } from '../engine/audio.js';
import { IMG } from '../engine/assets.js';
import { panel, font, theme, Menu, drawCursor, roundRect } from '../engine/ui.js';
import { G } from './state.js';
import {
  makeBattle, beginRound, peekActor, popActor, partyAct, enemyAct, battleRewards, effZip,
} from './battle_logic.js';
import { SKILLS } from '../data/skills.js';
import { ITEMS } from '../data/items.js';
import { memberSkills, grantXp, resetBattleState } from '../data/party.js';

const ENEMY_POS = {
  1: [[480, 385]],
  2: [[330, 372], [630, 385]],
  3: [[240, 362], [480, 385], [720, 368]],
  4: [[180, 356], [380, 385], [580, 362], [780, 380]],
};
const CARD_W = 296, CARD_H = 118, CARD_Y = 508;

const MOOD_COLOR = { sunny: '#e0a33b', stormy: '#5a6b9e', misty: '#7fa3a8' };
const MOOD_LABEL = { sunny: 'SUNNY', stormy: 'STORMY', misty: 'MISTY' };

// The Fog, phase 2: not a fight — an answering. Four rounds, no damage dealt
// or dealable; the party fades and is reminded back.
const RITUAL = [
  {
    prompt: 'The white waits.',
    options: [
      { label: 'Hold On', lines: ['"of course you hold on. she held on too, at first," says the voice you know.', '"it gets so heavy, love."'] },
      { label: 'Let Go', lines: ['"not yet, little stitch. letting go is not dropping."', '"you will learn the difference, later. everyone does."'] },
    ],
    whiteout: true,
  },
  {
    prompt: 'The white leans in.',
    options: [
      { label: 'Remember', remember: true, lines: ['"…stop that," says the Fog, and for a moment it sounds afraid.', '"those are HERS. put them DOWN."', '"…please."'] },
    ],
  },
  {
    prompt: 'The white is very close now. It smells of lavender.',
    options: [
      { label: 'Hold On', lines: ['"I am so tired, love," says the Fog, in her voice. "she is so tired."', '"you cannot carry all of it. no one can carry all of it."'] },
      { label: 'Let Go', lines: ['"…almost," says the Fog gently. "that is almost it."', '"you cannot keep all of it. but oh, little stitch — you can keep SOME."'] },
    ],
    captainLine: '"Not all of it, no," says the Captain, very quietly. "Just the middle. SING, Poppy."',
  },
  {
    prompt: 'Everything is white. Except the lamp. Except you.',
    options: [
      { label: 'Sing', sing: true, lines: ['Poppy closes her eyes, finds the count — one, two, three — and sings the middle of the song.'] },
    ],
  },
];

export class BattleScene {
  constructor(game, opts) {
    this.game = game;
    this.opts = opts;
    this.onEnd = opts.onEnd || (() => {});
    this.t = 0;
  }

  enter() {
    const party = G.party.filter(m => m.inParty);
    for (const m of party) resetBattleState(m);
    this.state = makeBattle({
      party,
      enemyIds: this.opts.enemyIds,
      rng: () => G.rand(),
      inventory: G.inventory,
      canFlee: this.opts.canFlee ?? true,
      scripted: this.opts.scripted || null,
    });
    Audio.music(this.opts.music || 'mus_battle');
    Audio.sfx('sfx_battlestart');

    this.mode = 'events';          // events | command | skill | item | talkopt | target
    this.queue = [];
    this.banner = null;            // { text, t, dwell, sticky }
    this.floaters = [];            // { x, y, txt, color, t }
    this.fx = new Map();           // enemyKey -> { flash, deadT, leaveT, spawnT }
    this.actor = null;             // current party actor
    this.menus = {};
    this.pendingAction = null;     // action being built (needs target)
    this.targetSide = 'enemy';
    this.targetIdx = 0;
    this.result = null;
    this.outroDone = false;
    this.shotFreeze = false;       // ?shot= harness: freeze animation clock

    this.ritual = this.opts.ritual ? { round: 0 } : null;
    for (const e of this.state.enemies) {
      this.queue.push({ t: 'text', msg: e.def.intro || `${e.name} appears!` });
    }
    if (!this.ritual) this.queue.push(...beginRound(this.state));
  }

  exit() { /* music handled by caller */ }

  // ——— helpers ———

  livingEnemies() { return this.state.enemies.filter(e => e.hp > 0 && !e.gone); }
  livingParty() { return this.state.party.filter(m => m.hp > 0); }

  enemyPos(e) {
    const live = this.state.enemies.filter(x => (x.hp > 0 && !x.gone) || this.fx.get(x.key)?.deadT != null || this.fx.get(x.key)?.leaveT != null);
    const idx = live.indexOf(e);
    const n = Math.max(1, Math.min(4, live.length));
    const pos = ENEMY_POS[n] || ENEMY_POS[3];
    return pos[Math.max(0, Math.min(pos.length - 1, idx))];
  }

  cardX(i) { return 24 + i * (CARD_W + 12); }

  // ——— event playback ———

  playEvent(ev) {
    const fxFor = (ref) => {
      if (!this.fx.has(ref.key)) this.fx.set(ref.key, {});
      return this.fx.get(ref.key);
    };
    switch (ev.t) {
      case 'text':
        this.banner = { text: ev.msg, t: 0, dwell: Math.max(0.9, ev.msg.length * 0.028) };
        return true;
      case 'move': {
        const who = ev.ref.name;
        this.banner = { text: `${who} — ${ev.name}!`, t: 0, dwell: 0.65 };
        if (ev.side === 'party') Audio.sfx('sfx_ok', { rate: 1.2, vol: 0.5 });
        return true;
      }
      case 'dmg': {
        const [ex, ey] = ev.side === 'enemy' ? this.enemyPos(ev.ref) : [this.cardX(this.state.party.indexOf(ev.ref)) + CARD_W / 2, CARD_Y + 20];
        if (ev.miss) {
          this.floaters.push({ x: ex, y: ey - 60, txt: 'whiff!', color: '#9a9a98', t: 0 });
          this.banner = { text: `${ev.ref.name} skips out of the way!`, t: 0, dwell: 0.55 };
          return true;
        }
        const col = ev.amount === 0 ? '#9a9a98' : ev.crit ? '#e0a33b' : ev.side === 'enemy' ? '#f7eeda' : '#c85a54';
        this.floaters.push({ x: ex, y: ey - 60, txt: String(ev.amount), color: col, t: 0, big: ev.crit });
        if (ev.side === 'enemy') fxFor(ev.ref).flash = 0.22;
        if (ev.amount > 0) {
          Audio.sfx('sfx_hit', { rate: ev.side === 'enemy' ? 1.0 : 0.85 });
          if (ev.side === 'party') this.game.shake(5, 0.22);
          if (ev.crit) { this.game.shake(8, 0.3); this.banner = { text: 'A lucky stitch!', t: 0, dwell: 0.5 }; }
        }
        if (ev.eff === 'win') this.banner = { text: 'The weather is right! Extra damage!', t: 0, dwell: 0.55 };
        if (ev.eff === 'lose') this.banner = { text: 'The weather is against it…', t: 0, dwell: 0.5 };
        return true;
      }
      case 'heal': {
        if (ev.quiet) return false;
        const [ex, ey] = ev.side === 'enemy' ? this.enemyPos(ev.ref) : [this.cardX(this.state.party.indexOf(ev.ref)) + CARD_W / 2, CARD_Y + 20];
        this.floaters.push({ x: ex, y: ey - 50, txt: `+${ev.amount}`, color: '#5e8c4a', t: 0 });
        Audio.sfx('sfx_heal');
        return true;
      }
      case 'ink': {
        const i = this.state.party.indexOf(ev.ref);
        this.floaters.push({ x: this.cardX(i) + CARD_W / 2, y: CARD_Y + 8, txt: `+${ev.amount} ink`, color: '#5a6b9e', t: 0 });
        Audio.sfx('sfx_heal', { rate: 1.3, vol: 0.6 });
        return true;
      }
      case 'mood': {
        const label = ev.mood ? `${ev.ref.name} feels ${MOOD_LABEL[ev.mood]}!` : `${ev.ref.name}'s mood settles.`;
        this.banner = { text: label, t: 0, dwell: 0.7 };
        Audio.sfx('sfx_talk', { rate: ev.mood === 'stormy' ? 0.8 : 1.2, vol: 0.5 });
        return true;
      }
      case 'fade': {
        this.banner = { text: `${ev.ref.name} is fading… (${ev.stacks})`, t: 0, dwell: 0.9 };
        Audio.sfx('sfx_fade');
        return true;
      }
      case 'forget': {
        this.banner = { text: `${ev.ref.name} forgot how to use ${ev.name}…!`, t: 0, dwell: 1.4 };
        this.game.flash('#eeeeea', 0.25);
        Audio.sfx('sfx_static', { vol: 0.7 });
        return true;
      }
      case 'remind': {
        if (ev.quiet) return false;
        this.banner = { text: ev.line, t: 0, dwell: Math.max(1.4, ev.line.length * 0.03), remind: true };
        Audio.sfx('sfx_remind');
        return true;
      }
      case 'die': {
        if (ev.side === 'enemy') {
          fxFor(ev.ref).deadT = 0;
          Audio.sfx('sfx_unravel', { rate: 1.1 });
          this.banner = { text: `${ev.ref.name} comes undone.`, t: 0, dwell: 0.8 };
        } else {
          Audio.sfx('sfx_unravel', { rate: 0.7 });
          this.game.shake(7, 0.4);
        }
        return true;
      }
      case 'leave': {
        fxFor(ev.ref).leaveT = 0;
        Audio.sfx('sfx_flutter');
        this.banner = { text: `${ev.ref.name} leaves in peace.`, t: 0, dwell: 0.9 };
        return true;
      }
      case 'summon': {
        fxFor(ev.ref).spawnT = 0;
        this.banner = { text: `${ev.ref.name} joins the fray!`, t: 0, dwell: 0.8 };
        return true;
      }
      case 'phase': {
        this.banner = { text: ev.text, t: 0, dwell: 1.3 };
        this.game.shake(9, 0.5);
        Audio.sfx('sfx_battlestart', { rate: 0.8 });
        return true;
      }
      case 'calm': this.banner = { text: `${ev.ref.name} settles down…`, t: 0, dwell: 0.7 }; return true;
      case 'enrage': this.banner = { text: `${ev.ref.name} bristles with fury!`, t: 0, dwell: 0.8 }; this.game.shake(4, 0.25); return true;
      case 'guard': this.banner = { text: `${ev.ref.name} braces, needle up.`, t: 0, dwell: 0.6 }; return true;
      case 'end': {
        this.result = ev.result;
        return false;
      }
      default: return false;
    }
  }

  // ——— turn flow ———

  advanceFlow() {
    // called when the event queue is drained and no banner is showing
    if (this.result === 'defeat') { this.finish('defeat'); return; }
    if (this.result === 'fled') { this.finish('fled'); return; }
    if (this.result === 'victory') { this.victoryFlow(); return; }

    if (this.ritual) {
      if (this.ritual.round >= RITUAL.length) { this.finish('victory'); return; }
      const round = RITUAL[this.ritual.round];
      this.menus.ritual = new Menu(round.options.map((o, i) => ({ label: o.label, value: i })));
      this.mode = 'ritual';
      return;
    }

    let actor = peekActor(this.state);
    if (!actor) {
      this.queue.push(...beginRound(this.state));
      actor = peekActor(this.state);
      if (!actor) return; // everything died simultaneously; end events queued
    }
    if (actor.side === 'enemy') {
      const ev = enemyAct(this.state, actor.ref);
      popActor(this.state);
      this.queue.push(...ev);
    } else {
      this.actor = actor.ref;
      this.openCommand();
    }
  }

  victoryFlow() {
    if (this.outroDone) { this.finish('victory'); return; }
    this.outroDone = true;
    const rw = battleRewards(this.state);
    this.rewards = rw;
    G.glimmer += rw.glimmer;
    const ups = grantXp(this.state.party, rw.xp);
    if (rw.peaceful) this.queue.push({ t: 'text', msg: 'Nobody had to come undone. The moment mends itself.' });
    else this.queue.push({ t: 'text', msg: 'The moment is mended!' });
    if (rw.xp) this.queue.push({ t: 'text', msg: `Everyone grows by ${rw.xp} stitches.` });
    if (rw.glimmer) this.queue.push({ t: 'text', msg: `Found ${rw.glimmer} glimmer.` });
    for (const up of ups) {
      this.queue.push({ t: 'text', msg: `${up.name} reached level ${up.level}!` });
      for (const sk of up.learned) this.queue.push({ t: 'text', msg: `${up.name} learned ${SKILLS[sk].name}!` });
      Audio.sfx('sfx_levelup');
    }
  }

  finish(result) {
    if (this.finished) return; // the scene keeps updating under the fade-out
    this.finished = true;
    this.onEnd(result, this.rewards);
  }

  // ——— command menus ———

  openCommand() {
    this.mode = 'command';
    const m = this.actor;
    const items = [
      { label: 'Fight', value: 'fight' },
      { label: 'Skill', value: 'skill', disabled: memberSkills(m).length === 0 },
      { label: 'Remind', value: 'remind' },
      { label: 'Stitch', value: 'item', disabled: !Object.keys(G.inventory).some(k => ITEMS[k] && !ITEMS[k].key) },
      { label: 'Talk', value: 'talk', disabled: !this.livingEnemies().some(e => e.def.talk?.length) },
      { label: 'Guard', value: 'guard' },
      { label: 'Run', value: 'flee', disabled: !this.state.canFlee },
    ];
    this.menus.command = new Menu(items);
  }

  openSkillMenu() {
    const m = this.actor;
    const items = memberSkills(m).map(id => ({
      label: SKILLS[id].name,
      right: SKILLS[id].ink ? `${SKILLS[id].ink}◆` : '',
      value: id,
      disabled: m.ink < SKILLS[id].ink,
    }));
    this.menus.skill = new Menu(items);
    this.mode = 'skill';
  }

  openItemMenu() {
    const items = Object.entries(G.inventory)
      .filter(([id]) => ITEMS[id] && !ITEMS[id].key)
      .map(([id, n]) => ({ label: ITEMS[id].name, right: `×${n}`, value: id }));
    this.menus.item = new Menu(items);
    this.mode = 'item';
  }

  openTalkTarget() {
    this.pendingAction = { type: 'talk' };
    this.targetSide = 'enemy';
    this.targetIdx = 0;
    this.mode = 'target';
  }

  openTalkOptions(enemy) {
    this.pendingAction = { type: 'talk', target: enemy };
    this.menus.talk = new Menu(enemy.def.talk.map((o, i) => ({ label: o.label, value: i })));
    this.mode = 'talkopt';
  }

  needsTarget(action) {
    if (action.type === 'attack') return this.livingEnemies().length > 1 ? 'enemy' : null;
    if (action.type === 'remind') return this.livingParty().length > 1 ? 'party' : null;
    if (action.type === 'skill') {
      const sk = SKILLS[action.id];
      if (sk.target === 'enemy') return this.livingEnemies().length > 1 ? 'enemy' : null;
      if (sk.target === 'ally') return this.livingParty().length > 1 ? 'party' : null;
      if (sk.target === 'downedAlly') return 'downed';
      return null;
    }
    if (action.type === 'item') {
      const it = ITEMS[action.id];
      if (it.revive) return 'downed';
      if (it.heal || it.giveInk || it.cureFade) return this.livingParty().length > 1 ? 'party' : null;
      return null;
    }
    return null;
  }

  commitAction(action) {
    // fill default targets
    if (!action.target) {
      if (action.type === 'attack' || (action.type === 'skill' && SKILLS[action.id]?.target === 'enemy')) {
        action.target = this.livingEnemies()[0];
      } else if (action.type === 'remind' || action.type === 'item' || action.type === 'skill') {
        action.target = this.actor;
      }
    }
    const ev = partyAct(this.state, this.actor, action);
    popActor(this.state);
    this.queue.push(...ev);
    this.mode = 'events';
    this.actor = null;
    this.pendingAction = null;
  }

  // ——— update ———

  update(dt) {
    if (!this.shotFreeze) this.t += dt;
    for (const f of this.fx.values()) {
      if (f.flash > 0) f.flash -= dt;
      if (f.deadT != null) f.deadT += dt;
      if (f.leaveT != null) f.leaveT += dt;
      if (f.spawnT != null) f.spawnT += dt;
    }
    this.floaters = this.floaters.filter(f => (f.t += dt) < 1.0);

    if (this.mode === 'events') {
      if (this.banner) {
        this.banner.t += dt;
        if (Input.pressed.ok) this.banner.t = Math.max(this.banner.t, this.banner.dwell);
        if (this.banner.t < this.banner.dwell) return;
        this.banner = null;
      }
      // drain next visible event
      while (this.queue.length) {
        const ev = this.queue.shift();
        const shown = this.playEvent(ev);
        if (shown) return; // wait for its dwell
      }
      this.advanceFlow();
      return;
    }

    if (this.mode === 'command') {
      const r = this.menus.command.update();
      if (r === 'ok') {
        switch (this.menus.command.selected.value) {
          case 'fight': {
            const need = this.needsTarget({ type: 'attack' });
            if (need) { this.pendingAction = { type: 'attack' }; this.targetSide = 'enemy'; this.targetIdx = 0; this.mode = 'target'; }
            else this.commitAction({ type: 'attack' });
            break;
          }
          case 'skill': this.openSkillMenu(); break;
          case 'remind': {
            const need = this.needsTarget({ type: 'remind' });
            if (need) { this.pendingAction = { type: 'remind' }; this.targetSide = 'party'; this.targetIdx = 0; this.mode = 'target'; }
            else this.commitAction({ type: 'remind' });
            break;
          }
          case 'item': this.openItemMenu(); break;
          case 'talk': this.openTalkTarget(); break;
          case 'guard': this.commitAction({ type: 'guard' }); break;
          case 'flee': this.commitAction({ type: 'flee' }); break;
        }
      }
      return;
    }

    if (this.mode === 'skill') {
      const r = this.menus.skill.update();
      if (r === 'cancel') { this.mode = 'command'; return; }
      if (r === 'ok') {
        const id = this.menus.skill.selected.value;
        const action = { type: 'skill', id };
        const need = this.needsTarget(action);
        if (need) { this.pendingAction = action; this.targetSide = need === 'enemy' ? 'enemy' : 'party'; this.targetIdx = 0; this.mode = 'target'; }
        else this.commitAction(action);
      }
      return;
    }

    if (this.mode === 'item') {
      const r = this.menus.item.update();
      if (r === 'cancel') { this.mode = 'command'; return; }
      if (r === 'ok') {
        const id = this.menus.item.selected.value;
        const action = { type: 'item', id };
        const need = this.needsTarget(action);
        if (need) { this.pendingAction = action; this.targetSide = need === 'downed' ? 'downed' : 'party'; this.targetIdx = 0; this.mode = 'target'; }
        else this.commitAction(action);
      }
      return;
    }

    if (this.mode === 'talkopt') {
      const r = this.menus.talk.update();
      if (r === 'cancel') { this.mode = 'command'; return; }
      if (r === 'ok') {
        this.commitAction({ type: 'talk', target: this.pendingAction.target, optIdx: this.menus.talk.selected.value });
      }
      return;
    }

    if (this.mode === 'ritual') {
      const r = this.menus.ritual.update();
      if (r === 'ok') {
        const round = RITUAL[this.ritual.round];
        const opt = round.options[this.menus.ritual.selected.value];
        this.queue.push({ t: 'text', msg: `Poppy — ${opt.label}.` });
        if (opt.remember) {
          for (const m of this.state.party.filter(p => p.hp > 0)) {
            const ev = partyAct(this.state, m, { type: 'remind', target: m });
            this.queue.push(...ev.filter(e => e.t === 'remind'));
          }
        }
        for (const line of opt.lines) this.queue.push({ t: 'text', msg: line });
        if (round.whiteout) {
          for (const m of this.state.party.filter(p => p.hp > 0)) {
            m.fade = Math.min(3, m.fade + 1);
            this.queue.push({ t: 'fade', ref: m, stacks: m.fade });
          }
          this.queue.push({ t: 'text', msg: 'The white passes through everyone like a season.' });
        }
        if (round.captainLine) this.queue.push({ t: 'text', msg: round.captainLine });
        if (opt.sing) {
          this.queue.push({ t: 'text', msg: 'One, two, three. One, two, three.' });
        }
        this.ritual.round++;
        this.mode = 'events';
      }
      return;
    }

    if (this.mode === 'target') {
      const pool = this.targetSide === 'enemy' ? this.livingEnemies()
        : this.targetSide === 'downed' ? this.state.party.filter(m => m.hp <= 0)
        : this.livingParty();
      if (!pool.length) { this.mode = 'command'; return; }
      this.targetIdx = (this.targetIdx + pool.length) % pool.length;
      if (Input.pressed.left || Input.pressed.up) { this.targetIdx = (this.targetIdx - 1 + pool.length) % pool.length; Audio.sfx('sfx_move', { vol: 0.6 }); }
      if (Input.pressed.right || Input.pressed.down) { this.targetIdx = (this.targetIdx + 1) % pool.length; Audio.sfx('sfx_move', { vol: 0.6 }); }
      if (Input.pressed.cancel) { Audio.sfx('sfx_cancel'); this.mode = this.pendingAction?.type === 'talk' ? 'command' : 'command'; return; }
      if (Input.pressed.ok) {
        Audio.sfx('sfx_ok');
        const target = pool[this.targetIdx];
        if (this.pendingAction.type === 'talk' && !this.pendingAction.target) {
          if (target.def.talk?.length) this.openTalkOptions(target);
          return;
        }
        this.pendingAction.target = target;
        this.commitAction(this.pendingAction);
      }
      return;
    }
  }

  // ——— draw ———

  draw(ctx) {
    // backdrop
    const bg = IMG[this.opts.bg || 'bbg_orchard'];
    const sc = Math.max(W / bg.w, H / bg.h) * 1.02;
    ctx.drawImage(bg.el, W / 2 - bg.w * sc / 2, H / 2 - bg.h * sc / 2, bg.w * sc, bg.h * sc);
    // gentle dark band behind cards
    const g = ctx.createLinearGradient(0, H - 220, 0, H);
    g.addColorStop(0, 'rgba(20,15,10,0)');
    g.addColorStop(1, 'rgba(20,15,10,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 220, W, 220);

    this.drawEnemies(ctx);
    this.drawCards(ctx);
    this.drawMenus(ctx);
    this.drawFloaters(ctx);
    this.drawBanner(ctx);
  }

  drawEnemies(ctx) {
    for (const e of this.state.enemies) {
      const f = this.fx.get(e.key) || {};
      const gone = e.gone && f.leaveT == null;
      const fullyDead = f.deadT != null && f.deadT > 0.7;
      const fullyLeft = f.leaveT != null && f.leaveT > 0.9;
      if ((e.hp <= 0 && f.deadT == null) || gone || fullyDead || fullyLeft) continue;
      const [x, y] = this.enemyPos(e);
      const a = IMG[e.def.img];
      const hDraw = 430 * e.def.scale * (f.spawnT != null ? Math.min(1, f.spawnT * 2.5) : 1);
      const wDraw = hDraw * (a.w / a.h);
      const bob = Math.sin(this.t * 1.8 + x * 0.01) * 6;
      let alpha = 1, dy = 0, dx = 0;
      if (f.deadT != null) { alpha = Math.max(0, 1 - f.deadT / 0.7); dy = f.deadT * 40; }
      if (f.leaveT != null) { alpha = Math.max(0, 1 - f.leaveT / 0.9); dx = f.leaveT * 120; dy = -f.leaveT * 90; }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(a.el, x - wDraw / 2 + dx, y - hDraw + bob + dy, wDraw, hDraw);
      if (f.flash > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = Math.min(0.85, f.flash * 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - wDraw / 2 + dx, y - hDraw + bob + dy, wDraw, hDraw);
      }
      ctx.restore();
      // mood ring + hp sliver
      if (e.hp > 0 && !e.gone) {
        if (e.mood) {
          ctx.fillStyle = MOOD_COLOR[e.mood];
          ctx.beginPath(); ctx.arc(x + wDraw / 2 - 8, y - hDraw + 14 + bob, 7, 0, 7); ctx.fill();
        }
        const bw = Math.min(120, wDraw * 0.7);
        ctx.fillStyle = 'rgba(20,15,10,0.4)';
        ctx.fillRect(x - bw / 2, y + 12, bw, 5);
        ctx.fillStyle = theme.thread;
        ctx.fillRect(x - bw / 2, y + 12, bw * (e.hp / e.maxHp), 5);
      }
      // target cursor
      if (this.mode === 'target' && this.targetSide === 'enemy') {
        const pool = this.livingEnemies();
        if (pool[this.targetIdx] === e) {
          const bounce = Math.sin(this.t * 6) * 5;
          drawCursor(ctx, x, y - hDraw - 26 + bounce, 2.2);
          font(ctx, 20);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f7eeda';
          ctx.strokeStyle = 'rgba(20,15,10,0.7)'; ctx.lineWidth = 4;
          ctx.strokeText(e.name, x, y - hDraw - 40 + bounce);
          ctx.fillText(e.name, x, y - hDraw - 40 + bounce);
        }
      }
    }
  }

  drawCards(ctx) {
    const party = this.state.party;
    for (let i = 0; i < party.length; i++) {
      const m = party[i];
      const x = this.cardX(i);
      const lift = this.actor === m && (this.mode !== 'events') ? -12 : 0;
      const y = CARD_Y + lift;
      const dead = m.hp <= 0;
      // target cursor over cards
      const targeting = this.mode === 'target' && this.targetSide !== 'enemy';
      let isTarget = false;
      if (targeting) {
        const pool = this.targetSide === 'downed' ? party.filter(p => p.hp <= 0) : this.livingParty();
        isTarget = pool[this.targetIdx] === m;
      }
      ctx.save();
      if (dead) ctx.globalAlpha = 0.55;
      panel(ctx, x, y, CARD_W, CARD_H, isTarget ? { thread: theme.gold } : {});
      // portrait
      const pk = IMG[`${m.def.porBase}_neutral`] ? `${m.def.porBase}_neutral` : m.def.porBase;
      const alpha = Math.max(0.3, 1 - 0.22 * (m.fade || 0));
      ctx.save();
      ctx.globalAlpha *= alpha;
      if (IMG[pk]) ctx.drawImage(IMG[pk].el, x + 14, y + 14, 56, 56);
      ctx.restore();
      if (m.fade > 0) {
        ctx.fillStyle = 'rgba(230,230,226,0.35)';
        ctx.fillRect(x + 14, y + 14, 56, 56);
      }
      ctx.strokeStyle = theme.panelEdge; ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 14, y + 14, 56, 56);
      // name + mood
      font(ctx, 20);
      ctx.textAlign = 'left';
      ctx.fillStyle = theme.ink;
      ctx.fillText(m.name, x + 82, y + 30);
      if (m.mood) this.drawMoodIcon(ctx, m.mood, x + CARD_W - 26, y + 24, 10);
      if (m.guarding) { font(ctx, 15); ctx.fillStyle = theme.inkSoft; ctx.fillText('braced', x + CARD_W - 70, y + 52); }
      // bars
      this.drawBar(ctx, x + 82, y + 42, 150, 12, m.hp / m.maxHp, theme.thread, `${m.hp}`);
      this.drawBar(ctx, x + 82, y + 62, 150, 9, m.ink / m.maxInk, '#5a6b9e', `${m.ink}`);
      // fade pips
      if (m.fade > 0) {
        font(ctx, 15);
        ctx.fillStyle = theme.inkSoft;
        ctx.fillText(`fading ${'·'.repeat(m.fade)}`, x + 82, y + 94);
      }
      if (dead) {
        font(ctx, 17);
        ctx.fillStyle = theme.bad;
        ctx.fillText('come apart…', x + 82, y + 94);
      }
      if (m.rememberedTurns > 0) {
        font(ctx, 15);
        ctx.fillStyle = theme.gold;
        ctx.textAlign = 'right';
        ctx.fillText('remembered ✦', x + CARD_W - 16, y + 94);
        ctx.textAlign = 'left';
      }
      ctx.restore();
      if (isTarget) {
        const bounce = Math.sin(this.t * 6) * 4;
        drawCursor(ctx, x + CARD_W / 2, y - 16 + bounce, 1.8);
      }
    }
  }

  drawBar(ctx, x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(20,15,10,0.15)';
    roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = color;
      roundRect(ctx, x, y, Math.max(h, w * Math.max(0, Math.min(1, frac))), h, h / 2); ctx.fill();
    }
    if (label != null) {
      font(ctx, 15);
      ctx.fillStyle = theme.inkSoft;
      ctx.textAlign = 'left';
      ctx.fillText(label, x + w + 8, y + h - 1);
    }
  }

  drawMoodIcon(ctx, mood, x, y, r) {
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = MOOD_COLOR[mood];
    ctx.lineWidth = 2;
    if (mood === 'sunny') {
      ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75);
        ctx.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15);
        ctx.stroke();
      }
    } else if (mood === 'stormy') {
      ctx.beginPath();
      ctx.arc(x - r * 0.4, y, r * 0.5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(x + r * 0.15, y - r * 0.45, r * 0.55, Math.PI * 0.9, Math.PI * 1.9);
      ctx.arc(x + r * 0.55, y, r * 0.45, Math.PI * 1.5, Math.PI * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.3); ctx.lineTo(x - r * 0.3, y + r * 0.9); ctx.lineTo(x + r * 0.05, y + r * 0.8); ctx.lineTo(x - r * 0.15, y + r * 1.35);
      ctx.stroke();
    } else {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - r, y - r * 0.5 + i * r * 0.5);
        ctx.bezierCurveTo(x - r * 0.4, y - r * 0.8 + i * r * 0.5, x + r * 0.4, y - r * 0.2 + i * r * 0.5, x + r, y - r * 0.5 + i * r * 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawMenus(ctx) {
    const my = 300;
    if (this.mode === 'command') {
      panel(ctx, 24, my, 190, 196);
      font(ctx, 21);
      this.menus.command.draw(ctx, 44, my + 26, 150, { lineH: 26, size: 21 });
    }
    if (this.mode === 'skill' || this.mode === 'item') {
      const menu = this.mode === 'skill' ? this.menus.skill : this.menus.item;
      const hh = Math.max(70, menu.items.length * 28 + 40);
      panel(ctx, 24, my, 280, hh);
      menu.draw(ctx, 44, my + 28, 240, { lineH: 28, size: 21 });
      // footer: description
      const sel = menu.selected;
      const d = this.mode === 'skill' ? SKILLS[sel?.value]?.desc : ITEMS[sel?.value]?.desc;
      if (d) {
        panel(ctx, 24, my + hh + 8, 420, 58);
        font(ctx, 18);
        ctx.fillStyle = theme.inkSoft;
        ctx.textAlign = 'left';
        ctx.fillText(d, 44, my + hh + 42);
      }
    }
    if (this.mode === 'talkopt') {
      const menu = this.menus.talk;
      const wMax = 340;
      const hh = menu.items.length * 30 + 40;
      panel(ctx, 24, my, wMax, hh);
      menu.draw(ctx, 44, my + 28, wMax - 60, { lineH: 30, size: 21 });
    }
    if (this.mode === 'ritual') {
      const round = RITUAL[this.ritual.round];
      font(ctx, 23);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f7eeda';
      ctx.strokeStyle = 'rgba(20,15,10,0.6)'; ctx.lineWidth = 5;
      ctx.strokeText(round.prompt, W / 2, 150);
      ctx.fillText(round.prompt, W / 2, 150);
      ctx.textAlign = 'left';
      const menu = this.menus.ritual;
      const mw = 300, mh = menu.items.length * 40 + 40;
      panel(ctx, W / 2 - mw / 2, 320, mw, mh, { thread: theme.gold });
      menu.draw(ctx, W / 2 - mw / 2 + 34, 352, mw - 68, { lineH: 40, size: 26 });
    }
  }

  drawFloaters(ctx) {
    for (const f of this.floaters) {
      const k = f.t;
      ctx.save();
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      font(ctx, f.big ? 40 : 30);
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(20,15,10,0.75)';
      ctx.lineWidth = 5;
      const y = f.y - k * 46;
      ctx.strokeText(f.txt, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.txt, f.x, y);
      ctx.restore();
    }
  }

  drawBanner(ctx) {
    if (!this.banner) return;
    font(ctx, 22);
    const tw = Math.min(820, ctx.measureText(this.banner.text).width + 60);
    // wrap long banner text
    const x = W / 2 - tw / 2;
    const lines = [];
    {
      const words = this.banner.text.split(' ');
      let cur = '';
      for (const wd of words) {
        const t2 = cur ? cur + ' ' + wd : wd;
        if (ctx.measureText(t2).width > tw - 50 && cur) { lines.push(cur); cur = wd; }
        else cur = t2;
      }
      if (cur) lines.push(cur);
    }
    const hh = 26 + lines.length * 28;
    panel(ctx, x, 16, tw, hh, this.banner.remind ? { thread: theme.gold } : {});
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'center';
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, 46 + i * 28);
  }
}
