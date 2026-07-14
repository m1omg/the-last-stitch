// Game flow: new game, continue, respawn.

import { G } from './state.js';
import { makeMember } from '../data/party.js';
import { OverworldScene } from './overworld.js';
import { MAPS } from '../data/maps.js';

export function startNewGame(game) {
  G.flags = {};
  G.inventory = { biscuit: 2, tea: 1 };
  G.charms = {};
  G.glimmer = 0;
  G.playSeconds = 0;
  G.party = [makeMember('poppy', 1), makeMember('buttons', 1)];
  G.party[1].inParty = false; // Buttons is only a plush until the Patchwork
  const scene = new OverworldScene(game, 'cottage');
  scene.storyOnEnter = 'intro';
  game.setScene(scene, { fade: 1.6 });
}

export function continueGame(game) {
  const data = G.loadSaveData();
  if (!data) { startNewGame(game); return; }
  G.flags = data.flags || {};
  G.inventory = data.inventory || {};
  G.charms = data.charms || {};
  G.glimmer = data.glimmer || 0;
  G.playSeconds = data.playSeconds || 0;
  G.party = (data.party || []).map(p => {
    const m = makeMember(p.id, p.level);
    m.xp = p.xp ?? m.xp;
    m.hp = Math.min(m.maxHp, p.hp ?? m.maxHp);
    m.ink = Math.min(m.maxInk, p.ink ?? m.maxInk);
    m.inParty = p.inParty !== false;
    m.charm = G.charms[p.id] || null;
    return m;
  });
  if (!G.party.length) { startNewGame(game); return; }
  const mapId = MAPS[data.mapId] ? data.mapId : 'harbor';
  game.setScene(new OverworldScene(game, mapId, data.pos), { fade: 1.2 });
}

// After defeat with no save: wake at the harbour, gently patched.
export function respawnHarbor(game) {
  for (const m of G.party) {
    m.hp = Math.max(1, Math.round(m.maxHp * 0.6));
    m.ink = Math.round(m.maxInk * 0.6);
  }
  game.setScene(new OverworldScene(game, 'harbor'), { fade: 1.2 });
}
