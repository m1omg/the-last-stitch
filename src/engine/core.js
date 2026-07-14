// Game loop, scene management, transitions, screen shake and flashes.
// A Scene is any object with: enter?(), exit?(), update(dt), draw(ctx).

import { Input } from './input.js';

export const W = 960, H = 640;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = null;
    this.time = 0;
    // transition state
    this.fadeAlpha = 1;           // start black, fade in on first scene
    this.fadeColor = '#0b0a09';
    this.trans = null;            // { phase:'out'|'in', next, dur, t, color }
    // effects
    this.shakeT = 0; this.shakeDur = 0; this.shakeMag = 0;
    this.flashT = 0; this.flashDur = 0; this.flashColor = '#fff';
    this._raf = null;
  }

  setScene(next, opts = {}) {
    const { fade = 0.6, color = '#0b0a09', instant = false } = opts;
    // A fade-out already in progress is committed: the outgoing scene keeps
    // updating beneath the fade, so whatever triggered the transition (a door
    // underfoot, a finished battle) would re-fire every frame and restart the
    // fade forever. Ignore re-entrant requests.
    if (this.trans?.phase === 'out') return;
    if (instant || !this.scene) {
      this._swap(next);
      this.fadeColor = color;
      this.fadeAlpha = instant ? 0 : 1;
      this.trans = instant ? null : { phase: 'in', dur: fade, t: 0, color };
      return;
    }
    this.trans = { phase: 'out', next, dur: fade, t: 0, color };
  }

  _swap(next) {
    if (this.scene?.exit) this.scene.exit();
    this.scene = next;
    if (next?.enter) next.enter();
  }

  shake(mag = 7, dur = 0.35) { this.shakeMag = mag; this.shakeDur = this.shakeT = dur; }
  flash(color = '#ffffff', dur = 0.25) { this.flashColor = color; this.flashDur = this.flashT = dur; }

  start() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      Input.endFrame();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  update(dt) {
    this.time += dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.flashT > 0) this.flashT -= dt;

    if (this.trans) {
      const tr = this.trans;
      tr.t += dt;
      const k = Math.min(1, tr.t / tr.dur);
      this.fadeColor = tr.color;
      if (tr.phase === 'out') {
        this.fadeAlpha = k;
        if (k >= 1) {
          this._swap(tr.next);
          this.trans = { phase: 'in', dur: tr.dur, t: 0, color: tr.color };
        }
      } else {
        this.fadeAlpha = 1 - k;
        if (k >= 1) this.trans = null;
      }
      // scene keeps animating beneath the fade
    }
    this.scene?.update(dt);
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#0b0a09';
    ctx.fillRect(0, 0, W, H);
    if (this.shakeT > 0) {
      const k = this.shakeT / this.shakeDur;
      const a = this.time * 71;
      ctx.translate(Math.sin(a * 1.3) * this.shakeMag * k, Math.cos(a * 1.7) * this.shakeMag * k * 0.7);
    }
    this.scene?.draw(ctx);
    ctx.restore();

    if (this.flashT > 0) {
      ctx.globalAlpha = Math.max(0, this.flashT / this.flashDur);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.fadeAlpha > 0) {
      ctx.globalAlpha = Math.min(1, this.fadeAlpha);
      ctx.fillStyle = this.fadeColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // Render a single frame synchronously (used by the ?shot= screenshot harness).
  renderOnce() {
    this.fadeAlpha = 0;
    this.trans = null;
    this.update(1 / 60);
    this.draw();
    Input.endFrame();
  }
}
