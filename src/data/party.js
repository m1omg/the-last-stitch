// Party member definitions and construction of runtime member objects.

import { BAL, levelFromXp, xpForLevel } from './balance.js';

export const PARTY_DEFS = {
  poppy: {
    id: 'poppy', name: 'Poppy',
    spr: 'poppy', bspr: 'bspr_poppy', porBase: 'por_poppy',
    blipRate: 1.25,
    base: { hp: 34, ink: 10, grit: 6, guard: 5, zip: 7 },
    growth: { hp: 6, ink: 2.4, grit: 1.2, guard: 1.0, zip: 1.1 },
    skills: { 1: ['sunbeam', 'peptalk'], 4: ['brightside'] }, // 'lullaby' is story-granted
    deathLine: 'Poppy comes apart at the seams…',
  },
  buttons: {
    id: 'buttons', name: 'Buttons',
    spr: 'buttons', bspr: 'bspr_buttons', porBase: 'por_buttons',
    blipRate: 1.5,
    base: { hp: 40, ink: 8, grit: 8, guard: 4, zip: 9 },
    growth: { hp: 7, ink: 2.0, grit: 1.5, guard: 0.8, zip: 1.3 },
    skills: { 1: ['pounce'], 2: ['yarnwhip'], 3: ['purr'], 6: ['clawstorm'] },
    deathLine: 'Buttons unravels into a sad little heap…',
  },
  captain: {
    id: 'captain', name: 'The Captain',
    spr: 'captain', bspr: 'bspr_captain', porBase: 'por_captain',
    blipRate: 0.85,
    base: { hp: 36, ink: 14, grit: 5, guard: 7, zip: 6 },
    growth: { hp: 6, ink: 3.0, grit: 1.0, guard: 1.2, zip: 0.9 },
    skills: { 1: ['squall', 'steady'], 4: ['lanternoil'], 5: ['foghorn'] },
    deathLine: 'The Captain’s paper hat folds flat…',
  },
};

export function statsAtLevel(def, level) {
  const s = {};
  for (const k of Object.keys(def.base)) {
    s[k] = Math.round(def.base[k] + def.growth[k] * (level - 1));
  }
  return s;
}

export function skillsAtLevel(def, level, extra = []) {
  const out = [];
  for (const [lv, ids] of Object.entries(def.skills)) {
    if (level >= Number(lv)) out.push(...ids);
  }
  out.push(...extra);
  return out;
}

// Build a fresh runtime member (full hp/ink).
export function makeMember(id, level = 1) {
  const def = PARTY_DEFS[id];
  const stats = statsAtLevel(def, level);
  return {
    id, def, name: def.name,
    level, xp: xpForLevel(level),
    maxHp: stats.hp, hp: stats.hp,
    maxInk: stats.ink, ink: stats.ink,
    grit: stats.grit, guard: stats.guard, zip: stats.zip,
    extraSkills: [],
    inParty: true,
    // battle-runtime (reset each battle)
    mood: null, fade: 0, forgotten: [], guarding: false,
    rememberedTurns: 0, boundTurns: 0,
  };
}

export function memberSkills(m) {
  return skillsAtLevel(m.def, m.level, m.extraSkills).filter(s => !m.forgotten.includes(s));
}

// Apply XP; returns array of level-up notices  [{name, level, learned:[..]}]
export function grantXp(members, amount) {
  const ups = [];
  for (const m of members) {
    if (m.hp <= 0) continue; // the fallen mend slower
    const before = m.level;
    m.xp += amount;
    const after = Math.min(levelFromXp(m.xp), BAL.xpCurve.length);
    if (after > before) {
      const oldSkills = skillsAtLevel(m.def, before, m.extraSkills);
      const oldStats = statsAtLevel(m.def, before);
      m.level = after;
      const s = statsAtLevel(m.def, after);
      m.maxHp = s.hp; m.maxInk = s.ink; m.grit = s.grit; m.guard = s.guard; m.zip = s.zip;
      m.hp = Math.min(m.maxHp, m.hp + Math.round((s.hp - oldStats.hp) + m.maxHp * BAL.levelHeal));
      m.ink = Math.min(m.maxInk, m.ink + Math.round(m.maxInk * BAL.levelHeal));
      const learned = skillsAtLevel(m.def, after, m.extraSkills).filter(x => !oldSkills.includes(x));
      ups.push({ name: m.name, level: after, learned });
    }
  }
  return ups;
}

export function resetBattleState(m) {
  m.mood = null; m.fade = 0; m.forgotten = []; m.guarding = false;
  m.rememberedTurns = 0; m.boundTurns = 0;
}
