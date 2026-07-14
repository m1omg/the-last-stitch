// Content integrity lint: every cross-reference in the data layer must
// resolve — story ids, speakers, portraits, stills, enemies, encounters,
// doors, music. Run: node tests/content.test.mjs

import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { MAPS } = await import('../src/data/maps.js');
const { STORY } = await import('../src/data/story.js');
const { ENEMIES, ENCOUNTERS } = await import('../src/data/enemies.js');
const { SKILLS } = await import('../src/data/skills.js');
const { SPEAKERS } = await import('../src/data/speakers.js');
const { ITEMS, CHARMS } = await import('../src/data/items.js');
const { IMAGES, MUSIC, SFX } = await import('../assets/manifest.js');
const { PARTY_DEFS } = await import('../src/data/party.js');
const { MEMORIES } = await import('../src/data/memories.js');

let errors = [];
const err = (m) => errors.push(m);

// fake ctx for expanding story scripts without running side effects
const fakeG = {
  flag: () => false, setFlag: () => {}, addItem: () => {},
  party: [], rand: () => 0.5,
};
const ctx = { G: fakeG, game: null, scene: null, choice: null };

function walkSteps(id, steps, visit) {
  for (const s of steps) {
    if (s == null) { err(`${id}: null step`); continue; }
    visit(s, id);
    if (s.then) walkSteps(id, s.then, visit);
    if (s.else) walkSteps(id, s.else, visit);
    if (s.lines) walkSteps(id, s.lines, visit);
  }
}

// ——— story checks ———
const gotoTargets = [];
for (const [id, fn] of Object.entries(STORY)) {
  let steps;
  try { steps = fn(ctx); } catch (e) { err(`${id}: script threw at build time: ${e.message}`); continue; }
  walkSteps(id, steps, (s) => {
    if (typeof s === 'string') return;
    if (s.who && !SPEAKERS[s.who]) err(`${id}: unknown speaker '${s.who}'`);
    if (s.who && s.face) {
      const spk = SPEAKERS[s.who];
      if (spk?.por && !IMAGES[`${spk.por}_${s.face}`] && !IMAGES[`${spk.por}_neutral`]) {
        err(`${id}: no portrait for ${s.who}/${s.face}`);
      }
    }
    if (s.still && !IMAGES[s.still]) err(`${id}: unknown still '${s.still}'`);
    if (s.battle) {
      for (const e of s.battle.enemyIds) if (!ENEMIES[e]) err(`${id}: unknown enemy '${e}'`);
      if (s.battle.bg && !IMAGES[s.battle.bg]) err(`${id}: unknown battle bg '${s.battle.bg}'`);
      if (s.battle.music && !MUSIC.includes(s.battle.music)) err(`${id}: unknown music '${s.battle.music}'`);
    }
    if (s.goto) gotoTargets.push([id, s.goto.map]);
    if (s.music && !MUSIC.includes(s.music)) err(`${id}: unknown music '${s.music}'`);
    if (s.sfx && !SFX.includes(s.sfx)) err(`${id}: unknown sfx '${s.sfx}'`);
    if (s.choices) for (const c of s.choices) if (!c.label) err(`${id}: choice missing label`);
  });
}
for (const [id, map] of gotoTargets) if (!MAPS[map]) err(`${id}: goto unknown map '${map}'`);

// ——— map checks ———
for (const [mid, map] of Object.entries(MAPS)) {
  if (!IMAGES[map.img]) err(`map ${mid}: unknown backdrop '${map.img}'`);
  if (!MUSIC.includes(map.music)) err(`map ${mid}: unknown music '${map.music}'`);
  if (map.battleBg && !IMAGES[map.battleBg]) err(`map ${mid}: unknown battleBg`);
  assert.equal(map.grid.length, 32, `map ${mid} grid rows`);
  for (const row of map.grid) assert.equal(row.length, 48, `map ${mid} grid cols`);
  // spawn walkable
  const c = map.grid[Math.floor(map.spawn.y / 32)][Math.floor(map.spawn.x / 32)];
  if (c === '#' || c === 'T' || c === 'B') err(`map ${mid}: spawn is inside a wall`);
  for (const e of map.entities) {
    if (e.type === 'door' && !MAPS[e.to.map]) err(`map ${mid}: door to unknown map '${e.to.map}'`);
    if (e.type === 'door' && e.locked && !STORY[e.locked]) err(`map ${mid}: door locked-script '${e.locked}' missing`);
    if (e.type === 'trigger' && !STORY[e.script]) err(`map ${mid}: trigger script '${e.script}' missing`);
    if ((e.type === 'npc' || e.type === 'poi') && e.talk && !e.shop && !STORY[e.talk]) err(`map ${mid}: talk script '${e.talk}' missing`);
    if (e.type === 'npc' && e.spr && !IMAGES[e.spr]) err(`map ${mid}: npc sprite '${e.spr}' missing`);
    if (e.type === 'enemy') {
      if (!ENCOUNTERS[e.encounter]) err(`map ${mid}: unknown encounter '${e.encounter}'`);
      else if (!IMAGES[`en_${ENCOUNTERS[e.encounter][0]}`]) err(`map ${mid}: no overworld img for encounter ${e.encounter}`);
    }
    if (e.type === 'item' && !ITEMS[e.itemId]) err(`map ${mid}: unknown item '${e.itemId}'`);
    if (e.type === 'item' && !e.flag) err(`map ${mid}: item pickup missing flag`);
  }
}

// ——— enemy/skill checks ———
for (const [eid, e] of Object.entries(ENEMIES)) {
  if (!IMAGES[e.img]) err(`enemy ${eid}: image '${e.img}' missing`);
  for (const mv of e.moves) if (!SKILLS[mv.id]) err(`enemy ${eid}: move '${mv.id}' missing`);
  if (!e.scripted && (!e.talk || !e.intro)) err(`enemy ${eid}: needs talk options and intro`);
}
for (const enc of Object.values(ENCOUNTERS)) for (const eid of enc) if (!ENEMIES[eid]) err(`encounter references unknown enemy '${eid}'`);

// ——— party checks ———
for (const [pid, def] of Object.entries(PARTY_DEFS)) {
  for (const ids of Object.values(def.skills)) for (const s of ids) if (!SKILLS[s]) err(`party ${pid}: skill '${s}' missing`);
  for (const dir of ['front', 'back', 'side']) if (!IMAGES[`spr_${pid}_${dir}`]) err(`party ${pid}: sprite ${dir} missing`);
  if (!IMAGES[`${def.porBase}_neutral`]) err(`party ${pid}: neutral portrait missing`);
  if (!MEMORIES[pid]?.length) err(`party ${pid}: no Remind memories`);
}

// ——— progression sanity: flags set somewhere before they are required ———
const requiredFlags = ['thread_sun', 'thread_storm', 'thread_mist', 'orchard_done', 'captain_joined', 'white_door'];
const storySource = Object.values(STORY).map(f => f.toString()).join('\n');
for (const f of requiredFlags) {
  if (!storySource.includes(`setFlag('${f}')`) && !storySource.includes(`G.setFlag('${f}'`)) err(`flag '${f}' is never set by any story script`);
}

if (errors.length) {
  console.error(`\nCONTENT LINT: ${errors.length} problem(s):`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('content lint: all cross-references resolve ✓');
