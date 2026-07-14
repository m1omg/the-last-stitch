// Scene-transition re-entrancy: the outgoing scene keeps updating beneath the
// fade, so anything that calls setScene every frame (door underfoot, finished
// battle) must NOT restart the fade. Uses the REAL Game class — the
// playthrough harness fakes setScene and can't catch this family of bug.
// Run: node tests/transition.test.mjs

import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.addEventListener = () => {};
globalThis.performance = globalThis.performance || { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 0;

const { Game } = await import('../src/engine/core.js');

const noopCtx = new Proxy({}, {
  get: (t, p) => {
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: () => {} });
    return typeof p === 'string' ? () => {} : undefined;
  },
  set: () => true,
});
const canvas = { getContext: () => noopCtx };

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}

test('re-entrant setScene during fade-out swaps exactly once and completes', () => {
  const game = new Game(canvas);
  const entered = [];
  const sceneB = { name: 'B', enter: () => entered.push('B'), update: () => {}, draw: () => {} };
  // scene A simulates standing on a door: fires setScene EVERY update
  const sceneA = {
    name: 'A', update: () => { game.setScene(sceneB, { fade: 0.5 }); }, draw: () => {},
  };
  game.setScene(sceneA, { instant: true });
  for (let i = 0; i < 90; i++) game.update(1 / 30); // 3 s ≫ 0.5 s fade
  assert.equal(game.scene, sceneB, 'transition completed');
  assert.deepEqual(entered, ['B'], 'destination entered exactly once');
  assert.equal(game.trans, null, 'no transition left running');
});

test('battle-style finish: repeated onEnd trigger does not re-fade forever', () => {
  const game = new Game(canvas);
  let enters = 0;
  const overworld = { update: () => {}, draw: () => {}, enter: () => enters++ };
  let finished = false;
  const battle = {
    update() {
      // pre-guard battles called onEnd every frame once resolved
      if (!finished) { finished = true; }
      game.setScene(overworld, { fade: 0.5 });
    },
    draw: () => {},
  };
  game.setScene(battle, { instant: true });
  for (let i = 0; i < 90; i++) game.update(1 / 30);
  assert.equal(game.scene, overworld);
  assert.equal(enters, 1, 'overworld entered once');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
