// Pure battle logic — no DOM, no engine imports. The battle scene animates the
// event lists this module returns; tests/sim drive it headlessly in node.
//
// Weather mood triangle: SUNNY > STORMY > MISTY > SUNNY.
// FADE stacks (party only): stat penalty, at 3 a skill is forgotten.
// Remind: spend a turn to cure an ally's FADE and print a memory.

import { BAL } from '../data/balance.js';
import { SKILLS } from '../data/skills.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEMS, CHARMS } from '../data/items.js';
import { MEMORIES } from '../data/memories.js';
import { memberSkills } from '../data/party.js';

export const MOOD_BEATS = { sunny: 'stormy', stormy: 'misty', misty: 'sunny' };

export function moodMult(att, def) {
  if (!att || !def) return 1;
  if (MOOD_BEATS[att] === def) return BAL.dmg.moodWin;
  if (MOOD_BEATS[def] === att) return BAL.dmg.moodLose;
  return 1;
}

let instanceCounter = 0;

export function makeEnemy(id) {
  const def = ENEMIES[id];
  return {
    key: `e${instanceCounter++}`,
    id, def, name: def.name, isEnemy: true,
    hp: def.hp, maxHp: def.hp,
    grit: def.grit, guard: def.guard, zip: def.zip,
    fade: 0, rememberedTurns: 0, guarding: false,
    mood: null, calmTurns: 0, enraged: false, gone: false,
    frays: false, phaseDone: {},
  };
}

const sideOf = (x) => (x.isEnemy ? 'enemy' : 'party');

export function makeBattle({ party, enemyIds, rng, inventory = {}, canFlee = true, scripted = null }) {
  const enemies = enemyIds.map(makeEnemy);
  // letter dupes: "Sniffle-moth A", "Sniffle-moth B"
  const byId = {};
  for (const e of enemies) (byId[e.id] ||= []).push(e);
  for (const list of Object.values(byId)) {
    if (list.length > 1) list.forEach((e, i) => { e.name = `${e.def.name} ${String.fromCharCode(65 + i)}`; });
  }
  return {
    party, enemies, rng, inventory, canFlee, scripted,
    round: 0, order: [], turnIdx: 0, over: null,
    talkGlimmer: 0, summons: 0, fled: false,
  };
}

// ——— stat helpers ———

function charm(m) { return m.charm ? CHARMS[m.charm] : null; }

export function effGrit(a) {
  let g = a.grit * (a.mood === 'stormy' ? BAL.mood.stormy.grit : 1);
  if (a.fade) g *= 1 - BAL.fade.statPenaltyPerStack * a.fade;
  if (a.rememberedTurns > 0) g *= BAL.fade.remindBuffMult;
  if (a.enraged) g *= 1.25;
  if (charm(a)?.grit) g += charm(a).grit;
  return g;
}

export function effGuard(a) {
  let g = a.guard * (a.mood === 'misty' ? BAL.mood.misty.guard : 1) * (a.mood === 'stormy' ? BAL.mood.stormy.guard : 1);
  if (a.rememberedTurns > 0) g *= BAL.fade.remindBuffMult;
  if (charm(a)?.guard) g += charm(a).guard;
  return g;
}

export function effZip(a) {
  let z = a.zip * (a.mood === 'sunny' ? BAL.mood.sunny.zip : 1);
  if (a.fade) z *= 1 - BAL.fade.statPenaltyPerStack * a.fade;
  if (charm(a)?.zip) z += charm(a).zip;
  return z;
}

const aliveParty = (s) => s.party.filter(m => m.inParty && m.hp > 0);
const liveEnemies = (s) => s.enemies.filter(e => e.hp > 0 && !e.gone);

// ——— rounds & turn order ———

export function beginRound(state) {
  const ev = [];
  state.round++;
  // start-of-round ticks
  for (const m of aliveParty(state)) {
    m.guarding = false;
    if (m.rememberedTurns > 0) m.rememberedTurns--;
    if (m.mood === 'misty') {
      const heal = Math.max(1, Math.round(m.maxHp * BAL.mood.misty.regen));
      if (m.hp < m.maxHp) {
        m.hp = Math.min(m.maxHp, m.hp + heal);
        ev.push({ t: 'heal', side: 'party', ref: m, amount: heal, quiet: true });
      }
    }
  }
  const actors = [];
  for (const m of aliveParty(state)) actors.push({ side: 'party', ref: m });
  for (const e of liveEnemies(state)) {
    actors.push({ side: 'enemy', ref: e });
    if (e.frays) actors.push({ side: 'enemy', ref: e }); // frayed bosses act twice
  }
  actors.sort((a, b) =>
    effZip(b.ref) * (0.9 + state.rng() * 0.2) - effZip(a.ref) * (0.9 + state.rng() * 0.2));
  state.order = actors;
  state.turnIdx = 0;
  return ev;
}

export function peekActor(state) {
  while (state.turnIdx < state.order.length) {
    const a = state.order[state.turnIdx];
    const dead = a.side === 'party' ? a.ref.hp <= 0 || !a.ref.inParty : a.ref.hp <= 0 || a.ref.gone;
    if (!dead) return a;
    state.turnIdx++;
  }
  return null; // round over
}

export function popActor(state) { state.turnIdx++; }

// ——— damage core ———

function rollDamage(state, att, def, mult, opts = {}) {
  const ev = [];
  // sunny evasion
  const evade = def.mood === 'sunny' ? BAL.mood.sunny.evade : 0;
  if (state.rng() < evade) {
    ev.push({ t: 'dmg', side: sideOf(def), ref: def, amount: 0, miss: true });
    return ev;
  }
  let base = effGrit(att) * BAL.dmg.gritScale * mult - effGuard(def) * BAL.dmg.guardScale;
  base *= BAL.dmg.varianceMin + state.rng() * (BAL.dmg.varianceMax - BAL.dmg.varianceMin);
  const mm = moodMult(att.mood, def.mood);
  base *= mm;
  let crit = false;
  if (state.rng() < BAL.dmg.critChance) { base *= BAL.dmg.critMult; crit = true; }
  if (opts.bonusVsFade && def.fade > 0) base *= 1 + opts.bonusVsFade;
  if (def.guarding) base *= BAL.guardAction.incomingMult;
  if (def.frays) base *= 1.25; // frayed bosses take more
  const amount = Math.max(BAL.dmg.minDamage, Math.round(base));
  def.hp = Math.max(0, def.hp - amount);
  ev.push({
    t: 'dmg', side: sideOf(def), ref: def, amount, crit,
    eff: mm > 1 ? 'win' : mm < 1 ? 'lose' : null,
  });
  // pincushion thorns
  if (def.isEnemy && def.def.thorns && !opts.noThorns && state.rng() < def.def.thorns && att.hp > 0) {
    const th = Math.max(1, Math.round(amount * 0.4));
    att.hp = Math.max(0, att.hp - th);
    ev.push({ t: 'text', msg: 'The pins bite back!' });
    ev.push({ t: 'dmg', side: sideOf(att), ref: att, amount: th });
    if (att.hp <= 0) ev.push(...deathEvents(state, att));
  }
  if (def.hp <= 0) ev.push(...deathEvents(state, def));
  else ev.push(...checkPhases(state, def));
  return ev;
}

function deathEvents(state, who) {
  const ev = [];
  if (who.isEnemy) {
    ev.push({ t: 'die', side: 'enemy', ref: who });
  } else {
    ev.push({ t: 'text', msg: who.def.deathLine || `${who.name} comes apart at the seams…` });
    ev.push({ t: 'die', side: 'party', ref: who });
  }
  ev.push(...checkOver(state));
  return ev;
}

function checkPhases(state, who) {
  const ev = [];
  if (!who.def?.phases) return ev;
  for (const ph of who.def.phases) {
    const k = `p${ph.below}`;
    if (!who.phaseDone[k] && who.hp / who.maxHp <= ph.below) {
      who.phaseDone[k] = true;
      if (ph.addMood) { who.mood = ph.addMood; ev.push({ t: 'mood', side: 'enemy', ref: who, mood: ph.addMood }); }
      if (ph.frays) who.frays = true;
      ev.push({ t: 'phase', ref: who, text: ph.text });
    }
  }
  return ev;
}

function checkOver(state) {
  if (state.over) return [];
  if (state.scripted) return []; // scripted fights end via story, not logic
  if (!aliveParty(state).length) { state.over = 'defeat'; return [{ t: 'end', result: 'defeat' }]; }
  if (!liveEnemies(state).length) {
    state.over = 'victory';
    return [{ t: 'end', result: 'victory' }];
  }
  return [];
}

function applyFade(state, m, chance) {
  const ev = [];
  if (m.isEnemy) return ev; // enemies don't fade
  let c = chance;
  if (charm(m)?.fadeResist) c *= 1 - charm(m).fadeResist;
  if (state.rng() >= c) return ev;
  if (m.fade >= BAL.fade.max) return ev;
  m.fade++;
  ev.push({ t: 'fade', ref: m, stacks: m.fade });
  if (m.fade >= BAL.fade.max) {
    const known = memberSkills(m);
    if (known.length) {
      const skill = known[Math.floor(state.rng() * known.length)];
      m.forgotten.push(skill);
      ev.push({ t: 'forget', ref: m, skill, name: SKILLS[skill].name });
    }
  }
  return ev;
}

// ——— skills (shared by party & enemies) ———

function resolveSkill(state, actor, skillId, target) {
  const sk = SKILLS[skillId];
  const ev = [];
  const actorSide = sideOf(actor);
  ev.push({ t: 'move', side: actorSide, ref: actor, name: sk.name });
  if (sk.flavor) ev.push({ t: 'text', msg: sk.flavor.replaceAll('{a}', actor.name) });

  // resolve target lists. "enemy" from a party actor = enemies; from an enemy actor = party.
  const foes = actorSide === 'party' ? liveEnemies(state) : aliveParty(state);
  const pals = actorSide === 'party' ? aliveParty(state) : liveEnemies(state);
  let targets = [];
  switch (sk.target) {
    case 'enemy': targets = [target && (target.hp > 0 && !target.gone) ? target : foes[0]].filter(Boolean); break;
    case 'allEnemies': targets = [...foes]; break;
    case 'ally': targets = [target || actor].filter(x => x.hp > 0); break;
    case 'allAllies': targets = [...pals]; break;
    case 'self': targets = [actor]; break;
    case 'downedAlly': targets = [target].filter(x => x && x.hp <= 0); break;
  }

  for (const tg of targets) {
    if (sk.mult) ev.push(...rollDamage(state, actor, tg, sk.mult, { bonusVsFade: sk.bonusVsFade }));
    if (tg.hp <= 0 && !sk.revive) continue;
    if (sk.heal) {
      let amount = Math.max(1, Math.round(tg.maxHp * sk.heal));
      if (charm(tg)?.healBoost) amount = Math.round(amount * charm(tg).healBoost);
      tg.hp = Math.min(tg.maxHp, tg.hp + amount);
      ev.push({ t: 'heal', side: sideOf(tg), ref: tg, amount });
    }
    if (sk.healFlat) {
      tg.hp = Math.min(tg.maxHp, tg.hp + sk.healFlat);
      ev.push({ t: 'heal', side: sideOf(tg), ref: tg, amount: sk.healFlat });
    }
    if (sk.giveInk && !tg.isEnemy) {
      tg.ink = Math.min(tg.maxInk, tg.ink + sk.giveInk);
      ev.push({ t: 'ink', ref: tg, amount: sk.giveInk });
    }
    if (sk.cureFade && !tg.isEnemy && tg.fade > 0) {
      tg.fade = Math.max(0, tg.fade - sk.cureFade);
      ev.push({ t: 'remind', ref: tg, cured: true, quiet: true });
    }
    if (sk.mood && tg.hp > 0) {
      tg.mood = sk.mood;
      ev.push({ t: 'mood', side: sideOf(tg), ref: tg, mood: sk.mood });
    }
    if (sk.clearTargetMood && tg.mood) {
      tg.mood = null;
      ev.push({ t: 'mood', side: sideOf(tg), ref: tg, mood: null });
    }
    if (sk.fade) ev.push(...applyFade(state, tg, sk.fade));
  }

  if (sk.selfMood) { actor.mood = sk.selfMood; ev.push({ t: 'mood', side: actorSide, ref: actor, mood: sk.selfMood }); }
  if (sk.selfMoodClear) { actor.mood = null; ev.push({ t: 'mood', side: actorSide, ref: actor, mood: null }); }
  if (sk.summon && state.summons < 2 && liveEnemies(state).length < 3) {
    state.summons++;
    const ne = makeEnemy(sk.summon);
    ne.name = `${ne.def.name} ✦`;
    state.enemies.push(ne);
    ev.push({ t: 'summon', ref: ne });
  }
  return ev;
}

// ——— party actions ———

export function partyAct(state, m, action) {
  const ev = [];
  if (state.over) return ev;
  switch (action.type) {
    case 'attack': {
      ev.push({ t: 'move', side: 'party', ref: m, name: 'Fight' });
      const tg = action.target && action.target.hp > 0 && !action.target.gone ? action.target : liveEnemies(state)[0];
      if (tg) {
        if (state.scripted === 'fog2') {
          ev.push({ t: 'dmg', side: 'enemy', ref: tg, amount: 0, scriptedZero: true });
          ev.push({ t: 'text', msg: 'The Fog cannot be unpicked.' });
        } else {
          ev.push(...rollDamage(state, m, tg, 1.0));
        }
      }
      break;
    }
    case 'skill': {
      const sk = SKILLS[action.id];
      if (m.ink < sk.ink) { ev.push({ t: 'text', msg: `${m.name} is out of Ink…` }); return ev; }
      m.ink -= sk.ink;
      if (state.scripted === 'fog2' && sk.mult) {
        ev.push({ t: 'move', side: 'party', ref: m, name: sk.name });
        ev.push({ t: 'dmg', side: 'enemy', ref: liveEnemies(state)[0], amount: 0, scriptedZero: true });
        ev.push({ t: 'text', msg: 'The Fog cannot be unpicked.' });
      } else {
        ev.push(...resolveSkill(state, m, action.id, action.target));
      }
      break;
    }
    case 'remind': {
      const tg = action.target || m;
      ev.push({ t: 'move', side: 'party', ref: m, name: 'Remind' });
      let cured = 0;
      if (tg.fade > 0) {
        cured = BAL.fade.remindCureMin + (state.rng() < BAL.fade.remindCureBonusChance ? 1 : 0);
        tg.fade = Math.max(0, tg.fade - cured);
      }
      tg.rememberedTurns = BAL.fade.remindBuffTurns + 1;
      const pool = MEMORIES[tg.id] || [];
      const line = pool.length ? pool[Math.floor(state.rng() * pool.length)].replaceAll('{a}', m.name).replaceAll('{b}', tg.name) : `${m.name} reminds ${tg.name} who they are.`;
      ev.push({ t: 'remind', ref: tg, line, cured });
      break;
    }
    case 'item': {
      const it = ITEMS[action.id];
      if (!it || (state.inventory[action.id] || 0) <= 0) { ev.push({ t: 'text', msg: 'The pocket is empty.' }); return ev; }
      state.inventory[action.id]--;
      if (state.inventory[action.id] <= 0) delete state.inventory[action.id];
      ev.push({ t: 'move', side: 'party', ref: m, name: it.name });
      const tg = action.target || m;
      if (it.revive && tg.hp <= 0) {
        tg.hp = Math.round(tg.maxHp * it.revive);
        ev.push({ t: 'text', msg: `${tg.name} is stitched back together!` });
        ev.push({ t: 'heal', side: 'party', ref: tg, amount: tg.hp });
      } else if (tg.hp > 0) {
        if (it.heal) {
          const boost = charm(tg)?.healBoost || 1;
          const a = Math.min(Math.round(it.heal * boost), tg.maxHp - tg.hp);
          tg.hp += a; ev.push({ t: 'heal', side: 'party', ref: tg, amount: a });
        }
        if (it.healAll) for (const p of aliveParty(state)) { const a = Math.min(it.healAll, p.maxHp - p.hp); p.hp += a; ev.push({ t: 'heal', side: 'party', ref: p, amount: a }); }
        if (it.giveInk) { tg.ink = Math.min(tg.maxInk, tg.ink + it.giveInk); ev.push({ t: 'ink', ref: tg, amount: it.giveInk }); }
        if (it.cureFade && tg.fade > 0) { tg.fade = Math.max(0, tg.fade - it.cureFade); ev.push({ t: 'remind', ref: tg, cured: it.cureFade, quiet: true }); }
      }
      if (it.use) ev.push({ t: 'text', msg: it.use });
      break;
    }
    case 'talk': {
      const tg = action.target;
      const opt = tg?.def.talk?.[action.optIdx];
      ev.push({ t: 'move', side: 'party', ref: m, name: 'Talk' });
      if (!opt) { ev.push({ t: 'text', msg: '…nothing comes to mind.' }); return ev; }
      ev.push({ t: 'text', msg: opt.text });
      if (opt.result === 'leave') {
        tg.gone = true;
        state.talkGlimmer += opt.glimmer || 0;
        ev.push({ t: 'leave', ref: tg });
        ev.push(...checkOver(state));
      } else if (opt.result === 'calm') {
        tg.calmTurns = 2;
        ev.push({ t: 'calm', ref: tg });
      } else if (opt.result === 'enrage') {
        tg.enraged = true;
        ev.push({ t: 'enrage', ref: tg });
      }
      break;
    }
    case 'guard': {
      m.guarding = true;
      m.ink = Math.min(m.maxInk, m.ink + BAL.guardAction.inkRecover);
      ev.push({ t: 'move', side: 'party', ref: m, name: 'Guard' });
      ev.push({ t: 'guard', ref: m });
      break;
    }
    case 'flee': {
      if (!state.canFlee) { ev.push({ t: 'text', msg: 'The stitches hold you here.' }); return ev; }
      const pz = aliveParty(state).reduce((a, x) => a + effZip(x), 0) / aliveParty(state).length;
      const ez = liveEnemies(state).reduce((a, x) => a + effZip(x), 0) / liveEnemies(state).length;
      const p = Math.max(BAL.flee.min, Math.min(BAL.flee.max, BAL.flee.base + (pz - ez) * BAL.flee.zipFactor));
      if (state.rng() < p) {
        state.over = 'fled'; state.fled = true;
        ev.push({ t: 'text', msg: 'You slip away between the stitches!' });
        ev.push({ t: 'end', result: 'fled' });
      } else {
        ev.push({ t: 'text', msg: 'You trip over a loose thread!' });
      }
      break;
    }
  }
  return ev;
}

// ——— enemy AI ———

export function enemyAct(state, e) {
  const ev = [];
  if (state.over || e.hp <= 0 || e.gone) return ev;
  if (e.calmTurns > 0) {
    e.calmTurns--;
    if (state.rng() < 0.5) {
      ev.push({ t: 'text', msg: `${e.name} is calmed, and lets the moment pass.` });
      return ev;
    }
  }
  // build weighted move list, skipping useless picks
  const options = [];
  for (const mv of e.def.moves) {
    const sk = SKILLS[mv.id];
    if (sk.mood && sk.target === 'self' && e.mood === sk.mood) continue;
    if (sk.summon && (state.summons >= 2 || liveEnemies(state).length >= 3)) continue;
    if (sk.healFlat && e.hp > e.maxHp * 0.7) continue;
    options.push(mv);
  }
  const total = options.reduce((a, x) => a + x.w, 0);
  let roll = state.rng() * total;
  let chosen = options[0];
  for (const mv of options) { roll -= mv.w; if (roll <= 0) { chosen = mv; break; } }
  const sk = SKILLS[chosen.id];

  // pick a party target: random, biased to faded targets for unpick-style moves
  const pool = aliveParty(state);
  if (!pool.length) return ev;
  let tg = pool[Math.floor(state.rng() * pool.length)];
  if (sk.bonusVsFade) {
    const faded = pool.filter(p => p.fade > 0);
    if (faded.length && state.rng() < 0.7) tg = faded[Math.floor(state.rng() * faded.length)];
  }
  ev.push(...resolveSkill(state, e, chosen.id, tg));
  return ev;
}

// ——— rewards ———

export function battleRewards(state) {
  const killed = state.enemies.filter(e => e.hp <= 0);
  const xp = killed.reduce((a, e) => a + e.def.xp, 0);
  const glimmer = killed.reduce((a, e) => a + e.def.glimmer, 0) + state.talkGlimmer;
  const peaceful = killed.length === 0 && state.enemies.every(e => e.gone || e.hp <= 0);
  return { xp, glimmer, peaceful };
}
