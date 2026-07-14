// Boot. Top-level await keeps the window `load` event from firing until fonts
// and images are ready and the first frame can draw — this is what makes
// `firefox --headless --screenshot` captures deterministic.

import { Game } from '../engine/core.js';
import { Input } from '../engine/input.js';
import { Audio } from '../engine/audio.js';
import { loadImages } from '../engine/assets.js';
import { IMAGES } from '../../assets/manifest.js';
import { G } from './state.js';
import { TitleScene } from './title.js';

const q = new URLSearchParams(location.search);

try {
  await Promise.all([
    document.fonts.load('24px "Patrick Hand"'),
    document.fonts.load('24px "Rock Salt"'),
  ]);
} catch { /* fall back to system fonts */ }

await loadImages(IMAGES);

G.loadSettings();
Audio.volumes.master = G.settings.volMaster;
Audio.volumes.music = G.settings.volMusic;
Audio.volumes.sfx = G.settings.volSfx;

Input.init();
const game = new Game(document.getElementById('game'));
G.game = game;
window.LS = { game, G }; // console access for debugging

if (q.has('debug')) G.debugOverlay = true;

if (q.has('shot')) {
  const { setupShot } = await import('./debug.js');
  await setupShot(game, q.get('shot'), q);
  game.renderOnce(); // frame is on canvas before `load` fires
  game.start();
} else {
  game.setScene(new TitleScene(game), { fade: 1.6 });
  game.start();
}
