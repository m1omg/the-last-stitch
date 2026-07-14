// ?shot=<name> harness: put the game into a deterministic state for headless
// screenshots. Grown alongside the game; every scene gets a shot state.

import { W, H } from '../engine/core.js';
import { TitleScene } from './title.js';
import { BattleScene } from './battle.js';
import { OverworldScene, StoryRunner } from './overworld.js';
import { GameOverScene } from './gameover.js';
import { CreditsScene } from './credits.js';
import { PauseMenu } from './menu.js';
import { ShopUI } from './shop.js';
import { Dialogue } from '../engine/dialogue.js';
import { G, mulberry32 } from './state.js';
import { makeMember } from '../data/party.js';
import { IMG } from '../engine/assets.js';

function stockParty(levels = { poppy: 3, buttons: 3, captain: 3 }) {
  G.party = Object.entries(levels).map(([id, lv]) => makeMember(id, lv));
  G.inventory = { biscuit: 3, tea: 2, honeydrop: 1 };
  G.glimmer = 42;
}

class DialogueHostScene {
  constructor(game, script) {
    this.game = game;
    this.dlg = new Dialogue(script, { G, game });
  }
  update(dt) { this.dlg.update(dt); }
  draw(ctx) {
    const bg = IMG.map_harbor;
    ctx.drawImage(bg.el, -200, -200, bg.w, bg.h);
    this.dlg.draw(ctx);
  }
}

export async function setupShot(game, name, q) {
  G.rng = mulberry32(parseInt(q?.get('seed') || '7', 10));

  const shots = {
    title() {
      const s = new TitleScene(game);
      game.setScene(s, { instant: true });
      s.state = 'menu';
      s.t = 0.4;
    },
    title_press() {
      const s = new TitleScene(game);
      game.setScene(s, { instant: true });
      s.t = 0.1;
    },
    battle() {
      stockParty({ poppy: 2, buttons: 2 });
      const s = new BattleScene(game, { enemyIds: ['moth', 'dust'], bg: 'bbg_orchard' });
      game.setScene(s, { instant: true });
      s.queue = []; s.banner = null;
      s.actor = s.state.party[0];
      s.openCommand();
      s.t = 0.3;
    },
    battle_target() {
      stockParty({ poppy: 2, buttons: 2 });
      const s = new BattleScene(game, { enemyIds: ['moth', 'moth', 'dust'], bg: 'bbg_orchard' });
      game.setScene(s, { instant: true });
      s.queue = []; s.banner = null;
      s.actor = s.state.party[0];
      s.pendingAction = { type: 'attack' };
      s.targetSide = 'enemy'; s.targetIdx = 1;
      s.mode = 'target';
      s.t = 0.2;
    },
    battle_boss() {
      stockParty({ poppy: 3, buttons: 3, captain: 3 });
      const s = new BattleScene(game, { enemyIds: ['mothqueen'], bg: 'bbg_orchard', canFlee: false });
      game.setScene(s, { instant: true });
      s.queue = [];
      s.state.party[1].mood = 'stormy';
      s.state.party[0].fade = 2;
      s.state.enemies[0].hp = Math.round(s.state.enemies[0].maxHp * 0.6);
      s.banner = { text: 'Her crown sheds a halo of forgetting-dust.', t: 0, dwell: 99 };
      s.mode = 'events';
      s.t = 0.5;
    },
    dialogue() {
      stockParty();
      const s = new DialogueHostScene(game, [
        { who: 'captain', face: 'stern', text: 'Rule one of the harbour: nobody sails into the Fog. Rule two: pay attention to rule one.' },
      ]);
      game.setScene(s, { instant: true });
      // reveal all text instantly for the screenshot
      s.dlg.update(10);
      if (s.dlg.line) s.dlg.line.shown = 1e9;
    },
    dialogue_choice() {
      stockParty();
      const s = new DialogueHostScene(game, [
        {
          who: 'buttons', face: 'smug', text: 'So. Are we heroes or are we house-cats?',
          choices: [{ label: 'Heroes!', value: 'a' }, { label: 'House-cats.', value: 'b' }, { label: 'Both, obviously.', value: 'c' }],
        },
      ]);
      game.setScene(s, { instant: true });
      s.dlg.update(10);
      if (s.dlg.line) { s.dlg.line.shown = 1e9; s.dlg.update(1 / 60); }
    },
  };

  // overworld map shots: ?shot=map_<id>  (party stocked, flags open everything)
  const mapShot = (mapId, flags = {}, partyLv = { poppy: 4, buttons: 4, captain: 4 }) => () => {
    stockParty(partyLv);
    for (const [k, v] of Object.entries(flags)) G.setFlag(k, v);
    const s = new OverworldScene(game, mapId);
    game.setScene(s, { instant: true });
    s.toastT = 2.0;
    s.t = 0.4;
  };
  shots.map_cottage = mapShot('cottage', { intro_done: true }, { poppy: 1 });
  shots.map_harbor = mapShot('harbor', { trg_harbor_first: true, met_buttons: true, quest_started: true });
  shots.map_harbor_late = mapShot('harbor', {
    trg_harbor_first: true, met_buttons: true, quest_started: true, orchard_done: true,
    captain_joined: true, thread_sun: true, thread_storm: true, trg_white_door_appears: true, white_door: true,
  });
  shots.map_orchard = mapShot('orchard', { trg_harbor_first: true });
  shots.map_sea = mapShot('sea', { captain_joined: true });
  shots.map_white = mapShot('whiterooms', { white_door: true, captain_joined: true, trg_white_enter: true });
  shots.map_lighthouse = mapShot('lighthouse', { threads3: true, captain_joined: true, trg_lighthouse_enter: true });

  shots.pause = () => {
    shots.map_harbor();
    const s = game.scene;
    s.menu = new PauseMenu(s);
  };
  shots.shop = () => {
    shots.map_harbor();
    const s = game.scene;
    s.shop = new ShopUI(s);
  };
  shots.still = () => {
    shots.map_orchard();
    const s = game.scene;
    s.story = new StoryRunner(s, [
      { still: 'cut_coat', lines: ['From the hilltop, the whole orchard shows itself: rows of apple trees, a table set for two, and one empty coat.'] },
    ]);
    s.story.update(0.01);
    if (s.story.dlg) { s.story.dlg.update(10); if (s.story.dlg.line) s.story.dlg.line.shown = 1e9; }
  };
  shots.gameover = () => {
    stockParty();
    const s = new GameOverScene(game);
    game.setScene(s, { instant: true });
    s.t = 2.0;
  };
  shots.credits = () => {
    const s = new CreditsScene(game);
    game.setScene(s, { instant: true });
    s.t = 6.0;
  };
  shots.ritual = () => {
    stockParty({ poppy: 8, buttons: 8, captain: 8 });
    const s = new BattleScene(game, { enemyIds: ['fog2'], bg: 'bbg_fog', canFlee: false, scripted: 'fog2', ritual: true });
    game.setScene(s, { instant: true });
    s.queue = []; s.banner = null;
    s.state.party.forEach(m => { m.fade = 1; });
    s.advanceFlow();
    s.t = 0.4;
  };

  const fn = shots[name] || shots.title;
  await fn();
}
