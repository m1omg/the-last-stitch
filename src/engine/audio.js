// WebAudio: looped music with crossfade, one-shot SFX, volume buses.
// Files are fetched lazily and cached; a missing file is cached as null so the
// game runs silently (e.g. before audio is generated, or over file://).

export const Audio = {
  ctx: null,
  masterGain: null, musicGain: null, sfxGain: null,
  buffers: new Map(),   // key -> AudioBuffer | null
  pending: new Map(),   // key -> Promise
  current: null,        // { key, src, gain }
  volumes: { master: 0.9, music: 0.8, sfx: 0.9 },

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch { return; }
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes();
      if (this._queuedMusic) { const q = this._queuedMusic; this._queuedMusic = null; this.music(q.key, q.opts); }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  applyVolumes() {
    if (!this.ctx) return;
    this.masterGain.gain.value = this.volumes.master;
    this.musicGain.gain.value = this.volumes.music;
    this.sfxGain.gain.value = this.volumes.sfx;
  },

  load(key) {
    if (this.buffers.has(key)) return Promise.resolve(this.buffers.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    const dir = key.startsWith('mus_') ? 'music' : 'sfx';
    const p = fetch(`assets/audio/${dir}/${key}.ogg`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then(ab => this.ctx ? this.ctx.decodeAudioData(ab) : null)
      .catch(() => null)
      .then(buf => { this.buffers.set(key, buf); this.pending.delete(key); return buf; });
    this.pending.set(key, p);
    return p;
  },

  preload(keys) { if (this.ctx) for (const k of keys) this.load(k); },

  async music(key, opts = {}) {
    const { fade = 1.2, rate = 1.0 } = opts;
    if (!this.ctx) { this._queuedMusic = { key, opts }; return; } // start after first keypress
    if (this.current && this.current.key === key && !opts.restart) {
      if (rate !== this.current.src.playbackRate.value)
        this.current.src.playbackRate.linearRampToValueAtTime(rate, this.ctx.currentTime + 1);
      return;
    }
    const startToken = this._musicToken = (this._musicToken || 0) + 1;
    const buf = await this.load(key);
    if (this._musicToken !== startToken) return; // superseded meanwhile
    // fade out old
    if (this.current) {
      const old = this.current;
      old.gain.gain.setValueAtTime(old.gain.gain.value, this.ctx.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fade);
      setTimeout(() => { try { old.src.stop(); } catch {} }, fade * 1000 + 60);
      this.current = null;
    }
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + fade);
    src.connect(gain); gain.connect(this.musicGain);
    src.start();
    this.current = { key, src, gain };
  },

  stopMusic(fade = 1.0) {
    this._musicToken = (this._musicToken || 0) + 1;
    this._queuedMusic = null;
    if (!this.ctx || !this.current) { this.current = null; return; }
    const old = this.current;
    old.gain.gain.setValueAtTime(old.gain.gain.value, this.ctx.currentTime);
    old.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fade);
    setTimeout(() => { try { old.src.stop(); } catch {} }, fade * 1000 + 60);
    this.current = null;
  },

  async sfx(key, opts = {}) {
    if (!this.ctx) return;
    const buf = await this.load(key);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const gain = this.ctx.createGain();
    gain.gain.value = opts.vol ?? 1;
    src.connect(gain); gain.connect(this.sfxGain);
    src.start();
  },
};
