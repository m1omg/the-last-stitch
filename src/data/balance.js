// Every combat tunable in one place. tests/sim.mjs prints per-encounter
// stats; tune here, re-run, repeat.

export const BAL = {
  dmg: {
    gritScale: 2.2,      // base = grit * gritScale * skillMult - guard * guardScale
    guardScale: 1.1,
    varianceMin: 0.9,
    varianceMax: 1.1,
    minDamage: 1,
    critChance: 0.06,
    critMult: 1.5,
    moodWin: 1.5,        // attacker mood beats defender mood
    moodLose: 0.7,
  },
  mood: {
    // stat multipliers while in a mood
    sunny: { zip: 1.35, evade: 0.15 },
    stormy: { grit: 1.3, guard: 0.75 },
    misty: { guard: 1.3, regen: 0.06 }, // fraction of maxHp per round
  },
  fade: {
    max: 3,
    statPenaltyPerStack: 0.08, // grit & zip
    alphaPerStack: 0.22,       // visual only
    remindCureMin: 1,
    remindCureBonusChance: 0.5, // chance to cure a 2nd stack
    remindBuffTurns: 2,
    remindBuffMult: 1.15,      // grit & guard while "remembered"
  },
  guardAction: { incomingMult: 0.5, inkRecover: 2 },
  flee: { base: 0.55, zipFactor: 0.05, min: 0.2, max: 0.95 },
  // cumulative XP needed to *reach* level (index = level-1). Max level 8.
  xpCurve: [0, 12, 30, 55, 88, 130, 182, 246],
  levelHeal: 0.35, // fraction of max hp/ink restored on level-up
};

export function xpForLevel(level) {
  return BAL.xpCurve[Math.min(level, BAL.xpCurve.length) - 1];
}

export function levelFromXp(xp) {
  let lv = 1;
  for (let i = 0; i < BAL.xpCurve.length; i++) if (xp >= BAL.xpCurve[i]) lv = i + 1;
  return lv;
}
