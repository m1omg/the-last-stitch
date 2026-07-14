// Map geometry + reachability lint: every spawn, door destination and
// enemy home must be standable, and every interactable reachable from spawn
// (BFS over the real collision rules). Run: node tests/geometry.test.mjs
//
// Validates map geometry against the game's collision rules (mirrors
// overworld.js: FEET=26, feet box 24x11, ENEMY_FEET=24).
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { MAPS } = await import('../src/data/maps.js');

const FEET = 26, ENEMY_FEET = 24, CELL = 32;
let errors = [];

function solidAt(m, x, y) {
  if (x < 0 || y < 0 || x >= 1536 || y >= 1024) return true;
  const c = m.grid[Math.floor(y / CELL)]?.[Math.floor(x / CELL)];
  if (c === '#') return true;
  if (c === '~') return !m.boat;
  return false;
}
function boxFree(m, x, y) {
  const hw = 12, top = y + FEET - 9, bot = y + FEET + 2;
  return !solidAt(m, x - hw, top) && !solidAt(m, x + hw, top) &&
         !solidAt(m, x - hw, bot) && !solidAt(m, x + hw, bot);
}
function enemyCanStand(m, e, x, y) {
  const c = m.grid[Math.floor((y + ENEMY_FEET) / CELL)]?.[Math.floor(x / CELL)];
  return e.water ? c === '~' : !solidAt(m, x, y + ENEMY_FEET);
}

for (const [id, m] of Object.entries(MAPS)) {
  // 1. spawn point stands
  if (!boxFree(m, m.spawn.x, m.spawn.y)) errors.push(`${id}: spawn ${m.spawn.x},${m.spawn.y} not boxFree`);

  for (const e of m.entities) {
    // 2. explicit door destinations stand
    if (e.type === 'door' && e.to?.x != null) {
      const t = MAPS[e.to.map];
      if (!boxFree(t, e.to.x, e.to.y)) errors.push(`${id}: door->${e.to.map} dest ${e.to.x},${e.to.y} not boxFree on ${e.to.map}`);
    }
    // 3. walk-on boxes (door/trigger) reachable: some boxFree point inside
    if (e.type === 'door' || e.type === 'trigger') {
      const hw = (e.w || 64) / 2, hh = (e.h || 64) / 2;
      let ok = false;
      for (let y = e.y - hh + 1; y < e.y + hh && !ok; y += 4)
        for (let x = e.x - hw + 1; x < e.x + hw && !ok; x += 4)
          if (boxFree(m, x, y)) ok = true;
      if (!ok) errors.push(`${id}: ${e.type} '${e.id || e.to?.map || e.script}' at ${e.x},${e.y} unreachable (no boxFree point in its box)`);
    }
    // 4. enemy homes stand
    if (e.type === 'enemy' && !enemyCanStand(m, e, e.x, e.y)) {
      errors.push(`${id}: enemy '${e.encounter}' home ${e.x},${e.y} not standable (water=${!!e.water})`);
    }
  }
}

if (errors.length) { console.error('GEOMETRY ERRORS:'); for (const e of errors) console.error(' ✗ ' + e); process.exit(1); }
console.log('geometry: all spawns, door destinations, walk-on boxes and enemy homes valid ✓');

// ——— reachability: BFS from spawn on an 8px lattice using boxFree; every
// interactable (talk/shop/save) must be within interact range of a reachable
// standing point (mirrors interactTarget: radius 60/115, center or facing probe)
for (const [id, m] of Object.entries(MAPS)) {
  const step = 8, W = Math.ceil(1536 / step), H = Math.ceil(1024 / step);
  const seen = new Uint8Array(W * H);
  const q = [[Math.round(m.spawn.x / step), Math.round(m.spawn.y / step)]];
  const reach = [];
  while (q.length) {
    const [gx, gy] = q.pop();
    if (gx < 0 || gy < 0 || gx >= W || gy >= H || seen[gy * W + gx]) continue;
    if (!boxFree(m, gx * step, gy * step)) continue;
    seen[gy * W + gx] = 1;
    reach.push([gx * step, gy * step]);
    q.push([gx+1, gy], [gx-1, gy], [gx, gy+1], [gx, gy-1]);
  }
  for (const e of m.entities) {
    if (!(e.talk || e.shop || e.type === 'save')) continue;
    if (e.cond) continue; // conditional NPCs may appear elsewhere in story flow
    const r = e.big ? 115 : 60;
    const ok = reach.some(([x, y]) =>
      Math.hypot(e.x - x, e.y - y) < r ||
      [[0, 42], [0, -42], [46, 0], [-46, 0]].some(([dx, dy]) => Math.hypot(e.x - x - dx, e.y - y - dy) < r));
    if (!ok) errors.push(`${id}: '${e.id || e.talk}' at ${e.x},${e.y} NOT reachable from spawn (radius ${r})`);
  }
}
if (errors.length) { console.error('REACHABILITY ERRORS:'); for (const e of errors) console.error(' ✗ ' + e); process.exit(1); }
console.log('reachability: every interactable on every map reachable from spawn ✓');
