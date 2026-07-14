// Headless full-game playthrough: drives the REAL overworld, story runner,
// dialogue, triggers, doors and flags from new-game to credits.
// Battles auto-resolve as victories (combat is covered by sim.mjs).
// Run: node tests/playthrough.mjs

import assert from 'node:assert/strict';

// —— browser shims (module-load safe; draw() is never called) ——
globalThis.localStorage = (() => {
  const s = new Map();
  return { getItem: k => (s.has(k) ? s.get(k) : null), setItem: (k, v) => s.set(k, String(v)), removeItem: k => s.delete(k) };
})();
globalThis.addEventListener = () => {};
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const { Input } = await import('../src/engine/input.js');
const { G } = await import('../src/game/state.js');
const { OverworldScene } = await import('../src/game/overworld.js');
const { BattleScene } = await import('../src/game/battle.js');
const { CreditsScene } = await import('../src/game/credits.js');
const flow = await import('../src/game/flow.js');
const { MAPS } = await import('../src/data/maps.js');

// battles auto-win: story flow is what we're testing here
let battlesFought = [];
OverworldScene.prototype.startBattle = function (opts, entity) {
  battlesFought.push(opts.enemyIds || opts.encounter || '?');
  if (entity) entity.dead = true;
  if (opts.onWin) opts.onWin();
};

// fake game host
const game = {
  scene: null,
  setScene(next) {
    if (this.scene?.exit) this.scene.exit();
    this.scene = next;
    if (next?.enter) next.enter();
  },
  shake() {}, flash() {},
};

function tick(n = 1, dt = 1 / 20) {
  for (let i = 0; i < n; i++) {
    game.scene?.update(dt);
    Input.endFrame();
  }
}

function pressOk() { Input.pressed.ok = true; tick(1); }

// pump story/dialogue to completion, answering choices with the given labels
function pumpStory(choiceLabels = [], cap = 700) {
  const sc = game.scene;
  for (let i = 0; i < cap; i++) {
    if (!(sc === game.scene) || !game.scene.story) return; // scene changed or story done
    const story = game.scene.story;
    const dlg = story.dlg;
    if (dlg?.line?.menu) {
      // choice menu open: steer to wanted label if provided
      const want = choiceLabels.shift();
      if (want) {
        const idx = dlg.line.step.choices.findIndex(c => c.label === want);
        if (idx >= 0) dlg.line.menu.index = idx;
      }
      pressOk();
      continue;
    }
    pressOk();
    tick(1, 0.4); // give typewriter/waits time
  }
  throw new Error('story did not finish (cap reached)');
}

function moveTo(x, y) {
  const sc = game.scene;
  sc.px = x; sc.py = y;
  G.pos = { x, y };
  tick(1);
}

function interactWith(id, choices = []) {
  const sc = game.scene;
  const e = sc.entities.find(en => en.id === id) || sc.entities.find(en => en.talk === id);
  assert.ok(e, `entity ${id} on ${sc.mapId}`);
  moveTo(e.x, e.y - 6); // stand on it: nearest interactable wins
  pressOk();
  assert.ok(sc.story || sc.shop, `interaction ${id} started something`);
  pumpStory(choices);
  tick(2);
}

function expectMap(id) {
  assert.equal(game.scene?.mapId, id, `expected map ${id}, on ${game.scene?.mapId}`);
}

function stepOnEntity(pred) {
  const sc = game.scene;
  const e = sc.entities.find(pred);
  assert.ok(e, 'entity to step on exists');
  moveTo(e.x, e.y);
  tick(2);
  return e;
}

console.log('— new game —');
flow.startNewGame(game);
expectMap('cottage');
assert.ok(game.scene.story, 'intro auto-runs');
pumpStory();
assert.ok(G.flag('intro_done'), 'intro_done');

interactWith('mum');
interactWith('nana');
interactWith('radio');

console.log('— sleep → the Patchwork —');
interactWith('bed', ['Sleep']);
expectMap('harbor');
tick(3); // harbor_first trigger
pumpStory();
assert.ok(G.flag('met_buttons'), 'met Buttons');
assert.ok(G.party.find(m => m.id === 'buttons').inParty, 'Buttons joined the walk');

console.log('— the Captain’s quest —');
interactWith('captain_npc');
assert.ok(G.flag('quest_started'), 'quest started');

// locked sea door bounces us with a story
const seaDoor = game.scene.entities.find(e => e.type === 'door' && e.to.map === 'sea');
moveTo(seaDoor.x, seaDoor.y);
tick(2);
pumpStory();
expectMap('harbor');

console.log('— orchard —');
const orchardDoor = game.scene.entities.find(e => e.type === 'door' && e.to.map === 'orchard');
moveTo(orchardDoor.x, orchardDoor.y);
tick(2);
expectMap('orchard');

// pick up the biscuits
stepOnEntity(e => e.type === 'item' && e.itemId === 'biscuit');
pumpStory();
assert.ok((G.inventory.biscuit || 0) >= 3, 'picked up biscuits');

// touch a roamer → auto-win battle
battlesFought = [];
stepOnEntity(e => e.type === 'enemy');
assert.equal(battlesFought.length, 1, 'roamer battle fought');

// boss trigger at the top
stepOnEntity(e => e.id === 'orchard_boss');
pumpStory();
assert.ok(G.flag('orchard_boss_won'), 'moth queen defeated');
interactWith('sun_thread');
assert.ok(G.flag('thread_sun') && G.flag('orchard_done'), 'sun thread taken');

console.log('— back to harbour, captain joins —');
const backDoor = game.scene.entities.find(e => e.type === 'door' && e.to.map === 'harbor');
moveTo(backDoor.x, backDoor.y);
tick(2);
expectMap('harbor');
moveTo(784, 560); // walk to the town square — captain_joins trigger
tick(3);
pumpStory();
assert.ok(G.flag('captain_joined'), 'captain joined');
assert.equal(G.party.filter(m => m.inParty).length, 3, 'party of three');

console.log('— the quilted sea —');
moveTo(seaDoor.x, seaDoor.y);
tick(2);
expectMap('sea');
interactWith('hollow_isle');
stepOnEntity(e => e.id === 'sea_boss');
pumpStory();
assert.ok(G.flag('sea_boss_won'), 'tangle defeated');
interactWith('storm_thread');
assert.ok(G.flag('thread_storm'), 'storm thread taken');

console.log('— the white door —');
const seaBack = game.scene.entities.find(e => e.type === 'door' && e.to.map === 'harbor');
moveTo(seaBack.x, seaBack.y);
tick(2);
expectMap('harbor');
moveTo(784, 528); // town square again — white_door_appears trigger
tick(3);
pumpStory(); // white_door_appears
assert.ok(G.flag('white_door'), 'white door appeared');

const whiteDoor = game.scene.entities.find(e => e.type === 'door' && e.to.map === 'whiterooms');
moveTo(whiteDoor.x, whiteDoor.y);
tick(2);
expectMap('whiterooms');
tick(3);
pumpStory(); // white_enter
assert.ok(G.flag('white_entered'), 'entered the white rooms');

console.log('— the reveals —');
interactWith('photowall');
assert.ok(G.flag('photowall_seen'), 'photo wall seen');
interactWith('nursery');
assert.ok(G.flag('nursery_seen'), 'nursery seen');
interactWith('mist_thread');
assert.ok(G.flag('thread_mist') && G.flag('white_done'), 'mist thread taken');

console.log('— the lighthouse —');
const whiteExit = game.scene.entities.find(e => e.type === 'door' && e.to.map === 'harbor');
moveTo(whiteExit.x, whiteExit.y);
tick(2);
expectMap('harbor');
tick(2);
const lhDoor = game.scene.entities.find(e => e.type === 'door' && e.to.map === 'lighthouse');
moveTo(lhDoor.x, lhDoor.y);
tick(2);
expectMap('lighthouse');
tick(3);
pumpStory(); // lighthouse_enter

battlesFought = [];
stepOnEntity(e => e.id === 'fog_fight');
pumpStory();
assert.equal(battlesFought.length, 2, 'fog phase 1 + ritual both ran');
assert.ok(G.flag('fog_done'), 'fog answered');
expectMap('cottage_morning');
assert.equal(G.party.filter(m => m.inParty).length, 1, 'morning: just Poppy');

console.log('— morning, the song —');
interactWith('mum2');
interactWith('nana2');
await new Promise(r => setTimeout(r, 30)); // credits scene lazy-imports
assert.ok(G.flag('game_complete'), 'game complete flag');
assert.ok(game.scene instanceof CreditsScene, 'credits rolling');

console.log('\nPLAYTHROUGH COMPLETE ✓  (new game → credits, all flags in order)');
