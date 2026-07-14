// Monte-carlo battle balance simulator.
// Run: node tests/sim.mjs [runsPerConfig]
// Prints win rate, avg rounds, avg surviving HP — tune src/data/balance.js until sane.

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { makeBattle, beginRound, peekActor, popActor, partyAct, enemyAct, battleRewards } =
  await import('../src/game/battle_logic.js');
const { makeMember, resetBattleState, memberSkills } = await import('../src/data/party.js');
const { SKILLS } = await import('../src/data/skills.js');
const { mulberry32 } = await import('../src/game/state.js');

const RUNS = Number(process.argv[2] || 400);

// A decent-but-not-perfect bot policy.
function botAction(st, m) {
  const allies = st.party.filter(p => p.inParty && p.hp > 0);
  const foes = st.enemies.filter(e => e.hp > 0 && !e.gone);
  const weakest = [...allies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const target = [...foes].sort((a, b) => a.hp - b.hp)[0];
  const skills = memberSkills(m).map(id => ({ id, sk: SKILLS[id] })).filter(x => m.ink >= x.sk.ink);

  // heal when someone is low
  if (weakest && weakest.hp / weakest.maxHp < 0.45) {
    if (st.inventory.tea > 0) return { type: 'item', id: 'tea', target: weakest };
    if (st.inventory.biscuit > 0) return { type: 'item', id: 'biscuit', target: weakest };
    const healSk = skills.find(x => x.sk.heal);
    if (healSk) return { type: 'skill', id: healSk.id, target: weakest };
  }
  // revive
  const downed = st.party.find(p => p.inParty && p.hp <= 0);
  if (downed && st.inventory.warmsock > 0) return { type: 'item', id: 'warmsock', target: downed };
  // cure heavy fade
  const faded = allies.find(a => a.fade >= 2);
  if (faded) {
    const cure = skills.find(x => x.sk.cureFade >= 2);
    if (cure) return { type: 'skill', id: cure.id, target: faded };
    return { type: 'remind', target: faded };
  }
  // ink management
  if (m.ink <= 1 && st.rng() < 0.4) return { type: 'guard' };
  // aoe when 2+ foes
  if (foes.length >= 2) {
    const aoe = skills.find(x => x.sk.target === 'allEnemies' && x.sk.mult);
    if (aoe) return { type: 'skill', id: aoe.id, target };
  }
  // damage skill sometimes, else attack
  const dmgSk = skills.filter(x => x.sk.mult && x.sk.target === 'enemy')
    .sort((a, b) => b.sk.mult - a.sk.mult)[0];
  if (dmgSk && st.rng() < 0.65) return { type: 'skill', id: dmgSk.id, target };
  return { type: 'attack', target };
}

function runBattle(cfg, seed) {
  const rng = mulberry32(seed);
  const party = cfg.party.map(([id, lv]) => { const m = makeMember(id, lv); resetBattleState(m); return m; });
  const inventory = { ...cfg.items };
  const st = makeBattle({ party, enemyIds: cfg.enemies, rng, inventory, canFlee: false });
  let rounds = 0;
  while (!st.over && rounds < 60) {
    beginRound(st); rounds++;
    let actor;
    while ((actor = peekActor(st)) && !st.over) {
      if (actor.side === 'party') partyAct(st, actor.ref, botAction(st, actor.ref));
      else enemyAct(st, actor.ref);
      popActor(st);
    }
  }
  const alive = st.party.filter(p => p.hp > 0);
  return {
    result: st.over || 'timeout',
    rounds,
    hpFrac: alive.length ? alive.reduce((a, p) => a + p.hp / p.maxHp, 0) / st.party.length : 0,
    downs: st.party.length - alive.length,
  };
}

const CONFIGS = [
  { name: 'orchard: moth', party: [['poppy', 1], ['buttons', 1]], enemies: ['moth'], items: { biscuit: 2 } },
  { name: 'orchard: moth+dust', party: [['poppy', 2], ['buttons', 2]], enemies: ['moth', 'dust'], items: { biscuit: 2 } },
  { name: 'orchard: 2moth+dust', party: [['poppy', 2], ['buttons', 2]], enemies: ['moth', 'moth', 'dust'], items: { biscuit: 2 } },
  { name: 'orchard: sock+dust', party: [['poppy', 3], ['buttons', 3]], enemies: ['sock', 'dust'], items: { biscuit: 2, tea: 1 } },
  { name: 'BOSS mothqueen @3', party: [['poppy', 3], ['buttons', 3]], enemies: ['mothqueen'], items: { biscuit: 3, tea: 2 } },
  { name: 'sea: fogpup+urchin', party: [['poppy', 4], ['buttons', 4], ['captain', 4]], enemies: ['fogpup', 'urchin'], items: { biscuit: 2, tea: 1 } },
  { name: 'sea: whistler+fogpup', party: [['poppy', 4], ['buttons', 4], ['captain', 4]], enemies: ['whistler', 'fogpup'], items: { biscuit: 2, tea: 1 } },
  { name: 'BOSS tangle @5', party: [['poppy', 5], ['buttons', 5], ['captain', 5]], enemies: ['tangle'], items: { biscuit: 3, tea: 2, warmsock: 1, jamtoast: 1 } },
  { name: 'white: frame+unraveler', party: [['poppy', 6], ['buttons', 6], ['captain', 6]], enemies: ['frame', 'unraveler'], items: { tea: 2, buttonshine: 1 } },
  { name: 'white: trio', party: [['poppy', 6], ['buttons', 6], ['captain', 6]], enemies: ['frame', 'unraveler', 'whistler'], items: { tea: 2, buttonshine: 1 } },
  { name: 'BOSS fog p1 @7', party: [['poppy', 7], ['buttons', 7], ['captain', 7]], enemies: ['fog1'], items: { tea: 3, jamtoast: 2, warmsock: 1, buttonshine: 2 } },
];

console.log(`${RUNS} runs per config\n`);
console.log('config                        win%   avgRounds  endHP%  avgDowns');
for (const cfg of CONFIGS) {
  let wins = 0, rounds = 0, hp = 0, downs = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = runBattle(cfg, 1000 + i * 7);
    if (r.result === 'victory') { wins++; rounds += r.rounds; hp += r.hpFrac; }
    downs += r.downs;
  }
  const w = wins / RUNS;
  console.log(
    cfg.name.padEnd(30) +
    (w * 100).toFixed(0).padStart(4) + '%' +
    (wins ? (rounds / wins).toFixed(1) : '—').padStart(10) +
    (wins ? ((hp / wins) * 100).toFixed(0) + '%' : '—').padStart(9) +
    (downs / RUNS).toFixed(2).padStart(9)
  );
}
