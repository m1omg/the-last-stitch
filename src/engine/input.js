// Keyboard input. `held` is level-triggered, `pressed` is edge-triggered and
// cleared at the end of every frame by Input.endFrame().
import { Audio } from './audio.js';

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'ok', Enter: 'ok', Space: 'ok',
  KeyX: 'cancel', Escape: 'cancel',
  ShiftLeft: 'run', ShiftRight: 'run',
  F1: 'debug', Backquote: 'debug',
};

export const Input = {
  held: {},
  pressed: {},
  anyPressed: false,

  init() {
    addEventListener('keydown', (e) => {
      const name = KEYMAP[e.code];
      if (name) e.preventDefault();
      Audio.unlock(); // browsers allow audio only after a user gesture
      if (e.repeat) return;
      this.anyPressed = true;
      if (name) {
        this.held[name] = true;
        this.pressed[name] = true;
      }
    });
    addEventListener('keyup', (e) => {
      const name = KEYMAP[e.code];
      if (name) this.held[name] = false;
    });
    addEventListener('blur', () => { this.held = {}; });
  },

  endFrame() {
    this.pressed = {};
    this.anyPressed = false;
  },

  // -1/0/1 movement axes
  axisX() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); },
  axisY() { return (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0); },
};
